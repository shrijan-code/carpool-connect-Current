import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const getStripe = (): Stripe => {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
        throw new Error('STRIPE_SECRET_KEY not configured');
    }
    return new Stripe(apiKey, { apiVersion: '2023-10-16' });
};

/**
 * Create a Stripe Identity verification session
 * Called when user clicks "Verify Identity" button
 */
export const createVerificationSession = onCall({ secrets: ['STRIPE_SECRET_KEY'] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in');
    }

    const userId = request.auth.uid;
    const userEmail = request.auth.token.email;
    const userName = request.auth.token.name || 'User';

    try {
        const stripe = getStripe();

        // Fetch user data from Firestore for pre-filling
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        const userData = userDoc.data();

        // Parse name parts for Stripe
        const nameParts = (userData?.name || userName || '').trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Get phone and normalize
        let phone = userData?.phone || '';
        if (phone && phone.startsWith('04')) {
            phone = '+61' + phone.substring(1);
        }

        console.log(`🔍 Creating Identity verification for user ${userId}:`, {
            firstName,
            lastName,
            email: userData?.email || userEmail,
            phone: phone ? '***hidden***' : 'none',
        });

        // Create verification session with user-specific pre-filled data
        // Note: return_url must be https:// - app deep links not supported
        // For mobile apps, users return manually after verification
        const verificationSession = await stripe.identity.verificationSessions.create({
            type: 'document',
            metadata: {
                userId: userId,
                appName: 'CarpoolConnect',
                createdAt: new Date().toISOString(),
            },
            // Pre-fill user data so they don't see generic test data
            provided_details: {
                email: userData?.email || userEmail,
                phone: phone || undefined,
            },
            options: {
                document: {
                    // Allowed document types
                    allowed_types: ['driving_license', 'passport', 'id_card'],
                    // Require live capture (not file upload)
                    require_live_capture: true,
                    // Require matching selfie
                    require_matching_selfie: true,
                },
            },
            // No return_url - users will return to app manually
        });

        // Store session ID in user document
        await admin.firestore().collection('users').doc(userId).update({
            'verification.status': 'pending',
            'verification.sessionId': verificationSession.id,
            'verification.method': 'stripe_identity',
            'verification.initiatedAt': admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Verification session created for user ${userId}: ${verificationSession.id}`);

        // Get the verification URL - Stripe provides this in the response
        let verificationUrl = verificationSession.url;

        // If no URL is provided, try to get a short-lived URL
        if (!verificationUrl) {
            console.log('No URL in session response, generating short-lived URL...');
            try {
                // For document verification sessions, we can create a redirect URL
                // Using the client_secret to construct a verification URL
                const redirectResponse = await stripe.identity.verificationSessions.retrieve(
                    verificationSession.id,
                    { expand: ['verified_outputs'] }
                );
                verificationUrl = redirectResponse.url;
            } catch (urlError) {
                console.error('Error getting verification URL:', urlError);
            }
        }

        if (!verificationUrl) {
            console.error('Could not obtain verification URL for session:', verificationSession.id);
            throw new Error('Failed to generate verification URL. Please try again.');
        }

        console.log(`Verification URL obtained: ${verificationUrl}`);

        return {
            sessionId: verificationSession.id,
            clientSecret: verificationSession.client_secret,
            url: verificationUrl,
        };
    } catch (error: any) {
        console.error('Error creating verification session:', error);

        // Provide more specific error messages
        let errorMessage = 'Failed to create verification session';
        if (error.type === 'StripeInvalidRequestError') {
            errorMessage = 'Invalid request to verification service. Please try again.';
        } else if (error.message?.includes('API key')) {
            errorMessage = 'Payment service configuration error. Please contact support.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        throw new HttpsError('internal', errorMessage);
    }
});

/**
 * Get verification status for a user
 * Returns current verification state
 */
export const getVerificationStatus = onCall({ secrets: ['STRIPE_SECRET_KEY'] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in');
    }

    const userId = request.auth.uid;

    try {
        const userDoc = await admin.firestore().collection('users').doc(userId).get();

        if (!userDoc.exists) {
            throw new HttpsError('not-found', 'User not found');
        }

        const userData = userDoc.data();
        const verification = userData?.verification || { status: 'unverified' };

        // If there's a pending session, check its status with Stripe
        if (verification.status === 'pending' && verification.sessionId) {
            const stripe = getStripe();
            const session = await stripe.identity.verificationSessions.retrieve(verification.sessionId);

            // Update local status if Stripe status has changed
            if (session.status === 'verified') {
                await admin.firestore().collection('users').doc(userId).update({
                    'verification.status': 'verified',
                    'verification.verifiedAt': admin.firestore.FieldValue.serverTimestamp(),
                });
                return {
                    status: 'verified',
                    verifiedAt: new Date(),
                    sessionId: verification.sessionId,
                };
            } else if (session.status === 'requires_input' || session.status === 'canceled') {
                await admin.firestore().collection('users').doc(userId).update({
                    'verification.status': 'failed',
                });
                return {
                    status: 'failed',
                    sessionId: verification.sessionId,
                };
            }
        }

        return {
            status: verification.status,
            verifiedAt: verification.verifiedAt?.toDate?.() || null,
            sessionId: verification.sessionId || null,
        };
    } catch (error: any) {
        console.error('Error getting verification status:', error);
        throw new HttpsError('internal', error.message || 'Failed to get verification status');
    }
});

/**
 * Webhook handler for Stripe Identity events
 * Updates user verification status when verification completes
 */
export const handleIdentityWebhook = onRequest({ secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] }, async (req, res) => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET not configured');
        res.status(500).send('Webhook secret not configured');
        return;
    }

    const sig = req.headers['stripe-signature'];

    if (!sig) {
        res.status(400).send('Missing stripe-signature header');
        return;
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    console.log(`Received Identity webhook event: ${event.type} (ID: ${event.id})`);

    // Deduplication: Check if we've already processed this event
    const processedEventsRef = admin.firestore().collection('processed_webhook_events').doc(event.id);
    const existingEvent = await processedEventsRef.get();

    if (existingEvent.exists) {
        console.log(`Event ${event.id} already processed, skipping`);
        res.json({ received: true, duplicate: true });
        return;
    }

    // Mark event as being processed (before processing to prevent race conditions)
    await processedEventsRef.set({
        type: event.type,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        // TTL field for automatic cleanup (7 days)
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    try {
        // Handle verification session events
        if (event.type === 'identity.verification_session.verified') {
            const session = event.data.object as Stripe.Identity.VerificationSession;
            const userId = session.metadata?.userId;

            if (!userId) {
                console.error('No userId in verification session metadata');
                res.status(400).send('Missing userId in metadata');
                return;
            }

            // Update user document
            await admin.firestore().collection('users').doc(userId).update({
                'verification.status': 'verified',
                'verification.verifiedAt': admin.firestore.FieldValue.serverTimestamp(),
                'verification.sessionId': session.id,
            });

            console.log(`User ${userId} verification completed successfully`);

            // Send notification
            await admin.firestore().collection('notifications').add({
                userId: userId,
                title: 'Identity Verified!',
                message: 'Your identity has been successfully verified. You can now post rides.',
                type: 'verification_success',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
            });

        } else if (event.type === 'identity.verification_session.requires_input' ||
            event.type === 'identity.verification_session.canceled') {
            const session = event.data.object as Stripe.Identity.VerificationSession;
            const userId = session.metadata?.userId;

            if (!userId) {
                console.error('No userId in verification session metadata');
                res.status(400).send('Missing userId in metadata');
                return;
            }

            // Update user document
            await admin.firestore().collection('users').doc(userId).update({
                'verification.status': 'failed',
                'verification.sessionId': session.id,
            });

            console.log(`User ${userId} verification failed or canceled`);

            // Send notification
            await admin.firestore().collection('notifications').add({
                userId: userId,
                title: 'Verification Failed',
                message: 'Your identity verification could not be completed. Please try again.',
                type: 'verification_failed',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
            });
        }

        res.json({ received: true });
    } catch (error: any) {
        console.error('Error processing webhook:', error);
        res.status(500).send(`Webhook processing error: ${error.message}`);
    }
});

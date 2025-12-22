import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const reportDoc = await db.collection('safety_reports').doc(params.id).get();

        if (!reportDoc.exists) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const reportData = reportDoc.data();

        // Fetch reporter details
        let reporter = null;
        if (reportData?.reporterId) {
            const userDoc = await db.collection('users').doc(reportData.reporterId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                reporter = {
                    id: userDoc.id,
                    name: userData?.name,
                    email: userData?.email,
                    phone: userData?.phone,
                };
            }
        }

        // Fetch emergency contact
        let emergencyContact = null;
        if (reportData?.reporterId) {
            const contactsSnapshot = await db.collection('emergency_contacts')
                .where('userId', '==', reportData.reporterId)
                .where('isPrimary', '==', true)
                .limit(1)
                .get();

            if (!contactsSnapshot.empty) {
                const contactData = contactsSnapshot.docs[0].data();
                emergencyContact = {
                    name: contactData.name,
                    phone: contactData.phone,
                    relationship: contactData.relationship,
                };
            }
        }

        // Fetch notes
        const notesSnapshot = await db.collection('safety_reports')
            .doc(params.id)
            .collection('notes')
            .orderBy('createdAt', 'desc')
            .get();

        const notes = notesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        }));

        const report = {
            id: reportDoc.id,
            ...reportData,
            createdAt: reportData?.createdAt?.toDate?.()?.toISOString() || reportData?.createdAt,
            updatedAt: reportData?.updatedAt?.toDate?.()?.toISOString() || reportData?.updatedAt,
            reporter,
            emergencyContact,
            notes,
        };

        return NextResponse.json({ report });
    } catch (error) {
        console.error('Error fetching report:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { status } = await request.json();

        await db.collection('safety_reports').doc(params.id).update({
            status,
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating report:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

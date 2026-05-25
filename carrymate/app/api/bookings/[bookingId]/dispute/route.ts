import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth';
import { getBookingById, serverTimestamp } from '@/lib/booking-store';
import { sendEmail } from '@/lib/email';
import type { User } from '@/types';

interface DisputeBody {
  reason: string;
}

export async function POST(
  request: Request,
  { params }: { params: { bookingId: string } }
): Promise<Response> {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const body = (await request.json()) as DisputeBody;
    if (!body.reason || body.reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'A dispute reason of at least 10 characters is required' },
        { status: 400 }
      );
    }

    const booking = await getBookingById(params.bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const isParticipant =
      booking.senderId === userId || booking.travellerId === userId;
    if (!isParticipant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const disputableStatuses = ['paid', 'picked_up', 'delivered'];
    if (!disputableStatuses.includes(booking.status)) {
      return NextResponse.json(
        { error: 'Booking cannot be disputed in its current status' },
        { status: 400 }
      );
    }

    const incidentRef = getAdminDb().collection('incidents').doc();

    const batch = getAdminDb().batch();

    batch.update(getAdminDb().collection('bookings').doc(booking.id), {
      status: 'disputed',
      disputeReason: body.reason.trim(),
      updatedAt: serverTimestamp(),
    });

    batch.set(incidentRef, {
      id: incidentRef.id,
      bookingId: booking.id,
      userId,
      type: 'dispute',
      description: body.reason.trim(),
      evidenceURLs: [],
      status: 'open',
      createdAt: serverTimestamp(),
      resolvedAt: null,
      adminNotes: '',
    });

    await batch.commit();

    const notifyIds = [booking.senderId, booking.travellerId].filter((id) => id !== userId);
    const disputeNotice = {
      subject: 'Dispute raised on your CarryMate booking',
      html: `
        <h2>Dispute Raised</h2>
        <p>A dispute has been raised for booking ${booking.id}.</p>
        <p>Please provide your account of events within 48 hours via the booking detail page.</p>
        <p>Payment is frozen until an admin resolves this dispute.</p>
      `,
    };

    await Promise.all(
      notifyIds.map(async (id) => {
        const snap = await getAdminDb().collection('users').doc(id).get();
        const user = snap.data() as User | undefined;
        if (user?.email) {
          await sendEmail({ to: user.email, ...disputeNotice });
        }
      })
    );

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `New dispute — booking ${booking.id}`,
        html: `<p>Dispute raised by user ${userId}: ${body.reason.trim()}</p>`,
      });
    }

    return NextResponse.json({ success: true, status: 'disputed', incidentId: incidentRef.id });
  } catch (error) {
    console.error('Dispute booking error:', error);
    return NextResponse.json({ error: 'Failed to raise dispute' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth';
import { getBookingById, serverTimestamp } from '@/lib/booking-store';

interface RatingBody {
  bookingId: string;
  ratedUser: string;
  role: 'traveller' | 'sender';
  score: number;
  comment?: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const body = (await request.json()) as RatingBody;

    if (!body.bookingId || !body.ratedUser || !body.role) {
      return NextResponse.json(
        { error: 'bookingId, ratedUser, and role are required' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(body.score) || body.score < 1 || body.score > 5) {
      return NextResponse.json({ error: 'Score must be an integer between 1 and 5' }, { status: 400 });
    }

    const booking = await getBookingById(body.bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status !== 'delivered') {
      return NextResponse.json(
        { error: 'Ratings can only be submitted after delivery is confirmed' },
        { status: 400 }
      );
    }

    const isSender = userId === booking.senderId;
    const isTraveller = userId === booking.travellerId;

    if (!isSender && !isTraveller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (body.role === 'traveller' && !isSender) {
      return NextResponse.json({ error: 'Only the sender can rate the traveller' }, { status: 403 });
    }

    if (body.role === 'sender' && !isTraveller) {
      return NextResponse.json({ error: 'Only the traveller can rate the sender' }, { status: 403 });
    }

    const expectedRatedUser =
      body.role === 'traveller' ? booking.travellerId : booking.senderId;

    if (body.ratedUser !== expectedRatedUser) {
      return NextResponse.json({ error: 'ratedUser does not match booking participants' }, { status: 400 });
    }

    const db = getAdminDb();
    const existingRating = await db
      .collection('ratings')
      .where('bookingId', '==', body.bookingId)
      .where('ratedBy', '==', userId)
      .limit(1)
      .get();

    if (!existingRating.empty) {
      return NextResponse.json({ error: 'You have already rated this booking' }, { status: 409 });
    }

    const ratingRef = db.collection('ratings').doc();
    const ratedUserRef = db.collection('users').doc(body.ratedUser);

    await db.runTransaction(async (transaction) => {
      const ratedUserSnap = await transaction.get(ratedUserRef);
      if (!ratedUserSnap.exists) {
        throw new Error('Rated user not found');
      }

      const ratedUser = ratedUserSnap.data();
      const currentRating = ratedUser?.rating ?? 0;
      const totalRatings = ratedUser?.totalRatings ?? 0;
      const newRating =
        Math.round(((currentRating * totalRatings + body.score) / (totalRatings + 1)) * 100) / 100;

      transaction.set(ratingRef, {
        id: ratingRef.id,
        bookingId: body.bookingId,
        ratedBy: userId,
        ratedUser: body.ratedUser,
        role: body.role,
        score: body.score,
        comment: body.comment?.trim() ?? '',
        createdAt: serverTimestamp(),
      });

      transaction.update(ratedUserRef, {
        rating: newRating,
        totalRatings: FieldValue.increment(1),
        updatedAt: serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true, ratingId: ratingRef.id });
  } catch (error) {
    console.error('Create rating error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create rating';
    const status = message === 'Rated user not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

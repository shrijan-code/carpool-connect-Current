import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type { Booking } from '@/types';

export async function getBookingById(bookingId: string): Promise<Booking | null> {
  const snap = await getAdminDb().collection('bookings').doc(bookingId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Booking;
}

export async function enrichBookingWithTrip(booking: Booking): Promise<Booking> {
  if (booking.travelDate) return booking;

  const tripSnap = await getAdminDb().collection('trips').doc(booking.tripId).get();
  if (!tripSnap.exists) return booking;

  const trip = tripSnap.data();
  return {
    ...booking,
    fromCity: trip?.fromCity,
    toCity: trip?.toCity,
    travelDate: trip?.travelDate as unknown as Booking['travelDate'],
  };
}

export function serverTimestamp(): FieldValue {
  return FieldValue.serverTimestamp();
}

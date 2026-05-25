'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Check, Circle, X } from 'lucide-react';
import { getClientDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import type { Booking, BookingStatus, DeclarationRecord } from '@/types';
import { ITEM_CATEGORIES } from '@/types';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';
import RouteDisplay from '@/components/ui/RouteDisplay';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { DetailPageSkeleton } from '@/components/ui/Skeleton';
import ProhibitedItemsDeclaration from '@/components/declaration/ProhibitedItemsDeclaration';
import PaymentForm from '@/components/payment/PaymentForm';
import BookingChat from '@/components/chat/BookingChat';
import RatingModal from '@/components/ratings/RatingModal';
import { useToast } from '@/components/toast/ToastProvider';
import { ClipboardList } from 'lucide-react';

const TIMELINE_STEPS: { status: BookingStatus; label: string }[] = [
  { status: 'pending', label: 'Request sent' },
  { status: 'accepted', label: 'Accepted by carrier' },
  { status: 'paid', label: 'Payment confirmed' },
  { status: 'picked_up', label: 'Item picked up' },
  { status: 'delivered', label: 'Delivered' },
];

const STATUS_ORDER: BookingStatus[] = [
  'pending',
  'accepted',
  'paid',
  'picked_up',
  'delivered',
  'cancelled',
  'disputed',
  'refunded',
];

function getStepIndex(status: BookingStatus): number {
  const idx = STATUS_ORDER.indexOf(status);
  if (idx <= 4) return idx;
  return status === 'cancelled' || status === 'refunded' ? -1 : 4;
}

export default function BookingDetailPage() {
  const params = useParams();
  const bookingId = params.bookingId as string;
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ userId: string; role: 'traveller' | 'sender' } | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  const callBookingApi = async (action: string, body: Record<string, unknown> = {}) => {
    const token = await user?.getIdToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`/api/bookings/${bookingId}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? 'Action failed');
    }
  };

  useEffect(() => {
    const ref = doc(getClientDb(), 'bookings', bookingId);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setBooking({ id: snap.id, ...snap.data() } as Booking);
      } else {
        setBooking(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [bookingId]);

  const isSender = user?.uid === booking?.senderId;
  const isTraveller = user?.uid === booking?.travellerId;
  const categoryLabel =
    ITEM_CATEGORIES.find((c) => c.value === booking?.itemCategory)?.label ?? booking?.itemCategory;

  const updateStatus = async (status: BookingStatus, extra: Record<string, unknown> = {}) => {
    if (!booking) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(getClientDb(), 'bookings', booking.id), {
        status,
        updatedAt: serverTimestamp(),
        ...extra,
      });
      toast('Booking updated.', 'success');
    } catch {
      toast('Action failed. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await callBookingApi('accept');
      toast('Booking accepted.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    setActionLoading(true);
    try {
      await callBookingApi('decline');
      toast('Booking declined.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this booking?')) return;
    setActionLoading(true);
    try {
      await callBookingApi('cancel', { reason: 'Cancelled by user' });
      toast('Booking cancelled.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignDeclaration = async (declaration: DeclarationRecord) => {
    if (!booking) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(getClientDb(), 'bookings', booking.id), {
        declarationData: declaration,
        declarationSignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowDeclaration(false);
      setShowPayment(true);
      toast('Declaration signed.', 'success');
    } catch {
      toast('Failed to save declaration.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    void updateStatus('paid');
    setShowPayment(false);
  };

  const handleConfirmPickup = async () => {
    setActionLoading(true);
    try {
      await callBookingApi('pickup');
      toast('Pickup confirmed.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    setActionLoading(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/stripe/confirm-delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId: booking?.id }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to confirm delivery');
      }
      toast('Delivery confirmed. Payment released.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <DetailPageSkeleton />;

  if (!booking) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Booking not found"
        description="This booking may have been removed."
        actionLabel="My bookings"
        onAction={() => router.push('/bookings')}
      />
    );
  }

  const currentStep = getStepIndex(booking.status);
  const total = booking.agreedPrice + booking.platformFee;
  const needsDeclaration = isSender && booking.status === 'accepted' && !booking.declarationSignedAt;
  const needsPayment =
    isSender && booking.status === 'accepted' && booking.declarationSignedAt && !booking.stripePaymentIntentId;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Booking details</h1>
          <p className="text-sm text-gray-500">ID: {booking.id}</p>
        </div>
        <BookingStatusBadge status={booking.status} />
      </div>

      {booking.fromCity && booking.toCity && (
        <Card>
          <RouteDisplay fromCity={booking.fromCity} toCity={booking.toCity} />
          {booking.travelDate && (
            <p className="mt-2 text-sm text-gray-600">
              Travel date: {format(booking.travelDate.toDate(), 'dd MMM yyyy')}
            </p>
          )}
          <Link href={`/trips/${booking.tripId}`} className="mt-2 inline-block text-sm text-brand-primary hover:underline">
            View trip
          </Link>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Timeline</h2>
        {booking.status === 'cancelled' || booking.status === 'refunded' ? (
          <p className="text-sm text-brand-danger">
            This booking was {booking.status}.
            {booking.cancelledAt && ` on ${format(booking.cancelledAt.toDate(), 'dd MMM yyyy')}.`}
          </p>
        ) : (
          <ol className="space-y-4">
            {TIMELINE_STEPS.map((step, index) => {
              const done = index <= currentStep;
              const active = index === currentStep;
              return (
                <li key={step.status} className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      done ? 'bg-brand-success text-white' : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </div>
                  <span className={`text-sm ${active ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Item details</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Category</dt>
            <dd>{categoryLabel}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Weight</dt>
            <dd>{booking.estimatedWeight} kg</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Description</dt>
            <dd>{booking.itemDescription}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Recipient</dt>
            <dd>
              {booking.recipientName} · {booking.recipientPhone}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Pickup</dt>
            <dd>{booking.pickupLocation}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Payment summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Delivery fee</dt>
            <dd>${booking.agreedPrice.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Platform fee</dt>
            <dd>${booking.platformFee.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <dt>Total</dt>
            <dd>${total.toFixed(2)} AUD</dd>
          </div>
          {isTraveller && (
            <div className="flex justify-between text-brand-success">
              <dt>Your payout</dt>
              <dd>${booking.travellerPayout.toFixed(2)}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {isTraveller && booking.status === 'pending' && (
            <>
              <Button onClick={handleAccept} loading={actionLoading}>
                Accept booking
              </Button>
              <Button variant="danger" onClick={handleDecline} loading={actionLoading}>
                <X className="h-4 w-4" />
                Decline
              </Button>
            </>
          )}
          {isTraveller && booking.status === 'paid' && (
            <Button onClick={handleConfirmPickup} loading={actionLoading}>
              Confirm pickup
            </Button>
          )}
          {isTraveller && booking.status === 'picked_up' && (
            <Button onClick={handleConfirmDelivery} loading={actionLoading}>
              Confirm delivery
            </Button>
          )}
          {isSender && ['pending', 'accepted'].includes(booking.status) && (
            <Button variant="danger" onClick={handleCancel} loading={actionLoading}>
              Cancel booking
            </Button>
          )}
          {needsDeclaration && (
            <Button onClick={() => setShowDeclaration(true)}>Sign declaration & pay</Button>
          )}
          {needsPayment && !showPayment && (
            <Button onClick={() => setShowPayment(true)}>Proceed to payment</Button>
          )}
          {booking.status === 'delivered' && (
            <Button
              onClick={() => {
                const target = isSender
                  ? { userId: booking.travellerId, role: 'traveller' as const }
                  : isTraveller
                    ? { userId: booking.senderId, role: 'sender' as const }
                    : null;
                if (target) {
                  setRatingTarget(target);
                  setShowRating(true);
                }
              }}
            >
              Leave a rating
            </Button>
          )}
        </div>
      </Card>

      {showPayment && (
        <PaymentForm
          amount={total}
          deliveryFee={booking.agreedPrice}
          platformFee={booking.platformFee}
          bookingId={booking.id}
          travellerId={booking.travellerId}
          onSuccess={handlePaymentSuccess}
          onCancel={() => setShowPayment(false)}
        />
      )}

      <BookingChat bookingId={booking.id} bookingStatus={booking.status} />

      <ProhibitedItemsDeclaration
        open={showDeclaration}
        onClose={() => setShowDeclaration(false)}
        onComplete={handleSignDeclaration}
        loading={actionLoading}
      />

      {ratingTarget && (
        <RatingModal
          open={showRating}
          bookingId={booking.id}
          ratedUserId={ratingTarget.userId}
          role={ratingTarget.role}
          onClose={() => setShowRating(false)}
          onSubmitted={() => toast('Rating submitted. Thank you!', 'success')}
        />
      )}
    </div>
  );
}

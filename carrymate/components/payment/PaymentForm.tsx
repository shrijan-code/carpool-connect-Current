'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { getClientAuth } from '@/lib/firebase';
import { getStripePublishableKey } from '@/lib/stripe-client';

const stripePromise = loadStripe(getStripePublishableKey());

interface PaymentFormInnerProps {
  amount: number;
  deliveryFee: number;
  platformFee: number;
  bookingId: string;
  travellerId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function CheckoutForm({
  amount,
  deliveryFee,
  platformFee,
  bookingId,
  onSuccess,
  onCancel,
}: Omit<PaymentFormInnerProps, 'travellerId'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? 'Payment failed');
        setLoading(false);
        return;
      }
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/bookings/${bookingId}?paid=1`,
        },
        redirect: 'if_required',
      });
      if (confirmError) {
        setError(confirmError.message ?? 'Payment failed. Please try again.');
      } else {
        onSuccess?.();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Payment summary</h3>
      <div className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Item delivery fee:</span>
          <span>${deliveryFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Platform fee (13%):</span>
          <span>${platformFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 font-semibold">
          <span>Total charged:</span>
          <span>${amount.toFixed(2)}</span>
        </div>
      </div>
      <PaymentElement />
      {error && <p className="mt-3 text-sm text-brand-danger">{error}</p>}
      <div className="mt-4 flex gap-3">
        {onCancel && (
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button className="flex-1" onClick={() => void handlePay()} loading={loading}>
          Pay and Book
        </Button>
      </div>
    </Card>
  );
}

interface PaymentFormProps {
  amount: number;
  deliveryFee: number;
  platformFee: number;
  bookingId: string;
  travellerId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function PaymentForm(props: PaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initError, setInitError] = useState('');
  const [initializing, setInitializing] = useState(false);

  const initPayment = async () => {
    if (clientSecret || initializing) return;
    setInitializing(true);
    setInitError('');
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      if (!token) {
        setInitError('You must be logged in to pay.');
        return;
      }
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: props.bookingId,
          travellerId: props.travellerId,
        }),
      });
      const data = (await res.json()) as { clientSecret?: string; error?: string };
      if (!res.ok || !data.clientSecret) {
        setInitError(data.error ?? 'Failed to initialize payment');
        return;
      }
      setClientSecret(data.clientSecret);
    } catch {
      setInitError('Failed to initialize payment. Please try again.');
    } finally {
      setInitializing(false);
    }
  };

  if (!clientSecret) {
    return (
      <Card>
        <p className="mb-4 text-sm text-gray-600">
          Total: <strong>${props.amount.toFixed(2)} AUD</strong>
        </p>
        {initError && <p className="mb-3 text-sm text-brand-danger">{initError}</p>}
        <Button onClick={() => void initPayment()} loading={initializing} className="w-full">
          Proceed to payment
        </Button>
      </Card>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm {...props} />
    </Elements>
  );
}

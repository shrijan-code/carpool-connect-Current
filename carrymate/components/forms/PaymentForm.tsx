'use client';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface PaymentFormProps {
  amount: number;
  bookingId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function PaymentForm({ amount, bookingId, onSuccess, onCancel }: PaymentFormProps) {
  return (
    <Card>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">Payment</h3>
      <p className="mb-4 text-sm text-gray-600">
        Complete payment of <strong>${amount.toFixed(2)} AUD</strong> for booking{' '}
        <span className="font-mono text-xs">{bookingId.slice(0, 8)}…</span>.
      </p>
      <div className="mb-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
        Stripe payment element will be integrated here.
      </div>
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button className="flex-1" onClick={onSuccess}>
          Pay ${amount.toFixed(2)}
        </Button>
      </div>
    </Card>
  );
}

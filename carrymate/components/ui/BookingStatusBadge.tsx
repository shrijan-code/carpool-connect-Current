import type { BookingStatus } from '@/types';
import { cn } from '@/lib/utils';

const statusConfig: Record<BookingStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700' },
  accepted: { label: 'Accepted', className: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', className: 'bg-indigo-100 text-indigo-700' },
  picked_up: { label: 'Picked Up', className: 'bg-amber-100 text-amber-700' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
  disputed: { label: 'Disputed', className: 'bg-orange-100 text-orange-700' },
  refunded: { label: 'Refunded', className: 'bg-purple-100 text-purple-700' },
};

interface BookingStatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

export default function BookingStatusBadge({ status, className }: BookingStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

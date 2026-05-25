import type { Booking, BookingStatus } from '@/types';

export interface RefundCalculation {
  refundAmount: number;
  travellerCompensation: number;
  refundPercent: number;
  eligible: boolean;
  message: string;
}

const MS_PER_HOUR = 60 * 60 * 1000;

function getTravelDateMs(booking: Booking): number | null {
  if (!booking.travelDate) return null;
  const travelDate = booking.travelDate;
  if (typeof travelDate.toDate === 'function') {
    return travelDate.toDate().getTime();
  }
  return null;
}

export function calculateCancellationRefund(
  booking: Booking,
  statusAtCancel: BookingStatus
): RefundCalculation {
  const totalPaid = booking.agreedPrice + booking.platformFee;

  if (statusAtCancel === 'pending') {
    return {
      refundAmount: 0,
      travellerCompensation: 0,
      refundPercent: 100,
      eligible: false,
      message: 'No payment to refund — booking was pending.',
    };
  }

  if (statusAtCancel === 'accepted') {
    return {
      refundAmount: totalPaid,
      travellerCompensation: 0,
      refundPercent: 100,
      eligible: false,
      message: 'No payment captured yet — booking cancelled before payment.',
    };
  }

  if (statusAtCancel === 'picked_up' || statusAtCancel === 'delivered') {
    return {
      refundAmount: 0,
      travellerCompensation: 0,
      refundPercent: 0,
      eligible: false,
      message: 'No refund after pickup — please raise a dispute instead.',
    };
  }

  if (statusAtCancel === 'paid') {
    const travelMs = getTravelDateMs(booking);
    const now = Date.now();

    if (travelMs === null || now < travelMs - 24 * MS_PER_HOUR) {
      return {
        refundAmount: totalPaid,
        travellerCompensation: 0,
        refundPercent: 100,
        eligible: true,
        message: 'Full refund — cancelled more than 24 hours before travel date.',
      };
    }

    const halfRefund = Math.round(totalPaid * 50) / 100;
    const travellerCompensation = Math.round((totalPaid - halfRefund) * 100) / 100;

    return {
      refundAmount: halfRefund,
      travellerCompensation,
      refundPercent: 50,
      eligible: true,
      message:
        '50% refund — cancelled within 24 hours of travel. Remaining amount compensates the traveller.',
    };
  }

  return {
    refundAmount: 0,
    travellerCompensation: 0,
    refundPercent: 0,
    eligible: false,
    message: 'Booking is not eligible for refund.',
  };
}

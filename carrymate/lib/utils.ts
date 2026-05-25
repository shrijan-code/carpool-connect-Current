import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PLATFORM_FEE_RATE } from '@/types';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function calculatePlatformFee(amountDollars: number): number {
  return Math.round(amountDollars * PLATFORM_FEE_RATE * 100) / 100;
}

export function calculateBookingPricing(weightKg: number, pricePerKg: number): {
  deliveryFee: number;
  platformFee: number;
  total: number;
  travellerPayout: number;
} {
  const deliveryFee = Math.round(weightKg * pricePerKg * 100) / 100;
  const platformFee = calculatePlatformFee(deliveryFee);
  const total = Math.round((deliveryFee + platformFee) * 100) / 100;
  const travellerPayout = Math.round((deliveryFee - platformFee) * 100) / 100;
  return { deliveryFee, platformFee, total, travellerPayout };
}

export function formatAustralianPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('61')) {
    return `+${digits.slice(0, 11)}`;
  }
  if (digits.startsWith('0')) {
    return `+61${digits.slice(1, 10)}`;
  }
  if (digits.length === 9) {
    return `+61${digits}`;
  }
  return input;
}

export function getRouteKey(from: string, to: string): string {
  return `${from}-${to}`;
}

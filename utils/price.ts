/**
 * Price utility functions
 * 
 * IMPORTANT: All prices in the database are stored in CENTS
 * - pricePerSeat: stored in cents (e.g., 1500 = $15.00)
 * - amountTotal: stored in cents (e.g., 3000 = $30.00)
 */

/**
 * Format price from cents to dollar string
 * @param priceInCents - Price in cents (e.g., 1500)
 * @returns Formatted price string (e.g., "$15.00")
 */
export function formatPrice(priceInCents: number): string {
  const dollars = priceInCents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Format price from cents to dollar number
 * @param priceInCents - Price in cents (e.g., 1500)
 * @returns Price in dollars (e.g., 15.00)
 */
export function centsToDollars(priceInCents: number): number {
  return priceInCents / 100;
}

/**
 * Convert dollars to cents
 * @param dollars - Price in dollars (e.g., 15.00)
 * @returns Price in cents (e.g., 1500)
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Format price per seat display
 * @param pricePerSeatInCents - Price per seat in cents
 * @returns Formatted string (e.g., "$15.00/seat")
 */
export function formatPricePerSeat(pricePerSeatInCents: number): string {
  return `${formatPrice(pricePerSeatInCents)}/seat`;
}

/**
 * Calculate total price for multiple seats
 * @param pricePerSeatInCents - Price per seat in cents
 * @param seats - Number of seats
 * @returns Total price in cents
 */
export function calculateTotalPrice(pricePerSeatInCents: number, seats: number): number {
  return pricePerSeatInCents * seats;
}

/**
 * Format total booking price
 * @param pricePerSeatInCents - Price per seat in cents
 * @param seats - Number of seats
 * @returns Formatted total price string (e.g., "$30.00")
 */
export function formatTotalPrice(pricePerSeatInCents: number, seats: number): string {
  const totalInCents = calculateTotalPrice(pricePerSeatInCents, seats);
  return formatPrice(totalInCents);
}

// =============================================================================
// PLATFORM FEE CONFIGURATION
// =============================================================================

/**
 * Platform service fee in cents ($5.00)
 * This fee covers payment processing, insurance, and platform maintenance
 */
export const PLATFORM_FEE_CENTS = 500;

/**
 * Platform fee formatted as string
 */
export const PLATFORM_FEE_DISPLAY = formatPrice(PLATFORM_FEE_CENTS);

/**
 * Calculate total with platform fee
 * @param ridePriceInCents - Base ride price in cents
 * @returns Total including platform fee in cents
 */
export function calculateTotalWithFee(ridePriceInCents: number): number {
  return ridePriceInCents + PLATFORM_FEE_CENTS;
}

/**
 * Format booking total with fee breakdown
 * @param pricePerSeatInCents - Price per seat in cents
 * @param seats - Number of seats
 * @returns Object with ride price, fee, and total
 */
export function getBookingPriceBreakdown(pricePerSeatInCents: number, seats: number): {
  ridePrice: string;
  ridePriceCents: number;
  platformFee: string;
  platformFeeCents: number;
  total: string;
  totalCents: number;
} {
  const ridePriceCents = calculateTotalPrice(pricePerSeatInCents, seats);
  const totalCents = calculateTotalWithFee(ridePriceCents);

  return {
    ridePrice: formatPrice(ridePriceCents),
    ridePriceCents,
    platformFee: PLATFORM_FEE_DISPLAY,
    platformFeeCents: PLATFORM_FEE_CENTS,
    total: formatPrice(totalCents),
    totalCents,
  };
}

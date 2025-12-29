# Platform Fee Configuration Guide

This document explains how to modify the platform fee structure in CarpoolConnect. Use this guide when adjusting pricing to cover operational costs or increase profitability.

## Current Fee Structure

| Type | Amount | Description |
|------|--------|-------------|
| **Flat Fee** | $5.00 AUD | Charged per booking to riders |

> [!NOTE]
> The $5 flat fee is charged to riders on each booking. This fee goes to the platform and covers payment processing and platform maintenance. The driver receives the full ride price set by them.

---

## Proposed Fee Structure (Flat + Percentage)

To implement a hybrid model like Stripe's pricing (e.g., $0.30 + 2.9%):

```
Platform Fee = FLAT_FEE + (RIDE_PRICE × PERCENTAGE)
```

Example: $1.00 flat + 5% of ride price

---

## Files to Modify

### 1. Centralized Fee Configuration

#### [price.ts](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/utils/price.ts)

**Current (lines 76-97):**
```typescript
export const PLATFORM_FEE_CENTS = 500;
```

**Update to:**
```typescript
// Platform fee configuration
export const PLATFORM_FEE_FLAT_CENTS = 100; // $1.00 flat fee
export const PLATFORM_FEE_PERCENTAGE = 0.05; // 5% of ride price

export function calculatePlatformFee(ridePriceInCents: number): number {
  return PLATFORM_FEE_FLAT_CENTS + Math.round(ridePriceInCents * PLATFORM_FEE_PERCENTAGE);
}

export function calculateTotalWithFee(ridePriceInCents: number): number {
  return ridePriceInCents + calculatePlatformFee(ridePriceInCents);
}
```

---

### 2. Cloud Functions (Backend)

#### [functions/src/index.ts](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/functions/src/index.ts)

Update these locations:

| Line | Function | Current Code |
|------|----------|--------------|
| 1087 | `createPendingBooking` | `const platformFee = 500;` |
| 2608 | `completeRideAndCharge` | `const platformFee = 500;` |
| 3993 | `processDriverPayout` | `const platformFeePercent = 0.1;` |
| 4105 | `handleSuccessfulPayment` | `const platformFee = Math.round(totalAmount * 0.1);` |

**Replace with:**
```typescript
// Calculate platform fee (flat + percentage)
const PLATFORM_FEE_FLAT = 100; // $1.00 in cents
const PLATFORM_FEE_PERCENT = 0.05; // 5%
const platformFee = PLATFORM_FEE_FLAT + Math.round(ridePrice * PLATFORM_FEE_PERCENT);
```

> [!IMPORTANT]
> Consider creating a shared `calculatePlatformFee()` function in Cloud Functions to avoid duplication.

---

### 3. Mobile App Components

#### [components/BookingModal.tsx](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/components/BookingModal.tsx)
- Line 48: `const platformFee = 500;`

#### [components/StripePayment.tsx](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/components/StripePayment.tsx)
- Lines 23, 162: `const platformFee = 5.00;`

#### [components/RideCostCalculator.tsx](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/components/RideCostCalculator.tsx)
- Line 28: `const platformFee = 5.00;`

#### [components/RideControls.tsx](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/components/RideControls.tsx)
- Line 43: `const platformFee = 500;`

#### [components/RideCard.tsx](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/components/RideCard.tsx)
- Line 299: Uses `PLATFORM_FEE_DISPLAY` from `utils/price.ts`

#### [store/rides-store.ts](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/store/rides-store.ts)
- Line 147: `const platformFee = 500;`

#### [src/screens/BookingModal.tsx](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/src/screens/BookingModal.tsx)
- Line 52: `const platformFeeCents = 500;`

#### [src/components/CancellationModal.tsx](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/src/components/CancellationModal.tsx)
- Line 61: `const platformFeeCents = Math.round(amountCents * 0.1);`

---

## UI Locations Where Fee is Displayed

Update the display text in these locations:

| File | Line | Current Display |
|------|------|-----------------|
| `components/BookingModal.tsx` | 309 | "Platform fee" |
| `components/StripePayment.tsx` | 55, 175 | "Platform Fee: $5.00" |
| `components/RideCostCalculator.tsx` | 117 | "Platform Fee" |
| `components/RideControls.tsx` | 242 | "Platform Fee ($5)" |
| `src/screens/BookingModal.tsx` | 166 | "Platform fee ($5 flat)" |
| `app/search-rides.tsx` | 160 | "Platform fee: $X.XX" |
| `app/(tabs)/home.tsx` | 231 | "Platform fee: $X.XX" |

---

## Admin Dashboard Locations

#### [admin-dashboard/app/dashboard/rides/[id]/page.tsx](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/admin-dashboard/app/dashboard/rides/%5Bid%5D/page.tsx)
- Line 203: Displays "Platform Fee" in ride details

#### [admin-dashboard/app/dashboard/payments/page.tsx](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/admin-dashboard/app/dashboard/payments/page.tsx)
- Lines 76, 119: Displays platform fees in payment summary

---

## Email & Legal Text

#### [functions/src/utils/email.ts](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/functions/src/utils/email.ts)
- Line 116: "CarpoolConnect charges a flat $5.00 service fee"

#### [constants/legal-text.ts](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/constants/legal-text.ts)
- Line 51: "Passengers pay fares plus platform service fee"

#### [webapp/src/app/terms/page.tsx](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/webapp/src/app/terms/page.tsx)
- Lines 185, 188: Platform service fee mentioned in terms

---

## Testing

#### [__tests__/services/payment.test.ts](file:///c:/Users/Shrijan-Work/Documents/CarpoolConnect1.0/__tests__/services/payment.test.ts)
- Lines 56, 69, 80: Tests expect $5 flat fee - update these

---

## Recommended Approach

1. **Create a shared constants file** (`constants/platform-fees.ts`):
   ```typescript
   export const PLATFORM_FEE_FLAT_CENTS = 100;
   export const PLATFORM_FEE_PERCENTAGE = 0.05;
   
   export function calculatePlatformFee(ridePriceCents: number): number {
     return PLATFORM_FEE_FLAT_CENTS + Math.round(ridePriceCents * PLATFORM_FEE_PERCENTAGE);
   }
   ```

2. **Import everywhere** instead of hardcoding values

3. **Update functions/src/index.ts** to use the same calculation formula

4. **Update all UI components** to display dynamic fee

5. **Update email templates** and legal text

6. **Run all tests** and update expected values

---

## Stripe Fees Reference

For context, Stripe charges:
- **Australia**: 1.75% + A$0.30 per transaction
- **International**: 2.9% + A$0.30

Your platform fee should cover these costs plus your profit margin.

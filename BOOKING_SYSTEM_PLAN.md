# CarpoolConnect Booking System Architecture
## Complete Implementation Plan

---

**Date:** December 18, 2024  
**Version:** 1.0  
**Status:** Approved & Partially Implemented

---

## Table of Contents

1. [Overview](#overview)
2. [Ride Lifecycle](#ride-lifecycle)
3. [Booking Lifecycle](#booking-lifecycle)
4. [Business Rules Matrix](#business-rules-matrix)
5. [Payment Flow](#payment-flow)
6. [Error Messages](#error-messages)
7. [Implementation Checklist](#implementation-checklist)

---

## 1. Overview

This document defines the complete state machine for rides and bookings in CarpoolConnect, including all allowed transitions and business rules to ensure a robust, fail-safe booking system.

### Key Principles
- **Atomic operations**: All seat reservations use database transactions
- **Clear state transitions**: No ambiguous states
- **User-friendly errors**: Specific, actionable messages
- **Fail-safe defaults**: When in doubt, protect the user

---

## 2. Ride Lifecycle

```
                    ┌─────────────┐
                    │   CREATE    │
                    │    RIDE     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
              ┌─────│  UPCOMING   │─────┐
              │     └──────┬──────┘     │
              │            │            │
         [DELETE]    [START RIDE]   [CANCEL]
         (if no      (if has        (notify
         confirmed)  passengers)    all riders)
              │            │            │
              ▼            ▼            ▼
         ┌────────┐  ┌─────────┐  ┌──────────┐
         │DELETED │  │ ACTIVE  │  │CANCELLED │
         └────────┘  └────┬────┘  └──────────┘
                          │
                    [COMPLETE]
                          │
                          ▼
                    ┌──────────┐
                    │COMPLETED │
                    └──────────┘
```

### State Definitions

| State | Description | Allowed Actions |
|-------|-------------|-----------------|
| `upcoming` | Scheduled, waiting for departure | Edit, Delete (conditions apply), Cancel, Start |
| `active` | Ride in progress | Complete, Cancel (emergency) |
| `completed` | Ride finished successfully | None (readonly) |
| `cancelled` | Ride was cancelled | None (readonly) |

---

## 3. Booking Lifecycle

```
                    ┌─────────────┐
                    │   RIDER     │
                    │  REQUESTS   │
                    │   BOOKING   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────────┐
              ┌─────│ PENDING_DRIVER  │─────┐
              │     └────────┬────────┘     │
              │              │              │
        [DECLINE]      [ACCEPT]      [RIDER CANCELS]
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐  ┌───────────┐  ┌────────────────┐
        │ DECLINED │  │ CONFIRMED │  │CANCELLED_RIDER │
        └──────────┘  └─────┬─────┘  └────────────────┘
                            │
                      ┌─────┴─────┐
                      │           │
               [RIDE STARTS] [RIDER CANCELS]
                      │        (fee applies)
                      ▼           │
               ┌──────────┐       ▼
               │  ACTIVE  │  ┌────────────────┐
               └────┬─────┘  │CANCELLED_RIDER │
                    │        └────────────────┘
              ┌─────┴─────┐
              │           │
        [COMPLETE]   [NO-SHOW]
              │           │
              ▼           ▼
        ┌──────────┐ ┌─────────┐
        │COMPLETED │ │ NO_SHOW │
        └──────────┘ └─────────┘
```

### Booking Status Definitions

| Status | Description | Payment State |
|--------|-------------|---------------|
| `pending_driver` | Awaiting driver response | Payment method saved |
| `confirmed` | Driver accepted | Authorized (24h before) |
| `declined` | Driver rejected | Released |
| `cancelled_by_rider` | Rider cancelled | Fee may apply |
| `cancelled_by_driver` | Driver cancelled ride | Full refund |
| `active` | On the ride | Authorized |
| `completed` | Ride finished | Captured |
| `no_show` | Rider didn't show | Full charge |

---

## 4. Business Rules Matrix

### 4.1 Ride Edit Rules

| Condition | Editable Fields | Locked Fields |
|-----------|-----------------|---------------|
| No bookings | ALL | None |
| Pending bookings only | ALL | None |
| Has confirmed bookings | Notes, Available Seats | Route, Date, Time, Price |
| Ride started (active) | NONE | ALL |
| Ride completed | NONE | ALL |

**Implementation:**
```typescript
if (hasConfirmedBookings) {
  return {
    allowed: true,
    limitedEdit: true,
    editableFields: ['notes', 'availableSeats']
  };
}
```

### 4.2 Ride Delete Rules

| Condition | Can Delete? | Action |
|-----------|-------------|--------|
| No bookings | ✅ YES | Direct delete |
| Pending bookings only | ✅ YES | Auto-decline all pending |
| Has confirmed bookings | ❌ NO | Must CANCEL instead |
| Ride active/completed | ❌ NO | N/A |

### 4.3 Ride Cancel Rules

| Time Until Departure | Can Cancel? | Impact |
|---------------------|-------------|--------|
| > 24 hours | ✅ YES | Full refund to riders |
| < 24 hours | ⚠️ YES | Full refund + driver rating impact |
| Active ride | ⚠️ EMERGENCY | Full refund + driver flagged |

### 4.4 Booking Cancellation Fees (Rider)

| Time Until Departure | Fee |
|---------------------|-----|
| Pending status | $0 (no fee) |
| > 24 hours | 5% of total |
| 12-24 hours | 25% of total |
| < 12 hours | 50% of total |
| After departure | 100% (no refund) |

---

## 5. Payment Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        PAYMENT TIMELINE                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  BOOKING          24H BEFORE         RIDE START      COMPLETE   │  
│  CREATED          DEPARTURE          ─────────►      ─────────► │
│     │                 │                  │               │      │
│     ▼                 ▼                  ▼               ▼      │
│ ┌────────┐       ┌─────────┐        ┌────────┐     ┌─────────┐  │
│ │ Save   │       │Authorize│        │  Hold  │     │ Capture │  │
│ │Payment │       │ Payment │        │  Funds │     │ Payment │  │
│ │ Method │       │  $$$    │        │        │     │  $$$    │  │
│ └────────┘       └─────────┘        └────────┘     └─────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Payment States

| State | Stripe Status | User Display |
|-------|---------------|--------------|
| `payment_method_required` | SetupIntent created | "Add payment method" |
| `payment_method_saved` | SetupIntent succeeded | "Payment method saved" |
| `authorized` | PaymentIntent requires_capture | "Payment authorized" |
| `captured` | PaymentIntent succeeded | "Payment complete" |
| `refunded` | Refund created | "Refund processed" |
| `cancelled` | PaymentIntent cancelled | "Payment cancelled" |

---

## 6. Error Messages

### For Riders

| Scenario | Message |
|----------|---------|
| Already booked | "You already have a booking for this ride" |
| No seats | "No seats available on this ride" |
| Own ride | "You cannot book your own ride" |
| Ride started | "Cannot cancel - ride is in progress" |
| Past ride | "Cannot book rides that have already departed" |

### For Drivers

| Scenario | Message |
|----------|---------|
| Edit with confirmed | "Limited editing - passengers have confirmed. Cannot change date, time, route, or price." |
| Delete with confirmed | "Cannot delete ride with confirmed passengers. Cancel the ride instead to notify them and process refunds." |
| Cancel < 24h | "Cancelling within 24 hours may affect your driver rating. All passengers will receive full refunds." |

---

## 7. Implementation Checklist

### Frontend (React Native)

- [x] `utils/validation.ts` - Permission validation functions
- [x] `utils/ride-validation.ts` - Detailed validation helpers
- [x] `app/edit-ride.tsx` - Limited edit mode UI
- [x] `app/ride-details.tsx` - Delete validation
- [ ] `app/ride-details.tsx` - Cancel confirmation with warnings
- [ ] `components/BookingCard.tsx` - Cancellation fee display
- [ ] Cancellation fee calculator UI

### Backend (Cloud Functions)

- [ ] `deleteRide` - Enforce confirmed booking check
- [ ] `updateRide` - Enforce limited edit when confirmed
- [ ] `cancelRide` - Process refunds atomically
- [ ] `cancelBooking` - Calculate and apply fees
- [ ] Scheduled: `authorizeUpcomingPayments` (24h before)
- [ ] Webhook: Handle Stripe payment events

### Database (Firestore)

- [ ] Add `cancellationFee` field to bookings
- [ ] Add `driverRatingImpact` tracking
- [ ] Add `cancellationCount` to users

---

## Notes for Review

### Open Questions

1. **Cancellation fees destination**: Driver or platform?
2. **No-show threshold**: How long to wait before marking no-show?
3. **Rating impact**: How many late cancellations before action?
4. **Dispute process**: How to handle contested no-shows?

### Future Enhancements

- Push notifications for all state changes
- Email confirmations for bookings/cancellations
- Driver dashboard for bulk booking management
- Analytics for cancellation patterns

---

*End of Document*

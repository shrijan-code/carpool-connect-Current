# Stripe Test Cards for CarpoolConnect

This guide provides test card numbers for testing the CarpoolConnect payment system in Stripe's test mode.

> **Important**: These cards only work in **test mode**. Never use real card numbers in test mode.

---

## Quick Reference

| Scenario | Card Number | CVC | Expiry |
|----------|-------------|-----|--------|
| ✅ **Success (Visa)** | `4242 4242 4242 4242` | Any 3 digits | Any future date |
| ✅ **Success (Mastercard)** | `5555 5555 5555 4444` | Any 3 digits | Any future date |
| ❌ **Insufficient Funds** | `4000 0000 0000 9995` | Any 3 digits | Any future date |
| ❌ **Generic Decline** | `4000 0000 0000 0002` | Any 3 digits | Any future date |
| ❌ **Expired Card** | `4000 0000 0000 0069` | Any 3 digits | Any future date |

---

## Cards by Region

### Australia (Recommended for AUD Testing)

| Brand | Card Number | Notes |
|-------|-------------|-------|
| Visa (AU) | `4000 0003 6000 0006` | Australian card, tests AUD transactions |

### United States

| Brand | Card Number |
|-------|-------------|
| Visa | `4242 4242 4242 4242` |
| Mastercard | `5555 5555 5555 4444` |
| American Express | `3782 822463 10005` |
| Discover | `6011 1111 1111 1117` |

### International Cards (Cross-border fees may apply)

| Country | Card Number | Notes |
|---------|-------------|-------|
| UK | `4000 0082 6000 0000` | GBP - British Visa |
| Canada | `4000 0012 4000 0000` | CAD - Canadian Visa |
| Germany | `4000 0027 6000 0016` | EUR - German Visa |
| Japan | `4000 0039 2000 0003` | JPY - Japanese Visa |
| New Zealand | `4000 0055 4000 0008` | NZD - NZ Visa |

---

## Declined Payments

Use these cards to test error handling when payments fail.

| Failure Reason | Card Number | Error Code |
|----------------|-------------|------------|
| **Insufficient Funds** | `4000 0000 0000 9995` | `insufficient_funds` |
| **Generic Decline** | `4000 0000 0000 0002` | `generic_decline` |
| **Lost Card** | `4000 0000 0000 9987` | `lost_card` |
| **Stolen Card** | `4000 0000 0000 9979` | `stolen_card` |
| **Expired Card** | `4000 0000 0000 0069` | `expired_card` |
| **Incorrect CVC** | `4000 0000 0000 0127` | `incorrect_cvc` |
| **Processing Error** | `4000 0000 0000 0119` | `processing_error` |
| **Card Velocity Exceeded** | `4000 0000 0000 6975` | `card_velocity_exceeded` |

---

## 3D Secure Authentication

These cards test Strong Customer Authentication (SCA) scenarios.

| Scenario | Card Number | Notes |
|----------|-------------|-------|
| **3DS Required** | `4000 0027 6000 3184` | Authentication required |
| **3DS Always Authenticate** | `4000 0000 0000 3220` | Always passes 3DS |
| **3DS Authentication Fails** | `4000 0000 0000 3097` | Authentication fails |
| **3DS Not Supported** | `3782 822463 10005` | Falls back to non-3DS |

---

## Fraud Prevention (Radar)

Test how your integration handles fraud prevention.

| Scenario | Card Number | Notes |
|----------|-------------|-------|
| **Always Blocked** | `4100 0000 0000 0019` | Highest risk, always blocked |
| **Highest Risk** | `4000 0000 0000 4954` | May be blocked by Radar settings |
| **Elevated Risk** | `4000 0000 0000 9235` | Queued for review |
| **CVC Check Fails** | `4000 0000 0000 0101` | Use with any CVC to fail check |
| **Postal Code Fails** | `4000 0000 0000 0036` | Use with any postal code |

---

## Invalid Data (No Special Card Needed)

Test with any valid test card using these values:

| Issue | How to Test |
|-------|-------------|
| Invalid Month | Use month `13` |
| Invalid Year | Use past year like `20` |
| Invalid CVC | Use 2-digit CVC like `99` |
| Invalid Number | Use `4242 4242 4242 4241` (fails Luhn check) |

---

## Testing Scenarios in CarpoolConnect

### Test Booking with Valid Payment
1. Use card: `4242 4242 4242 4242`
2. CVC: `123`, Expiry: `12/26`
3. Expected: Booking created, payment authorized

### Test Booking with Insufficient Funds
1. Use card: `4000 0000 0000 9995`
2. CVC: `123`, Expiry: `12/26`
3. Expected: Booking rejected, "Insufficient funds" error

### Test Booking Cancellation (Refund)
1. Create booking with `4242 4242 4242 4242`
2. Cancel booking
3. Expected: PaymentIntent cancelled, funds released

### Test Ride Completion (Capture)
1. Book with valid card
2. Start and complete ride
3. Expected: Payment captured, funds transferred

---

## Resources

- [Stripe Testing Documentation](https://docs.stripe.com/testing)
- [Stripe Error Codes](https://docs.stripe.com/error-codes)
- [Stripe Decline Codes](https://docs.stripe.com/declines/codes)

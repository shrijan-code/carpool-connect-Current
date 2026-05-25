import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const FROM_EMAIL = 'CarryMate <noreply@carrymate.com.au>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn('Resend not configured, skipping email:', options.subject);
    return false;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    });
    return true;
  } catch (error) {
    console.error('Email send failed:', error);
    return false;
  }
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to CarryMate',
    html: `
      <h1>Welcome to CarryMate, ${name}!</h1>
      <p>Carry more. Share the journey.</p>
      <p>Get started by posting your first trip or finding a carrier for your delivery.</p>
      <p><a href="${APP_URL}/trips">Find a carrier</a> | <a href="${APP_URL}/trips/new">Post a trip</a></p>
    `,
  };
}

export function bookingRequestEmail(
  travellerName: string,
  route: string,
  senderName: string,
  itemDescription: string,
  price: number,
  bookingId: string
): { subject: string; html: string } {
  return {
    subject: `New delivery request for your ${route} trip`,
    html: `
      <h2>Hi ${travellerName},</h2>
      <p>${senderName} has requested a delivery on your ${route} trip.</p>
      <p><strong>Item:</strong> ${itemDescription}</p>
      <p><strong>Price:</strong> $${price.toFixed(2)} AUD</p>
      <p><a href="${APP_URL}/bookings/${bookingId}">View and respond</a></p>
    `,
  };
}

export function bookingAcceptedEmail(
  senderName: string,
  travellerName: string,
  bookingId: string
): { subject: string; html: string } {
  return {
    subject: `${travellerName} has accepted your delivery request`,
    html: `
      <h2>Hi ${senderName},</h2>
      <p>${travellerName} has accepted your delivery request. Please complete payment to confirm.</p>
      <p><a href="${APP_URL}/bookings/${bookingId}">Complete payment</a></p>
    `,
  };
}

export function paymentConfirmedEmail(
  name: string,
  bookingId: string,
  role: 'sender' | 'traveller'
): { subject: string; html: string } {
  return {
    subject: 'Payment confirmed — your delivery is booked',
    html: `
      <h2>Hi ${name},</h2>
      <p>Payment has been confirmed. Your delivery is now booked.</p>
      ${role === 'traveller' ? '<p>Please coordinate pickup details with the sender via in-app chat.</p>' : '<p>Your payment is held securely in escrow until delivery is confirmed.</p>'}
      <p><a href="${APP_URL}/bookings/${bookingId}">View booking</a></p>
    `,
  };
}

export function itemPickedUpEmail(
  recipientName: string,
  senderName: string,
  bookingId: string
): { subject: string; html: string } {
  return {
    subject: `${senderName} has sent you something via CarryMate`,
    html: `
      <h2>Hi ${recipientName},</h2>
      <p>${senderName} has sent you an item via CarryMate. Please create an account to confirm receipt when it arrives.</p>
      <p><a href="${APP_URL}/register">Create account</a></p>
      <p>Booking reference: ${bookingId}</p>
    `,
  };
}

export function deliveryConfirmedEmail(
  name: string,
  amount: number,
  role: 'sender' | 'traveller'
): { subject: string; html: string } {
  return {
    subject: role === 'traveller'
      ? `Delivery complete — $${amount.toFixed(2)} released to your account`
      : 'Delivery complete',
    html: `
      <h2>Hi ${name},</h2>
      <p>The delivery has been confirmed complete.</p>
      ${role === 'traveller' ? `<p>$${amount.toFixed(2)} AUD will be transferred to your Stripe account.</p>` : '<p>Thank you for using CarryMate!</p>'}
      <p>Please leave a rating for your experience.</p>
    `,
  };
}

export function bookingCancelledEmail(reason?: string): { subject: string; html: string } {
  return {
    subject: 'Booking cancelled — refund initiated',
    html: `
      <h2>Booking Cancelled</h2>
      <p>Your booking has been cancelled.${reason ? ` Reason: ${reason}` : ''}</p>
      <p>If payment was captured, a refund will be processed within 3-5 business days.</p>
    `,
  };
}

export function emergencyEmail(bookingId: string): { subject: string; html: string } {
  return {
    subject: 'URGENT — Emergency document generated',
    html: `
      <h2 style="color: red;">URGENT — Emergency Document Generated</h2>
      <p>An emergency police stop document was generated for booking ${bookingId}.</p>
      <p>Please review immediately in the admin dashboard.</p>
    `,
  };
}

export function paymentReminderEmail(bookingId: string): { subject: string; html: string } {
  return {
    subject: 'Reminder: Complete your payment within 1 hour',
    html: `
      <h2>Payment Reminder</h2>
      <p>You have 1 hour to complete your payment or your booking will be cancelled.</p>
      <p><a href="${APP_URL}/bookings/${bookingId}">Complete payment now</a></p>
    `,
  };
}

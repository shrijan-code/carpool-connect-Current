/**
 * Email Utility Module
 * Handles sending emails for various app events
 * Uses environment variables for email credentials
 */

import * as nodemailer from "nodemailer";

// Get email config from environment variables
// Set in Firebase console under Functions > Environment Variables
// Or via .env file for local development
const getEmailConfig = () => {
  return {
    user: process.env.EMAIL_USER || "",
    password: process.env.EMAIL_PASSWORD || "",
  };
};

// Create reusable transporter
const createTransporter = () => {
  const emailConfig = getEmailConfig();

  if (!emailConfig.user || !emailConfig.password) {
    console.warn("Email credentials not configured. Emails will not be sent.");
    console.warn("Set EMAIL_USER and EMAIL_PASSWORD environment variables in Firebase console.");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailConfig.user,
      pass: emailConfig.password,
    },
  });
};

// Email templates
const templates = {
  welcome: (userName: string) => ({
    subject: "🚗 Welcome to CarpoolConnect!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">Welcome to CarpoolConnect! 🎉</h1>
        <p>Hi ${userName},</p>
        <p>Thank you for joining CarpoolConnect! We're excited to have you as part of our community.</p>
        <h3>What you can do:</h3>
        <ul>
          <li>🚘 <strong>Offer rides</strong> - Share your journey and earn money</li>
          <li>🎫 <strong>Book rides</strong> - Find affordable rides to your destination</li>
          <li>📦 <strong>Send packages</strong> - Deliver items with trusted drivers</li>
        </ul>
        <p>Start exploring rides in your area today!</p>
        <p>Safe travels,<br/>The CarpoolConnect Team</p>
      </div>
    `,
  }),

  rideConfirmation: (driverName: string, rideDetails: any) => ({
    subject: "✅ Ride Created Successfully - Important Information",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin-bottom: 20px;">
          <h1 style="color: white; margin: 0;">🚗 Ride Created Successfully!</h1>
        </div>
        
        <p style="font-size: 16px;">Hi ${driverName},</p>
        <p>Your ride has been posted on CarpoolConnect! Here are your ride details:</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: #4F46E5; margin-top: 0;">Ride Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>From:</strong></td>
              <td style="padding: 8px 0;">${rideDetails.origin || rideDetails.from}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>To:</strong></td>
              <td style="padding: 8px 0;">${rideDetails.destination || rideDetails.to}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>Departure:</strong></td>
              <td style="padding: 8px 0;">${rideDetails.departureTime || rideDetails.date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>Available Seats:</strong></td>
              <td style="padding: 8px 0;">${rideDetails.seatsAvailable || rideDetails.seats}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>Price per Seat:</strong></td>
              <td style="padding: 8px 0; font-size: 18px; color: #10B981;"><strong>$${rideDetails.pricePerSeat || rideDetails.price}</strong></td>
            </tr>
          </table>
        </div>

        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #92400E;"><strong>📱 What happens next?</strong></p>
          <ul style="color: #92400E; margin: 10px 0;">
            <li>Passengers can now see and book your ride</li>
            <li>You'll receive notifications when someone requests to book</li>
            <li>Review and accept/reject booking requests in the app</li>
            <li>Communicate with passengers through in-app messaging</li>
          </ul>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #E5E7EB;">
          <h3 style="color: #4F46E5;">📜 Terms & Conditions</h3>
          <div style="font-size: 13px; color: #6B7280; line-height: 1.6;">
            <p><strong>By offering this ride, you agree to:</strong></p>
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Safety First:</strong> Drive safely and follow all traffic laws. Ensure your vehicle is in good working condition.</li>
              <li><strong>Valid Documentation:</strong> Maintain a valid driver's license, vehicle registration, and insurance.</li>
              <li><strong>Passenger Respect:</strong> Treat all passengers with respect and professionalism.</li>
              <li><strong>Seat Accuracy:</strong> Only accept bookings up to your stated available seats.</li>
              <li><strong>Timely Departure:</strong> Arrive on time and notify passengers of any delays or changes.</li>
              <li><strong>Platform Fees:</strong> CarpoolConnect charges a flat $5.00 service fee on completed rides for payment processing and platform maintenance.</li>
              <li><strong>Cancellation Policy:</strong> Cancel rides at least 2 hours before departure to avoid penalties. Late cancellations may affect your driver rating.</li>
              <li><strong>No Discrimination:</strong> Accept passengers without discrimination based on race, religion, gender, age, or disability.</li>
              <li><strong>Prohibited Activities:</strong> Smoking, alcohol, or drugs are strictly prohibited during rides.</li>
              <li><strong>Liability:</strong> You are responsible for the safety of passengers during the ride. CarpoolConnect is not liable for accidents, injuries, or damages.</li>
            </ol>
            
            <p style="margin-top: 20px;"><strong>Payment & Earnings:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Payments are processed through Stripe after ride completion</li>
              <li>Funds are transferred to your account within 2-7 business days</li>
              <li>Set up Stripe Connect in your profile to receive payments</li>
              <li>Keep receipts for tax purposes - you're responsible for reporting earnings</li>
            </ul>

            <p style="margin-top: 20px;"><strong>Cancellation Rights:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Passengers can cancel up to 4 hours before departure</li>
              <li>You may cancel a ride with reasonable notice</li>
              <li>Repeated cancellations may result in account suspension</li>
            </ul>

            <p style="margin-top: 20px; font-size: 11px; color: #9CA3AF;">
              By continuing to use CarpoolConnect, you acknowledge that you have read, understood, and agree to our 
              <a href="https://carpoolconnect.com/terms" style="color: #4F46E5;">Terms of Service</a> and 
              <a href="https://carpoolconnect.com/privacy" style="color: #4F46E5;">Privacy Policy</a>.
            </p>
          </div>
        </div>

        <div style="background: #EFF6FF; padding: 20px; border-radius: 10px; margin: 30px 0;">
          <p style="margin: 0; color: #1E40AF;"><strong>💡 Pro Tips for Drivers:</strong></p>
          <ul style="color: #1E40AF; margin: 10px 0;">
            <li>Respond to booking requests quickly to improve your rating</li>
            <li>Keep your vehicle clean and comfortable</li>
            <li>Confirm pickup location with passengers before departure</li>
            <li>Use the in-app chat to coordinate with passengers</li>
            <li>Complete your Stripe setup to receive payments seamlessly</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
          <p style="color: #6B7280;">Need help? Contact us at <a href="mailto:support@carpoolconnect.com" style="color: #4F46E5;">support@carpoolconnect.com</a></p>
          <p style="color: #6B7280; margin-top: 20px;">Safe travels,<br/><strong>The CarpoolConnect Team</strong></p>
        </div>
      </div>
    `,
  }),

  newBookingRequest: (driverName: string, riderName: string, rideDetails: any) => ({
    subject: "🚗 New Booking Request!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">New Booking Request! 🚗</h1>
        <p>Hi ${driverName},</p>
        <p>Great news! <strong>${riderName}</strong> wants to book a seat on your ride.</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Ride Details</h3>
          <p><strong>From:</strong> ${rideDetails.origin || rideDetails.from || "Origin"}</p>
          <p><strong>To:</strong> ${rideDetails.destination || rideDetails.to || "Destination"}</p>
          <p><strong>Date:</strong> ${rideDetails.departureTime || rideDetails.date || "As scheduled"}</p>
          <p><strong>Seats Requested:</strong> ${rideDetails.seats || 1}</p>
        </div>
        <div style="background: #FEF3C7; padding: 15px; border-radius: 10px; margin: 20px 0;">
          <p style="margin: 0; color: #92400E;"><strong>⏰ Action Required</strong></p>
          <p style="margin: 10px 0 0 0; color: #92400E;">Please open the app to accept or decline this booking request.</p>
        </div>
        <p>Safe travels,<br/>The CarpoolConnect Team</p>
      </div>
    `,
  }),

  bookingAccepted: (passengerName: string, driverName: string, rideDetails: any) => ({
    subject: "✅ Your ride is confirmed!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10B981;">Ride Confirmed! ✅</h1>
        <p>Hi ${passengerName},</p>
        <p>Great news! <strong>${driverName}</strong> has accepted your ride request.</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Ride Details</h3>
          <p><strong>From:</strong> ${rideDetails.origin || "Pickup location"}</p>
          <p><strong>To:</strong> ${rideDetails.destination || "Drop-off location"}</p>
          <p><strong>Date:</strong> ${rideDetails.date || "As scheduled"}</p>
          <p><strong>Price:</strong> $${rideDetails.price || "0"}</p>
        </div>
        <p>The driver will contact you with more details. Have a safe trip!</p>
        <p>Best,<br/>The CarpoolConnect Team</p>
      </div>
    `,
  }),

  bookingRejected: (passengerName: string, origin: string, destination: string) => ({
    subject: "Ride request update",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #F59E0B;">Ride Request Update</h1>
        <p>Hi ${passengerName},</p>
        <p>Unfortunately, the driver couldn't accept your ride request from <strong>${origin}</strong> to <strong>${destination}</strong>.</p>
        <p>Don't worry! There are plenty of other drivers available. Check the app for alternative rides.</p>
        <p>Keep searching,<br/>The CarpoolConnect Team</p>
      </div>
    `,
  }),

  bookingRequestSent: (riderName: string, rideDetails: any, driverName: string) => ({
    subject: "🚗 Your Booking Request Has Been Sent!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">Booking Request Sent! 🚗</h1>
        <p>Hi ${riderName},</p>
        <p>Great news! Your booking request has been sent to <strong>${driverName}</strong>.</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Ride Details</h3>
          <p><strong>From:</strong> ${rideDetails.origin || "Origin"}</p>
          <p><strong>To:</strong> ${rideDetails.destination || "Destination"}</p>
          <p><strong>Date:</strong> ${rideDetails.departureTime || "As scheduled"}</p>
          <p><strong>Seats Requested:</strong> ${rideDetails.seats || 1}</p>
        </div>
        <div style="background: #EFF6FF; padding: 15px; border-radius: 10px; margin: 20px 0;">
          <p style="margin: 0; color: #1E40AF;"><strong>⏳ What happens next?</strong></p>
          <ul style="color: #1E40AF; margin: 10px 0;">
            <li>The driver will review your request</li>
            <li>You'll receive a notification when they respond</li>
            <li>Your payment will only be charged if the driver accepts</li>
          </ul>
        </div>
        <p>You can view your booking status in the app at any time.</p>
        <p>Safe travels,<br/>The CarpoolConnect Team</p>
      </div>
    `,
  }),

  bookingCancelled: (userName: string, cancelledBy: string, rideDetails: any, paymentInfo?: {
    originalAmount: number;
    refundAmount: number;
    cancellationFee: number;
    driverCompensation: number;
    platformFeeRetained: number;
    hoursBeforeDeparture: number;
    refundPercentage: number;
  }) => ({
    subject: `🚫 Booking Cancelled - ${cancelledBy === 'driver' ? 'Full Refund' : paymentInfo?.refundPercentage === 100 ? 'Full Refund' : 'Important Payment Information'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 30px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🚫 Booking Cancelled</h1>
        </div>
        
        <p style="font-size: 16px;">Hi ${userName},</p>
        <p>Your booking has been cancelled by the <strong>${cancelledBy}</strong>.</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: #1F2937; margin-top: 0; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px;">🚗 Ride Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>From:</strong></td>
              <td style="padding: 8px 0;">${rideDetails.origin || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>To:</strong></td>
              <td style="padding: 8px 0;">${rideDetails.destination || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>Scheduled:</strong></td>
              <td style="padding: 8px 0;">${rideDetails.departureTime || 'N/A'}</td>
            </tr>
            ${rideDetails.seats ? `
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>Seats:</strong></td>
              <td style="padding: 8px 0;">${rideDetails.seats}</td>
            </tr>
            ` : ''}
            ${rideDetails.reason ? `
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>Reason:</strong></td>
              <td style="padding: 8px 0;">${rideDetails.reason}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        ${paymentInfo ? `
        <div style="background: ${paymentInfo.refundPercentage === 100 ? '#DCFCE7' : paymentInfo.refundPercentage >= 50 ? '#FEF3C7' : '#FEE2E2'}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${paymentInfo.refundPercentage === 100 ? '#22C55E' : paymentInfo.refundPercentage >= 50 ? '#F59E0B' : '#EF4444'};">
          <h2 style="color: ${paymentInfo.refundPercentage === 100 ? '#166534' : paymentInfo.refundPercentage >= 50 ? '#92400E' : '#991B1B'}; margin-top: 0;">💰 Payment Summary</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>Original Booking Amount:</strong></td>
              <td style="padding: 8px 0; text-align: right;">$${(paymentInfo.originalAmount / 100).toFixed(2)}</td>
            </tr>
            <tr style="border-top: 1px solid ${paymentInfo.refundPercentage === 100 ? '#86EFAC' : paymentInfo.refundPercentage >= 50 ? '#FCD34D' : '#FECACA'};">
              <td style="padding: 8px 0; color: #166534;"><strong>✅ Refund Amount:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: #166534; font-size: 18px;"><strong>$${(paymentInfo.refundAmount / 100).toFixed(2)}</strong></td>
            </tr>
            ${paymentInfo.cancellationFee > 0 ? `
            <tr>
              <td style="padding: 8px 0; color: #991B1B;"><strong>Cancellation Fee:</strong></td>
              <td style="padding: 8px 0; text-align: right; color: #991B1B;">$${(paymentInfo.cancellationFee / 100).toFixed(2)}</td>
            </tr>
            ` : ''}
          </table>
          
          <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid ${paymentInfo.refundPercentage === 100 ? '#86EFAC' : paymentInfo.refundPercentage >= 50 ? '#FCD34D' : '#FECACA'};">
            <p style="margin: 0; font-size: 14px; color: ${paymentInfo.refundPercentage === 100 ? '#166534' : paymentInfo.refundPercentage >= 50 ? '#92400E' : '#991B1B'};">
              <strong>Refund Percentage: ${paymentInfo.refundPercentage}%</strong>
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #6B7280;">
              ${paymentInfo.hoursBeforeDeparture > 24
          ? '✅ Early cancellation (>24 hours before departure) - Full refund including platform fee applied.'
          : paymentInfo.hoursBeforeDeparture > 0
            ? '⚠️ Late cancellation (<24 hours before departure) - 50% cancellation fee applied per our policy.'
            : '❌ Cancellation after departure time - No refund available per our policy.'}
            </p>
          </div>
        </div>
        ` : ''}

        <div style="background: #EFF6FF; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #3B82F6;">
          <h3 style="color: #1E40AF; margin-top: 0;">📋 Our Cancellation Policy</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px; background: #DCFCE7; border-radius: 5px;"><strong>More than 24 hours before departure</strong></td>
              <td style="padding: 8px; background: #DCFCE7; border-radius: 5px; text-align: right; color: #166534;"><strong>100% refund</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #FEF3C7; border-radius: 5px;"><strong>Less than 24 hours before departure</strong></td>
              <td style="padding: 8px; background: #FEF3C7; border-radius: 5px; text-align: right; color: #92400E;"><strong>50% refund</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #FEE2E2; border-radius: 5px;"><strong>After departure time</strong></td>
              <td style="padding: 8px; background: #FEE2E2; border-radius: 5px; text-align: right; color: #991B1B;"><strong>No refund</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #DCFCE7; border-radius: 5px;"><strong>Driver cancels</strong></td>
              <td style="padding: 8px; background: #DCFCE7; border-radius: 5px; text-align: right; color: #166534;"><strong>100% refund (always)</strong></td>
            </tr>
          </table>
        </div>

        <div style="background: #F9FAFB; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #1F2937; margin-top: 0;">📲 What Happens Next?</h3>
          ${cancelledBy === 'driver' ? `
          <ul style="color: #374151; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
            <li>You will receive a <strong>full refund</strong> to your original payment method</li>
            <li>Refunds typically process within <strong>5-10 business days</strong></li>
            <li>We recommend searching for alternative rides in the app</li>
            <li>You can view your booking history in Profile → My Bookings</li>
          </ul>
          ` : `
          <ul style="color: #374151; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
            ${paymentInfo && paymentInfo.refundAmount > 0 ? `
            <li>Your refund of <strong>$${(paymentInfo.refundAmount / 100).toFixed(2)}</strong> will be processed to your original payment method</li>
            <li>Refunds typically process within <strong>5-10 business days</strong></li>
            ` : ''}
            ${paymentInfo && paymentInfo.cancellationFee > 0 ? `
            <li>The cancellation fee of <strong>$${(paymentInfo.cancellationFee / 100).toFixed(2)}</strong> helps compensate the driver</li>
            ` : ''}
            <li>You can view your booking and payment history in Profile → My Bookings</li>
          </ul>
          `}
        </div>

        ${cancelledBy !== 'driver' ? `
        <div style="background: #FEF2F2; padding: 15px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #EF4444;">
          <p style="margin: 0; color: #991B1B; font-size: 14px;">
            <strong>💡 Tip:</strong> To avoid cancellation fees, please cancel at least 24 hours before your scheduled departure time.
          </p>
        </div>
        ` : ''}

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #E5E7EB;">
          <p style="color: #6B7280;">Questions about this cancellation? Contact us at <a href="mailto:support@carpoolconnect.com" style="color: #4F46E5;">support@carpoolconnect.com</a></p>
          <p style="color: #6B7280; margin-top: 20px;">Best regards,<br/><strong>The CarpoolConnect Team</strong></p>
        </div>
      </div>
    `,
  }),

  rideCompleted: (userName: string, rideDetails: any, isDriver: boolean) => ({
    subject: "🎉 Ride completed - Thanks for riding!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10B981;">Ride Completed! 🎉</h1>
        <p>Hi ${userName},</p>
        <p>Your ride from <strong>${rideDetails.origin}</strong> to <strong>${rideDetails.destination}</strong> has been completed.</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Trip Summary</h3>
          <p><strong>Total:</strong> $${rideDetails.price || "0"}</p>
        </div>
        <p><strong>Please rate your ${isDriver ? "passenger" : "driver"}!</strong> Your feedback helps our community.</p>
        <p>Thanks for using CarpoolConnect!</p>
        <p>Best,<br/>The CarpoolConnect Team</p>
      </div>
    `,
  }),

  paymentSuccess: (userName: string, amount: number, bookingId: string) => ({
    subject: "💳 Payment confirmed",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10B981;">Payment Successful! 💳</h1>
        <p>Hi ${userName},</p>
        <p>Your payment has been processed successfully.</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Payment Receipt</h3>
          <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        <p>Thank you for using CarpoolConnect!</p>
        <p>Best,<br/>The CarpoolConnect Team</p>
      </div>
    `,
  }),

  paymentFailed: (userName: string, amount: number) => ({
    subject: "⚠️ Payment issue - Action required",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #EF4444;">Payment Failed ⚠️</h1>
        <p>Hi ${userName},</p>
        <p>We couldn't process your payment of <strong>$${amount.toFixed(2)}</strong>.</p>
        <h3>What to do:</h3>
        <ul>
          <li>Check your card details are correct</li>
          <li>Ensure you have sufficient funds</li>
          <li>Try a different payment method</li>
        </ul>
        <p>Please try again in the app or contact support if the issue persists.</p>
        <p>Best,<br/>The CarpoolConnect Team</p>
      </div>
    `,
  }),

  rideReminder: (userName: string, rideDetails: any, isDriver: boolean) => ({
    subject: "⏰ Your ride is in 1 hour!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">Ride Reminder ⏰</h1>
        <p>Hi ${userName},</p>
        <p>Your ride is starting in <strong>1 hour</strong>!</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Ride Details</h3>
          <p><strong>From:</strong> ${rideDetails.origin}</p>
          <p><strong>To:</strong> ${rideDetails.destination}</p>
          ${isDriver ? "<p><strong>Passengers are counting on you!</strong></p>" : "<p><strong>Be ready at the pickup point!</strong></p>"}
        </div>
        <p>Have a safe trip!</p>
        <p>Best,<br/>The CarpoolConnect Team</p>
      </div>
    `,
  }),

  safetyReport: (reportDetails: any, reporterInfo: any, emergencyContactInfo: any) => {
    const severityColors: Record<string, string> = {
      low: '#28a745',
      medium: '#ffc107',
      high: '#fd7e14',
      critical: '#dc3545',
    };
    const severityColor = severityColors[reportDetails.severity] || '#6c757d';
    const severityLabels: Record<string, string> = {
      low: 'Low Priority',
      medium: 'Medium Priority',
      high: 'High Priority - Urgent',
      critical: 'CRITICAL - IMMEDIATE ACTION REQUIRED',
    };
    const severityLabel = severityLabels[reportDetails.severity] || 'Unknown';

    return {
      subject: `🚨 SAFETY REPORT [${severityLabel}] - ${reportDetails.type}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background: ${severityColor}; padding: 30px; border-radius: 10px; margin-bottom: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🚨 SAFETY REPORT SUBMITTED</h1>
            <div style="background: white; color: ${severityColor}; padding: 10px 20px; border-radius: 20px; display: inline-block; margin-top: 15px; font-weight: bold; font-size: 18px;">
              ${severityLabel}
            </div>
          </div>

          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
            <p style="margin: 0; color: #856404; font-weight: bold;">⚠️ This report requires immediate attention and investigation</p>
          </div>

          <div style="background: #F3F4F6; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
            <h2 style="color: #1F2937; margin-top: 0; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px;">📋 Report Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #6B7280; width: 180px;"><strong>Report ID:</strong></td>
                <td style="padding: 10px 0; font-family: monospace; background: #E5E7EB; padding: 5px 10px; border-radius: 4px;">${reportDetails.id}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6B7280;"><strong>Type:</strong></td>
                <td style="padding: 10px 0;">${reportDetails.typeLabel}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6B7280;"><strong>Severity:</strong></td>
                <td style="padding: 10px 0; color: ${severityColor}; font-weight: bold;">${severityLabel}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6B7280;"><strong>Timestamp:</strong></td>
                <td style="padding: 10px 0;">${reportDetails.timestamp}</td>
              </tr>
              ${reportDetails.rideId ? `
              <tr>
                <td style="padding: 10px 0; color: #6B7280;"><strong>Ride ID:</strong></td>
                <td style="padding: 10px 0; font-family: monospace;">${reportDetails.rideId}</td>
              </tr>
              ` : ''}
              ${reportDetails.deliveryId ? `
              <tr>
                <td style="padding: 10px 0; color: #6B7280;"><strong>Delivery ID:</strong></td>
                <td style="padding: 10px 0; font-family: monospace;">${reportDetails.deliveryId}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <div style="background: #FEF2F2; padding: 25px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #DC2626;">
            <h3 style="color: #DC2626; margin-top: 0;">📝 Description</h3>
            <p style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${reportDetails.description}</p>
          </div>

          <div style="background: #EFF6FF; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
            <h2 style="color: #1E40AF; margin-top: 0; border-bottom: 2px solid #BFDBFE; padding-bottom: 10px;">👤 Reporter Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #6B7280; width: 180px;"><strong>Reporter ID:</strong></td>
                <td style="padding: 10px 0; font-family: monospace;">${reporterInfo.id}</td>
              </tr>
              ${reporterInfo.name ? `
              <tr>
                <td style="padding: 10px 0; color: #6B7280;"><strong>Name:</strong></td>
                <td style="padding: 10px 0;">${reporterInfo.name}</td>
              </tr>
              ` : ''}
              ${reporterInfo.email ? `
              <tr>
                <td style="padding: 10px 0; color: #6B7280;"><strong>Email:</strong></td>
                <td style="padding: 10px 0;"><a href="mailto:${reporterInfo.email}" style="color: #4F46E5;">${reporterInfo.email}</a></td>
              </tr>
              ` : ''}
              ${reporterInfo.phone ? `
              <tr>
                <td style="padding: 10px 0; color: #6B7280;"><strong>Phone:</strong></td>
                <td style="padding: 10px 0;"><a href="tel:${reporterInfo.phone}" style="color: #4F46E5;">${reporterInfo.phone}</a></td>
              </tr>
              ` : ''}
            </table>
          </div>

          ${emergencyContactInfo ? `
          <div style="background: #FEF3C7; padding: 25px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #F59E0B;">
            <h2 style="color: #92400E; margin-top: 0; border-bottom: 2px solid #FCD34D; padding-bottom: 10px;">🚨 Emergency Contact Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #78350F; width: 180px;"><strong>Contact Name:</strong></td>
                <td style="padding: 10px 0; font-weight: 600;">${emergencyContactInfo.name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #78350F;"><strong>Phone:</strong></td>
                <td style="padding: 10px 0;"><a href="tel:${emergencyContactInfo.phone}" style="color: #92400E; font-weight: bold; font-size: 16px;">${emergencyContactInfo.phone}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #78350F;"><strong>Relationship:</strong></td>
                <td style="padding: 10px 0;">${emergencyContactInfo.relationship}</td>
              </tr>
            </table>
          </div>
          ` : `
          <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
            <p style="color: #6B7280; margin: 0;"><em>ℹ️ No emergency contact information available for this user</em></p>
          </div>
          `}

          ${reportDetails.evidencePhotos && reportDetails.evidencePhotos.length > 0 ? `
          <div style="background: #F3F4F6; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
            <h3 style="color: #1F2937; margin-top: 0;">📸 Evidence Photos</h3>
            <p style="color: #6B7280;">${reportDetails.evidencePhotos.length} photo(s) attached to this report:</p>
            <ul style="color: #4F46E5; margin: 10px 0; padding-left: 20px;">
              ${reportDetails.evidencePhotos.map((url: string, index: number) =>
        `<li><a href="${url}" style="color: #4F46E5;">View Photo ${index + 1}</a></li>`
      ).join('')}
            </ul>
          </div>
          ` : ''}

          <div style="background: #1F2937; color: white; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
            <h3 style="color: white; margin-top: 0;">✅ Recommended Actions</h3>
            <ol style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
              <li>Review the report details and severity level immediately</li>
              <li>Contact the reporter if additional information is needed</li>
              <li>Contact emergency contact if the situation is critical</li>
              <li>Access the full report in Firebase Console for complete details</li>
              <li>Update the report status in the database as investigation progresses</li>
              <li>Document all actions taken in response to this report</li>
              ${reportDetails.severity === 'critical' ? '<li style="color: #FCA5A5; font-weight: bold;">⚠️ FOR CRITICAL REPORTS: Consider immediate escalation to authorities</li>' : ''}
            </ol>
          </div>

          <div style="text-align: center; padding: 20px; background: #EFF6FF; border-radius: 10px;">
            <p style="color: #1E40AF; margin: 0 0 15px 0; font-weight: bold;">Quick Access Links</p>
            <a href="https://console.firebase.google.com/project/carpoolconnect1-0/firestore/data/~2Fsafety_reports~2F${reportDetails.id}" 
               style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin: 5px;">
              View in Firebase Console
            </a>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #E5E7EB;">
            <p style="color: #6B7280; font-size: 14px; margin: 0;">This is an automated safety alert from CarpoolConnect</p>
            <p style="color: #9CA3AF; font-size: 12px; margin: 10px 0 0 0;">Report generated at ${reportDetails.timestamp}</p>
          </div>
        </div>
      `,
    };
  },

  safetyReportConfirmation: (reporterName: string, reportDetails: any) => {
    const severityColors: Record<string, string> = {
      low: '#28a745',
      medium: '#ffc107',
      high: '#fd7e14',
      critical: '#dc3545',
    };
    const severityColor = severityColors[reportDetails.severity] || '#6c757d';
    const severityLabels: Record<string, string> = {
      low: 'Low Priority',
      medium: 'Medium Priority',
      high: 'High Priority',
      critical: 'Critical',
    };
    const severityLabel = severityLabels[reportDetails.severity] || 'Unknown';

    return {
      subject: `Safety Report Submitted - Reference: ${reportDetails.id.slice(-8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin-bottom: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Safety Report Submitted</h1>
          </div>

          <p style="font-size: 16px; color: #374151;">Hi ${reporterName},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            Thank you for submitting your safety report. We take all safety concerns seriously and will review your report promptly.
          </p>

          <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 25px 0;">
            <h3 style="color: #1F2937; margin-top: 0; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px;">Report Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280; width: 150px;"><strong>Reference ID:</strong></td>
                <td style="padding: 8px 0; font-family: monospace; background: #E5E7EB; padding: 5px 10px; border-radius: 4px;">${reportDetails.id.slice(-8)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;"><strong>Type:</strong></td>
                <td style="padding: 8px 0;">${reportDetails.typeLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;"><strong>Severity:</strong></td>
                <td style="padding: 8px 0; color: ${severityColor}; font-weight: bold;">${severityLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;"><strong>Submitted:</strong></td>
                <td style="padding: 8px 0;">${reportDetails.timestamp}</td>
              </tr>
            </table>
          </div>

          <div style="background: #EFF6FF; padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #4F46E5;">
            <h3 style="color: #1E40AF; margin-top: 0;">📝 Your Description</h3>
            <p style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${reportDetails.description}</p>
          </div>

          ${reportDetails.severity === 'critical' || reportDetails.severity === 'high' ? `
          <div style="background: #FEF2F2; padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #DC2626;">
            <p style="color: #DC2626; margin: 0; font-weight: bold;">⚠️ Important Safety Reminder</p>
            <p style="color: #991B1B; margin-top: 10px; line-height: 1.6;">
              If you are in immediate danger, please call emergency services (000) right away. 
              Do not wait for our response.
            </p>
          </div>
          ` : ''}

          <div style="background: #F9FAFB; padding: 20px; border-radius: 10px; margin: 25px 0;">
            <h3 style="color: #1F2937; margin-top: 0;">What Happens Next?</h3>
            <ul style="color: #374151; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
              <li>Our safety team will review your report within 24-48 hours</li>
              <li>We may contact you if we need additional information</li>
              <li>Appropriate action will be taken based on the severity and nature of the report</li>
              <li>You can view your report status in the app under Profile → Safety</li>
            </ul>
          </div>

          ${reportDetails.evidencePhotos && reportDetails.evidencePhotos.length > 0 ? `
          <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 25px 0;">
            <h3 style="color: #1F2937; margin-top: 0;">📸 Evidence Photos</h3>
            <p style="color: #6B7280;">${reportDetails.evidencePhotos.length} photo(s) attached to your report:</p>
            <ul style="color: #4F46E5; margin: 10px 0; padding-left: 20px;">
              ${reportDetails.evidencePhotos.map((url: string, index: number) =>
        `<li><a href="${url}" style="color: #4F46E5;">View Photo ${index + 1}</a></li>`
      ).join('')}
            </ul>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #E5E7EB;">
            <p style="color: #6B7280; margin: 0; line-height: 1.6;">
              If you have any questions or concerns, please don't hesitate to contact us.
            </p>
            <p style="color: #6B7280; margin: 10px 0 0 0;">
              <strong>CarpoolConnect Safety Team</strong><br/>
              Email: <a href="mailto:support@carpoolconnect.com" style="color: #4F46E5;">support@carpoolconnect.com</a>
            </p>
          </div>

          <div style="text-align: center; margin-top: 20px;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              This is an automated confirmation email. Please do not reply directly to this message.
            </p>
          </div>
        </div>
      `,
    };
  },

  // Email to admin when driver submits documents for approval
  driverDocumentSubmission: (driverInfo: { name: string; email: string; userId: string }, documentTypes: string[]) => ({
    subject: "🚗 Driver Document Review Required - CarpoolConnect",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin-bottom: 20px;">
          <h1 style="color: white; margin: 0;">📋 New Driver Document Submission</h1>
        </div>
        
        <p style="font-size: 16px;">A driver has submitted documents for review and approval.</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: #4F46E5; margin-top: 0;">Driver Information</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>Name:</strong></td>
              <td style="padding: 8px 0;">${driverInfo.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>Email:</strong></td>
              <td style="padding: 8px 0;">${driverInfo.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;"><strong>User ID:</strong></td>
              <td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${driverInfo.userId}</td>
            </tr>
          </table>
        </div>

        <div style="background: #DBEAFE; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #1E40AF; margin-top: 0;">📄 Documents Submitted</h3>
          <ul style="color: #1E40AF; margin: 10px 0; padding-left: 20px;">
            ${documentTypes.map(doc => `<li style="margin: 5px 0;">${doc}</li>`).join('')}
          </ul>
        </div>

        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #92400E;"><strong>⚠️ Action Required</strong></p>
          <p style="color: #92400E; margin: 10px 0 0 0;">
            Please log in to the Admin Dashboard to review the submitted documents and approve or reject the driver's application.
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #6B7280; font-size: 12px;">
            This is an automated notification from CarpoolConnect.
          </p>
        </div>
      </div>
    `,
  }),

  // Email when evidence photos are uploaded to a safety report
  safetyReportEvidenceAdded: (data: { reportId: string; type: string; severity: string; photos: string[]; html: string }) => ({
    subject: `📸 Evidence Photos Added - Safety Report ${data.reportId.slice(-8)}`,
    html: data.html,
  }),
};

// Send email function
export const sendEmail = async (
  to: string,
  templateName: keyof typeof templates,
  templateData: any[]
): Promise<boolean> => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.log(`Email not sent (no credentials configured): ${templateName} to ${to}`);
      return false;
    }

    const emailConfig = getEmailConfig();
    const template = (templates[templateName] as Function)(...templateData);

    await transporter.sendMail({
      from: `"CarpoolConnect" <${emailConfig.user}>`,
      to,
      subject: template.subject,
      html: template.html,
    });

    console.log(`Email sent successfully: ${templateName} to ${to}`);
    return true;
  } catch (error) {
    console.error(`Failed to send email: ${templateName} to ${to}`, error);
    return false;
  }
};

export { templates };

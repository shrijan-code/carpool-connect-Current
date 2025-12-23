import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// ============================================================================
// CONFIGURATION - Update these values or use environment variables
// ============================================================================

const EMAIL_CONFIG = {
    // Gmail SMTP settings (can be changed to Microsoft 365 - see README)
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'shrijan.bhandari1318@gmail.com',
        pass: process.env.EMAIL_PASSWORD || '',
    },
};

// Where to send contact form submissions
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'shrijan.bhandari1318@gmail.com';

// ============================================================================
// RATE LIMITING (Simple in-memory - for production use Redis)
// ============================================================================

const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 5; // Max requests
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const record = rateLimit.get(ip);

    if (!record || now > record.resetTime) {
        rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }

    if (record.count >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0 };
    }

    record.count++;
    return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

// ============================================================================
// INPUT VALIDATION & SANITIZATION
// ============================================================================

function sanitizeInput(input: string): string {
    return input
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .slice(0, 5000); // Max length
}

function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
}

interface ContactFormData {
    name: string;
    email: string;
    subject: string;
    message: string;
    honeypot?: string; // Should be empty (honeypot field)
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

const createSupportEmailHtml = (data: ContactFormData) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #555; }
    .value { margin-top: 5px; padding: 10px; background: white; border-radius: 5px; }
    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📬 New Contact Form Submission</h1>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">From:</div>
        <div class="value">${data.name} &lt;${data.email}&gt;</div>
      </div>
      <div class="field">
        <div class="label">Subject:</div>
        <div class="value">${data.subject}</div>
      </div>
      <div class="field">
        <div class="label">Message:</div>
        <div class="value" style="white-space: pre-wrap;">${data.message}</div>
      </div>
    </div>
    <div class="footer">
      Sent from CarpoolConnect Contact Form<br>
      ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>
`;

const createAcknowledgementEmailHtml = (name: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; border-top: 1px solid #ddd; }
    .highlight { background: #e8f4ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Message Received!</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>Thank you for contacting CarpoolConnect! We've received your message and will get back to you within 24-48 hours.</p>
      
      <div class="highlight">
        <strong>What happens next?</strong>
        <ul>
          <li>Our team will review your inquiry</li>
          <li>You'll receive a response via email</li>
          <li>For urgent matters, please specify in your message</li>
        </ul>
      </div>
      
      <p>In the meantime, why not download our app?</p>
      <p>
        <a href="#" style="display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">Download CarpoolConnect</a>
      </p>
      
      <p>Best regards,<br><strong>The CarpoolConnect Team</strong></p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} CarpoolConnect. All rights reserved.<br>
      <a href="https://carpoolconnect.com.au">carpoolconnect.com.au</a>
    </div>
  </div>
</body>
</html>
`;

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        // Get client IP for rate limiting
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
            request.headers.get('x-real-ip') ||
            'unknown';

        // Check rate limit
        const rateLimitResult = checkRateLimit(ip);
        if (!rateLimitResult.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: { 'X-RateLimit-Remaining': '0' }
                }
            );
        }

        // Parse request body
        const body: ContactFormData = await request.json();

        // Check honeypot field (should be empty)
        if (body.honeypot && body.honeypot.length > 0) {
            console.log('🤖 Bot detected via honeypot');
            // Return success to not tip off bots, but don't send email
            return NextResponse.json({ success: true });
        }

        // Validate required fields
        if (!body.name || !body.email || !body.subject || !body.message) {
            return NextResponse.json(
                { error: 'All fields are required' },
                { status: 400 }
            );
        }

        // Validate email format
        if (!validateEmail(body.email)) {
            return NextResponse.json(
                { error: 'Invalid email address' },
                { status: 400 }
            );
        }

        // Sanitize inputs
        const sanitizedData: ContactFormData = {
            name: sanitizeInput(body.name).slice(0, 100),
            email: body.email.trim().toLowerCase().slice(0, 254),
            subject: sanitizeInput(body.subject).slice(0, 200),
            message: sanitizeInput(body.message).slice(0, 5000),
        };

        // Validate message length
        if (sanitizedData.message.length < 10) {
            return NextResponse.json(
                { error: 'Message is too short' },
                { status: 400 }
            );
        }

        // Check if email credentials are configured
        if (!EMAIL_CONFIG.auth.pass) {
            console.error('❌ EMAIL_PASSWORD not configured');
            return NextResponse.json(
                { error: 'Email service not configured. Please contact us directly.' },
                { status: 500 }
            );
        }

        // Create email transporter
        const transporter = nodemailer.createTransport(EMAIL_CONFIG);

        // Send email to support team
        await transporter.sendMail({
            from: `"CarpoolConnect" <${EMAIL_CONFIG.auth.user}>`,
            to: SUPPORT_EMAIL,
            replyTo: sanitizedData.email,
            subject: `[Contact Form] ${sanitizedData.subject}`,
            html: createSupportEmailHtml(sanitizedData),
        });

        console.log(`📧 Contact form email sent from ${sanitizedData.email}`);

        // Send acknowledgement to user
        await transporter.sendMail({
            from: `"CarpoolConnect" <${EMAIL_CONFIG.auth.user}>`,
            to: sanitizedData.email,
            subject: 'Thanks for contacting CarpoolConnect!',
            html: createAcknowledgementEmailHtml(sanitizedData.name),
        });

        console.log(`✅ Acknowledgement email sent to ${sanitizedData.email}`);

        return NextResponse.json(
            { success: true, message: 'Message sent successfully!' },
            {
                status: 200,
                headers: { 'X-RateLimit-Remaining': rateLimitResult.remaining.toString() }
            }
        );

    } catch (error) {
        console.error('❌ Contact form error:', error);
        return NextResponse.json(
            { error: 'Failed to send message. Please try again later.' },
            { status: 500 }
        );
    }
}

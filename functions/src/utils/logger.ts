/**
 * Centralized logging utility for Firebase Cloud Functions
 * Provides structured logging with context for better debugging and monitoring
 */

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

interface LogContext {
    [key: string]: unknown;
}

/**
 * Get a safe error message from an unknown error type
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error occurred';
}

/**
 * Get error stack trace if available
 */
export function getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
        return error.stack;
    }
    return undefined;
}

class Logger {
    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}]`;

        if (context && Object.keys(context).length > 0) {
            return `${prefix} ${message} ${JSON.stringify(context)}`;
        }

        return `${prefix} ${message}`;
    }

    debug(message: string, context?: LogContext): void {
        // In Cloud Functions, always log debug in development
        console.log(this.formatMessage(LogLevel.DEBUG, message, context));
    }

    info(message: string, context?: LogContext): void {
        console.log(this.formatMessage(LogLevel.INFO, message, context));
    }

    warn(message: string, context?: LogContext): void {
        console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }

    error(message: string, error?: unknown, context?: LogContext): void {
        const errorContext: LogContext = {
            ...context,
        };

        if (error instanceof Error) {
            errorContext.errorName = error.name;
            errorContext.errorMessage = error.message;
            errorContext.errorStack = error.stack;
        } else if (error !== undefined) {
            errorContext.error = error;
        }

        console.error(this.formatMessage(LogLevel.ERROR, message, errorContext));
    }

    // Domain-specific loggers for Cloud Functions
    booking = {
        created: (bookingId: string, rideId: string, passengerId: string) =>
            this.info('Booking created', { bookingId, rideId, passengerId }),
        statusChanged: (bookingId: string, from: string, to: string) =>
            this.info('Booking status changed', { bookingId, from, to }),
        cancelled: (bookingId: string, reason?: string) =>
            this.warn('Booking cancelled', { bookingId, reason }),
    };

    ride = {
        created: (rideId: string, driverId: string) =>
            this.info('Ride created', { rideId, driverId }),
        statusChanged: (rideId: string, from: string, to: string) =>
            this.info('Ride status changed', { rideId, from, to }),
        seatFixed: (rideId: string, before: number, after: number) =>
            this.info('Seat availability fixed', { rideId, before, after }),
    };

    payment = {
        initiated: (paymentId: string, amount: number, bookingId: string) =>
            this.info('Payment initiated', { paymentId, amount, bookingId }),
        succeeded: (paymentId: string) =>
            this.info('Payment succeeded', { paymentId }),
        failed: (paymentId: string, reason: string) =>
            this.error('Payment failed', undefined, { paymentId, reason }),
    };

    user = {
        created: (userId: string, email?: string) =>
            this.info('User created', { userId, email }),
        documentSubmitted: (userId: string, documentType: string) =>
            this.info('Driver document submitted', { userId, documentType }),
    };

    safety = {
        reportCreated: (reportId: string, severity: string, reporterId: string) =>
            this.warn('Safety report created', { reportId, severity, reporterId }),
        emailFailed: (reportId: string, attempt: number) =>
            this.error('Safety report email failed', undefined, { reportId, attempt }),
    };

    stripe = {
        accountCreated: (accountId: string, userId: string) =>
            this.info('Stripe Connect account created', { accountId, userId }),
        webhookReceived: (eventType: string, eventId: string) =>
            this.info('Stripe webhook received', { eventType, eventId }),
    };
}

export const logger = new Logger();

/**
 * Centralized logging utility for CarpoolConnect
 * Replaces console.log with proper leveled logging
 */

const isDevelopment = __DEV__;

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

interface LogContext {
    [key: string]: unknown;
}

class Logger {
    private shouldLog(level: LogLevel): boolean {
        // In production, only log WARN and ERROR
        if (!isDevelopment) {
            return level === LogLevel.WARN || level === LogLevel.ERROR;
        }
        return true;
    }

    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}]`;

        if (context && Object.keys(context).length > 0) {
            return `${prefix} ${message} ${JSON.stringify(context)}`;
        }

        return `${prefix} ${message}`;
    }

    debug(message: string, context?: LogContext): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.log(this.formatMessage(LogLevel.DEBUG, message, context));
        }
    }

    info(message: string, context?: LogContext): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.log(this.formatMessage(LogLevel.INFO, message, context));
        }
    }

    warn(message: string, context?: LogContext): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage(LogLevel.WARN, message, context));
        }
    }

    error(message: string, error?: Error | unknown, context?: LogContext): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            const errorContext = {
                ...context,
                ...(error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                } : { error }),
            };
            console.error(this.formatMessage(LogLevel.ERROR, message, errorContext));
        }
    }

    // Specific domain loggers for better organization
    auth = {
        login: (userId: string) => this.info('User logged in', { userId }),
        logout: (userId: string) => this.info('User logged out', { userId }),
        loginFailed: (email: string, reason: string) => this.warn('Login failed', { email, reason }),
    };

    ride = {
        created: (rideId: string, driverId: string) => this.info('Ride created', { rideId, driverId }),
        booked: (rideId: string, passengerId: string) => this.info('Ride booked', { rideId, passengerId }),
        cancelled: (rideId: string, reason?: string) => this.warn('Ride cancelled', { rideId, reason }),
    };



    safety = {
        reportCreated: (reportId: string, severity: string) => this.warn('Safety report created', { reportId, severity }),
        reportUpdated: (reportId: string, status: string) => this.info('Safety report updated', { reportId, status }),
    };

    payment = {
        initiated: (intentId: string, amount: number) => this.info('Payment initiated', { intentId, amount }),
        succeeded: (intentId: string) => this.info('Payment succeeded', { intentId }),
        failed: (intentId: string, error: string) => this.error('Payment failed', new Error(error), { intentId }),
    };

    booking = {
        created: (bookingId: string, rideId: string) => this.info('Booking created', { bookingId, rideId }),
        updated: (bookingId: string, status: string) => this.info('Booking updated', { bookingId, status }),
        cancelled: (bookingId: string, reason?: string) => this.info('Booking cancelled', { bookingId, reason }),
        paymentUpdated: (bookingId: string) => this.debug('Payment method updated', { bookingId }),
    };

    chat = {
        messageSent: (rideId: string, senderId: string) => this.debug('Message sent', { rideId, senderId }),
        threadCreated: (threadId: string, bookingId: string) => this.debug('Thread created', { threadId, bookingId }),
    };

    image = {
        uploadStarted: (path: string) => this.debug('Image upload started', { path }),
        uploadComplete: (path: string, url: string) => this.debug('Image upload complete', { path, urlLength: url.length }),
        uploadFailed: (path: string, error: string) => this.error('Image upload failed', new Error(error), { path }),
    };

    emergency = {
        contactAdded: (contactId: string, userId: string) => this.info('Emergency contact added', { contactId, userId }),
        alertTriggered: (userId: string) => this.warn('Emergency alert triggered', { userId }),
    };
}

export const logger = new Logger();

// Export convenience functions
export const log = logger;

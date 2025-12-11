/**
 * Typed error classes for better error handling
 */

export enum ErrorCode {
    // Authentication
    AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
    AUTH_USER_NOT_FOUND = 'AUTH_USER_NOT_FOUND',
    AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
    AUTH_PERMISSION_DENIED = 'AUTH_PERMISSION_DENIED',

    // Validation
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    VALIDATION_MISSING_FIELD = 'VALIDATION_MISSING_FIELD',
    VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',

    // Resources
    RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
    RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
    RESOURCE_UNAVAILABLE = 'RESOURCE_UNAVAILABLE',

    // Payment
    PAYMENT_FAILED = 'PAYMENT_FAILED',
    PAYMENT_INSUFFICIENT_FUNDS = 'PAYMENT_INSUFFICIENT_FUNDS',
    PAYMENT_CANCELLED = 'PAYMENT_CANCELLED',

    // Network
    NETWORK_ERROR = 'NETWORK_ERROR',
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',

    // Server
    SERVER_ERROR = 'SERVER_ERROR',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

    // Unknown
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AppError extends Error {
    code: ErrorCode;
    statusCode: number;
    isOperational: boolean;
    context?: Record<string, any>;

    constructor(
        message: string,
        code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
        statusCode: number = 500,
        isOperational: boolean = true,
        context?: Record<string, any>
    ) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.context = context;

        // Maintains proper stack trace
        Error.captureStackTrace(this, this.constructor);

        Object.setPrototypeOf(this, AppError.prototype);
    }
}

// Specific error classes
export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication failed', context?: Record<string, any>) {
        super(message, ErrorCode.AUTH_INVALID_CREDENTIALS, 401, true, context);
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = 'Permission denied', context?: Record<string, any>) {
        super(message, ErrorCode.AUTH_PERMISSION_DENIED, 403, true, context);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, context?: Record<string, any>) {
        super(message, ErrorCode.VALIDATION_FAILED, 400, true, context);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, id?: string) {
        const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
        super(message, ErrorCode.RESOURCE_NOT_FOUND, 404, true, { resource, id });
    }
}

export class ConflictError extends AppError {
    constructor(message: string, context?: Record<string, any>) {
        super(message, ErrorCode.RESOURCE_ALREADY_EXISTS, 409, true, context);
    }
}

export class PaymentError extends AppError {
    constructor(message: string, context?: Record<string, any>) {
        super(message, ErrorCode.PAYMENT_FAILED, 402, true, context);
    }
}

export class NetworkError extends AppError {
    constructor(message: string = 'Network request failed', context?: Record<string, any>) {
        super(message, ErrorCode.NETWORK_ERROR, 503, true, context);
    }
}

export class ServerError extends AppError {
    constructor(message: string = 'Internal server error', context?: Record<string, any>) {
        super(message, ErrorCode.SERVER_ERROR, 500, true, context);
    }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

/**
 * Extract user-friendly error message
 */
export function getUserMessage(error: unknown): string {
    if (isAppError(error)) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'An unexpected error occurred';
}

/**
 * Convert Firebase errors to AppErrors
 */
export function convertFirebaseError(error: any): AppError {
    const code = error?.code || '';

    switch (code) {
        case 'auth/invalid-email':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return new AuthenticationError('Invalid email or password');

        case 'auth/too-many-requests':
            return new AppError(
                'Too many failed attempts. Please try again later.',
                ErrorCode.AUTH_PERMISSION_DENIED,
                429
            );

        case 'permission-denied':
            return new AuthorizationError('You do not have permission to perform this action');

        case 'not-found':
            return new NotFoundError('Resource');

        case 'unavailable':
            return new NetworkError('Service temporarily unavailable. Please try again.');

        case 'deadline-exceeded':
            return new AppError(
                'Request timeout. Please try again.',
                ErrorCode.NETWORK_TIMEOUT,
                408
            );

        default:
            return new ServerError(error?.message || 'An unexpected error occurred');
    }
}

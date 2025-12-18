/**
 * Secure API Wrapper with DDoS Protection and Security Measures
 */

import { Platform } from 'react-native';
import SecurityManager from './SecurityManager';
import { auth } from '@/config/firebase';
import type { Auth } from 'firebase/auth';

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  rateLimitType?: 'api' | 'booking' | 'messaging';
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rateLimited?: boolean;
  retryAfter?: number;
}

export class SecureApiClient {
  private static instance: SecureApiClient;
  private readonly baseTimeout = 10000; // 10 seconds
  private readonly maxRetries = 3;
  private requestQueue: Map<string, Promise<any>> = new Map();

  private constructor() { }

  public static getInstance(): SecureApiClient {
    if (!SecureApiClient.instance) {
      SecureApiClient.instance = new SecureApiClient();
    }
    return SecureApiClient.instance;
  }

  public async secureRequest<T = any>(
    url: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.baseTimeout,
      retries = this.maxRetries,
      rateLimitType = 'api'
    } = options;

    try {
      // Generate request identifier for rate limiting
      const requestId = this.generateRequestId(url, method, auth.currentUser?.uid);

      // Check rate limiting
      const rateLimitCheck = await SecurityManager.checkRateLimit(requestId, rateLimitType);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          rateLimited: true,
          retryAfter: rateLimitCheck.retryAfter
        };
      }

      // Validate and sanitize request data
      const sanitizedBody = this.sanitizeRequestBody(body);

      // Check for duplicate requests (prevent request flooding)
      const requestKey = `${method}:${url}:${JSON.stringify(sanitizedBody)}`;
      if (this.requestQueue.has(requestKey)) {
        console.warn('[SecureApiClient] Duplicate request detected, using cached promise');
        return await this.requestQueue.get(requestKey);
      }

      // Create the request promise
      const requestPromise = this.executeRequest<T>(url, {
        method,
        headers: this.buildSecureHeaders(headers),
        body: sanitizedBody,
        timeout,
        retries
      });

      // Cache the promise to prevent duplicates
      this.requestQueue.set(requestKey, requestPromise);

      // Execute request
      const result = await requestPromise;

      // Clean up cache
      this.requestQueue.delete(requestKey);

      return result;

    } catch (error: any) {
      console.error('[SecureApiClient] Request failed:', error);
      return {
        success: false,
        error: error.message || 'Request failed'
      };
    }
  }

  private async executeRequest<T>(
    url: string,
    options: Required<Omit<ApiRequestOptions, 'rateLimitType'>>
  ): Promise<ApiResponse<T>> {
    const { method, headers, body, timeout, retries } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Add exponential backoff for retries
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await this.delay(delay);
          console.log(`[SecureApiClient] Retry attempt ${attempt} after ${delay}ms delay`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const requestOptions: RequestInit = {
          method,
          headers,
          signal: controller.signal,
        };

        if (body && method !== 'GET') {
          requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        // Check for HTTP errors
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Parse response
        const contentType = response.headers.get('content-type');
        let data: T;

        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text() as any;
        }

        // Validate response data
        const validatedData = this.validateResponseData(data);

        return {
          success: true,
          data: validatedData
        };

      } catch (error: any) {
        lastError = error;

        // Don't retry for certain errors
        if (error.name === 'AbortError') {
          break; // Timeout - don't retry
        }

        if (error.message.includes('401') || error.message.includes('403')) {
          break; // Auth errors - don't retry
        }

        console.warn(`[SecureApiClient] Attempt ${attempt + 1} failed:`, error.message);
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Request failed after all retries'
    };
  }

  private generateRequestId(url: string, method: string, userId?: string): string {
    const urlPath = new URL(url).pathname;
    return `${method}:${urlPath}:${userId || 'anonymous'}`;
  }

  private sanitizeRequestBody(body: any): any {
    if (!body) return body;

    if (typeof body === 'string') {
      return SecurityManager.sanitizeInput(body);
    }

    if (typeof body === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
          // Check for malicious content
          if (SecurityManager.detectSqlInjection(value) || SecurityManager.detectXssAttempt(value)) {
            throw new Error(`Potentially malicious content detected in field: ${key}`);
          }
          sanitized[key] = SecurityManager.sanitizeInput(value);
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeRequestBody(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return body;
  }

  private buildSecureHeaders(customHeaders: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Platform': Platform.OS,
      'X-App-Version': '1.0.0',
      'X-Timestamp': Date.now().toString(),
      ...customHeaders
    };

    // Add authentication header if user is logged in
    if (auth.currentUser) {
      headers['X-User-ID'] = auth.currentUser.uid;
    }

    // Add CSRF protection for web
    if (Platform.OS === 'web') {
      headers['X-CSRF-Token'] = this.generateCSRFToken();
    }

    return headers;
  }

  private generateCSRFToken(): string {
    // Use crypto-secure random for CSRF token
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return btoa(String.fromCharCode.apply(null, Array.from(array)));
  }

  private validateResponseData(data: any): any {
    // Basic response validation
    if (typeof data === 'string') {
      // Check for potential XSS in response
      if (SecurityManager.detectXssAttempt(data)) {
        throw new Error('Potentially malicious content in response');
      }
      return SecurityManager.sanitizeInput(data);
    }

    if (typeof data === 'object' && data !== null) {
      // Recursively validate object properties
      const validated: any = {};
      for (const [key, value] of Object.entries(data)) {
        validated[key] = this.validateResponseData(value);
      }
      return validated;
    }

    return data;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Specialized methods for different types of requests
  public async secureFirebaseCall<T = any>(
    functionName: string,
    data: any = {},
    options: Omit<ApiRequestOptions, 'method'> = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Import Firebase functions dynamically to avoid circular dependencies
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const { functions } = await import('@/config/firebase');

      const callable = httpsCallable(functions, functionName);

      // Check rate limiting for Firebase calls
      const requestId = `firebase:${functionName}:${auth.currentUser?.uid || 'anonymous'}`;
      const rateLimitCheck = await SecurityManager.checkRateLimit(requestId, options.rateLimitType || 'api');

      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: 'Rate limit exceeded for Firebase function calls',
          rateLimited: true,
          retryAfter: rateLimitCheck.retryAfter
        };
      }

      // Sanitize input data
      const sanitizedData = this.sanitizeRequestBody(data);

      // Execute Firebase function
      const result = await callable(sanitizedData);

      return {
        success: true,
        data: result.data as T
      };

    } catch (error: any) {
      console.error(`[SecureApiClient] Firebase function ${functionName} failed:`, error);

      // Handle specific Firebase errors
      if (error.code === 'functions/unauthenticated') {
        return {
          success: false,
          error: 'Authentication required'
        };
      }

      if (error.code === 'functions/permission-denied') {
        return {
          success: false,
          error: 'Permission denied'
        };
      }

      return {
        success: false,
        error: error.message || 'Firebase function call failed'
      };
    }
  }

  // Method to check if a request should be blocked
  public async shouldBlockRequest(url: string, userId?: string): Promise<boolean> {
    try {
      // Check for suspicious patterns
      if (userId) {
        const isAnomalous = await SecurityManager.detectAnomalousActivity(userId, { url, timestamp: Date.now() });
        if (isAnomalous) {
          return true;
        }
      }

      // Check session validity
      const isValidSession = await SecurityManager.validateSession();
      if (!isValidSession) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('[SecureApiClient] Error checking request blocking:', error);
      return false; // Don't block on error, but log it
    }
  }

  // Get security status for monitoring
  public getSecurityStatus() {
    return {
      activeRequests: this.requestQueue.size,
      securityManager: SecurityManager.getSecurityStatus()
    };
  }
}

export default SecureApiClient.getInstance();
import { useState, useCallback } from 'react';
import SecurityManager from '@/security/SecurityManager';
import { useAuthStore } from '@/store/auth-store';

interface ApiOptions {
  rateLimitType?: 'login' | 'api' | 'booking' | 'messaging';
  validateInput?: boolean;
  requireAuth?: boolean;
}

export const useSecureApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const secureApiCall = useCallback(async <T>(
    apiFunction: () => Promise<T>,
    options: ApiOptions = {}
  ): Promise<T | null> => {
    const {
      rateLimitType = 'api',
      validateInput = true,
      requireAuth = true
    } = options;

    setIsLoading(true);
    setError(null);

    try {
      // Check authentication if required
      if (requireAuth && !user) {
        throw new Error('Authentication required');
      }

      // Check rate limiting
      const identifier = user?.id || 'anonymous';
      const rateLimitCheck = await SecurityManager.checkRateLimit(identifier, rateLimitType);
      
      if (!rateLimitCheck.allowed) {
        const retryAfter = rateLimitCheck.retryAfter || 60;
        throw new Error(`Rate limit exceeded. Please try again in ${retryAfter} seconds.`);
      }

      // Check brute force protection for sensitive operations
      if (rateLimitType === 'login' || rateLimitType === 'booking') {
        const bruteForceCheck = await SecurityManager.checkBruteForce(identifier);
        
        if (!bruteForceCheck.allowed) {
          const retryAfter = bruteForceCheck.retryAfter || 300;
          throw new Error(`Too many failed attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`);
        }

        // Apply progressive delay if needed
        if (bruteForceCheck.delay) {
          await new Promise(resolve => setTimeout(resolve, bruteForceCheck.delay));
        }
      }

      // Validate session
      if (requireAuth) {
        const isValidSession = await SecurityManager.validateSession();
        if (!isValidSession) {
          throw new Error('Session expired. Please log in again.');
        }
      }

      // Execute the API call
      const result = await apiFunction();

      // Record successful operation for brute force protection
      if (rateLimitType === 'login') {
        await SecurityManager.recordSuccessfulLogin(identifier);
      }

      return result;
    } catch (error: any) {
      console.error('Secure API call failed:', error);
      
      // Record failed login attempts
      if (rateLimitType === 'login') {
        await SecurityManager.recordFailedLogin(identifier);
      }

      // Log security event for suspicious activity
      if (error.message?.includes('Rate limit') || error.message?.includes('Too many')) {
        await SecurityManager.logSecurityEvent({
          type: 'suspicious_activity',
          timestamp: Date.now(),
          userId: user?.id,
          details: { 
            type: 'api_abuse_attempt', 
            rateLimitType, 
            error: error.message 
          }
        });
      }

      setError(error.message || 'An unexpected error occurred');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const sanitizeInput = useCallback((input: string): string => {
    return SecurityManager.sanitizeInput(input);
  }, []);

  const validateEmail = useCallback((email: string): boolean => {
    return SecurityManager.validateEmail(email);
  }, []);

  const validatePhoneNumber = useCallback((phone: string): boolean => {
    return SecurityManager.validatePhoneNumber(phone);
  }, []);

  const detectMaliciousInput = useCallback((input: string): boolean => {
    return SecurityManager.detectSqlInjection(input) || SecurityManager.detectXssAttempt(input);
  }, []);

  return {
    secureApiCall,
    sanitizeInput,
    validateEmail,
    validatePhoneNumber,
    detectMaliciousInput,
    isLoading,
    error,
    clearError: () => setError(null)
  };
};
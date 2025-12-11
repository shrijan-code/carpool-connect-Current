/**
 * Security Integration Hook
 * Provides easy access to security features throughout the app
 */

import { useState, useEffect, useCallback } from 'react';
import SecurityManager from '@/security/SecurityManager';
import SecureApiClient from '@/security/SecureApiClient';

interface SecurityStatus {
  isSecure: boolean;
  rateLimitViolations: number;
  failedLoginAttempts: number;
  suspiciousActivities: number;
  lastSecurityEvent?: any;
}

interface SecurityHookReturn {
  // Security status
  securityStatus: SecurityStatus;
  isLoading: boolean;
  
  // Security actions
  checkRateLimit: (identifier: string, type: 'login' | 'api' | 'booking' | 'messaging') => Promise<{ allowed: boolean; retryAfter?: number }>;
  validateInput: (input: string) => { isValid: boolean; sanitized: string; threats: string[] };
  secureApiCall: <T>(functionName: string, data?: any, options?: any) => Promise<{ success: boolean; data?: T; error?: string }>;
  emergencyLockdown: (reason: string) => Promise<void>;
  
  // Utility functions
  refreshSecurityStatus: () => Promise<void>;
  clearSecurityData: () => Promise<void>;
}

export const useSecurity = (): SecurityHookReturn => {
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    isSecure: true,
    rateLimitViolations: 0,
    failedLoginAttempts: 0,
    suspiciousActivities: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load security status
  const refreshSecurityStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const status = SecurityManager.getSecurityStatus();
      
      setSecurityStatus({
        isSecure: status.rateLimitViolations < 10 && status.suspiciousActivities < 5,
        rateLimitViolations: status.rateLimitViolations,
        failedLoginAttempts: status.failedLoginAttempts,
        suspiciousActivities: status.suspiciousActivities,
        lastSecurityEvent: status.lastSecurityEvent
      });
    } catch (error) {
      console.error('[useSecurity] Failed to refresh security status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check rate limit
  const checkRateLimit = useCallback(async (
    identifier: string, 
    type: 'login' | 'api' | 'booking' | 'messaging'
  ) => {
    try {
      return await SecurityManager.checkRateLimit(identifier, type);
    } catch (error) {
      console.error('[useSecurity] Rate limit check failed:', error);
      return { allowed: true }; // Fail open for better UX
    }
  }, []);

  // Validate and sanitize input
  const validateInput = useCallback((input: string) => {
    const threats: string[] = [];
    
    // Check for various threats
    if (SecurityManager.detectSqlInjection(input)) {
      threats.push('SQL Injection');
    }
    
    if (SecurityManager.detectXssAttempt(input)) {
      threats.push('XSS Attempt');
    }
    
    // Sanitize input
    const sanitized = SecurityManager.sanitizeInput(input);
    
    return {
      isValid: threats.length === 0,
      sanitized,
      threats
    };
  }, []);

  // Secure API call wrapper
  const secureApiCall = useCallback(async <T>(
    functionName: string, 
    data: any = {}, 
    options: any = {}
  ) => {
    try {
      return await SecureApiClient.secureFirebaseCall<T>(functionName, data, options);
    } catch (error: any) {
      console.error(`[useSecurity] Secure API call failed for ${functionName}:`, error);
      return {
        success: false,
        error: error.message || 'API call failed'
      };
    }
  }, []);

  // Emergency lockdown
  const emergencyLockdown = useCallback(async (reason: string) => {
    try {
      await SecurityManager.emergencyLockdown(reason);
      await refreshSecurityStatus();
    } catch (error) {
      console.error('[useSecurity] Emergency lockdown failed:', error);
      throw error;
    }
  }, [refreshSecurityStatus]);

  // Clear security data
  const clearSecurityData = useCallback(async () => {
    try {
      // This would clear cached security data
      await refreshSecurityStatus();
    } catch (error) {
      console.error('[useSecurity] Failed to clear security data:', error);
    }
  }, [refreshSecurityStatus]);

  // Initialize security status on mount
  useEffect(() => {
    refreshSecurityStatus();
    
    // Set up periodic refresh (every 5 minutes)
    const interval = setInterval(refreshSecurityStatus, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [refreshSecurityStatus]);

  return {
    securityStatus,
    isLoading,
    checkRateLimit,
    validateInput,
    secureApiCall,
    emergencyLockdown,
    refreshSecurityStatus,
    clearSecurityData
  };
};

// Security validation decorator for functions
export const secureFunction = (
  fn: (...args: any[]) => any,
  options: {
    validateInputs?: boolean;
    checkRateLimit?: { identifier: string; type: 'login' | 'api' | 'booking' | 'messaging' };
    requireAuth?: boolean;
  } = {}
) => {
  return async (...args: any[]) => {
    // Input validation
    if (options.validateInputs) {
      for (const arg of args) {
        if (typeof arg === 'string') {
          if (SecurityManager.detectSqlInjection(arg) || SecurityManager.detectXssAttempt(arg)) {
            throw new Error('Potentially malicious input detected');
          }
        }
      }
    }
    
    // Rate limiting
    if (options.checkRateLimit) {
      const rateLimitCheck = await SecurityManager.checkRateLimit(
        options.checkRateLimit.identifier,
        options.checkRateLimit.type
      );
      
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded. Try again in ${rateLimitCheck.retryAfter} seconds.`);
      }
    }
    
    // Execute original function
    return await fn(...args);
  };
};

export default useSecurity;
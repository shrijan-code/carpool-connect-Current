/**
 * Comprehensive Security Manager for Carpool App
 * Protects against DDoS, brute force, injection attacks, and other cyber threats
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { auth, db } from '@/config/firebase';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';

interface SecurityEvent {
  type: 'login_attempt' | 'api_call' | 'suspicious_activity' | 'rate_limit_exceeded';
  timestamp: number;
  userId?: string;
  ip?: string;
  userAgent?: string;
  details?: any;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs: number;
}

interface SecurityConfig {
  rateLimits: {
    login: RateLimitConfig;
    api: RateLimitConfig;
    booking: RateLimitConfig;
    messaging: RateLimitConfig;
  };
  bruteForce: {
    maxFailedAttempts: number;
    lockoutDurationMs: number;
    progressiveDelay: boolean;
  };
  validation: {
    enableInputSanitization: boolean;
    enableSqlInjectionProtection: boolean;
    enableXssProtection: boolean;
  };
}

export class SecurityManager {
  private static instance: SecurityManager;
  private securityEvents: SecurityEvent[] = [];
  private rateLimitStore: Map<string, { count: number; firstRequest: number; blocked: boolean; blockUntil?: number }> = new Map();
  private failedLoginAttempts: Map<string, { count: number; lastAttempt: number; blockUntil?: number }> = new Map();

  private readonly config: SecurityConfig = {
    rateLimits: {
      login: { windowMs: 15 * 60 * 1000, maxRequests: 5, blockDurationMs: 30 * 60 * 1000 }, // 5 attempts per 15min, block for 30min
      api: { windowMs: 60 * 1000, maxRequests: 100, blockDurationMs: 5 * 60 * 1000 }, // 100 requests per minute, block for 5min
      booking: { windowMs: 5 * 60 * 1000, maxRequests: 10, blockDurationMs: 15 * 60 * 1000 }, // 10 bookings per 5min, block for 15min
      messaging: { windowMs: 60 * 1000, maxRequests: 30, blockDurationMs: 2 * 60 * 1000 }, // 30 messages per minute, block for 2min
    },
    bruteForce: {
      maxFailedAttempts: 5,
      lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
      progressiveDelay: true,
    },
    validation: {
      enableInputSanitization: true,
      enableSqlInjectionProtection: true,
      enableXssProtection: true,
    }
  };

  private constructor() {
    this.initializeSecurity();
  }

  public static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  private async initializeSecurity(): Promise<void> {
    try {
      // Load persisted security data
      await this.loadSecurityData();

      // Set up periodic cleanup
      setInterval(() => {
        this.cleanupExpiredData();
      }, 5 * 60 * 1000); // Cleanup every 5 minutes

      console.log('[SecurityManager] Initialized successfully');
    } catch (error) {
      console.error('[SecurityManager] Initialization failed:', error);
    }
  }

  // Rate Limiting
  public async checkRateLimit(identifier: string, type: keyof SecurityConfig['rateLimits']): Promise<{ allowed: boolean; retryAfter?: number }> {
    const config = this.config.rateLimits[type];
    const key = `${type}_${identifier}`;
    const now = Date.now();

    let record = this.rateLimitStore.get(key);

    if (!record) {
      record = { count: 1, firstRequest: now, blocked: false };
      this.rateLimitStore.set(key, record);
      return { allowed: true };
    }

    // Check if block period has expired
    if (record.blocked && record.blockUntil && now > record.blockUntil) {
      record.blocked = false;
      record.count = 1;
      record.firstRequest = now;
      delete record.blockUntil;
      this.rateLimitStore.set(key, record);
      return { allowed: true };
    }

    // If currently blocked
    if (record.blocked && record.blockUntil) {
      const retryAfter = Math.ceil((record.blockUntil - now) / 1000);
      await this.logSecurityEvent({
        type: 'rate_limit_exceeded',
        timestamp: now,
        details: { type, identifier, retryAfter }
      });
      return { allowed: false, retryAfter };
    }

    // Check if window has expired
    if (now - record.firstRequest > config.windowMs) {
      record.count = 1;
      record.firstRequest = now;
      this.rateLimitStore.set(key, record);
      return { allowed: true };
    }

    // Increment count
    record.count++;

    // Check if limit exceeded
    if (record.count > config.maxRequests) {
      record.blocked = true;
      record.blockUntil = now + config.blockDurationMs;
      this.rateLimitStore.set(key, record);

      const retryAfter = Math.ceil(config.blockDurationMs / 1000);
      await this.logSecurityEvent({
        type: 'rate_limit_exceeded',
        timestamp: now,
        details: { type, identifier, count: record.count, retryAfter }
      });

      return { allowed: false, retryAfter };
    }

    this.rateLimitStore.set(key, record);
    return { allowed: true };
  }

  // Brute Force Protection
  public async checkBruteForce(identifier: string): Promise<{ allowed: boolean; delay?: number; retryAfter?: number }> {
    const now = Date.now();
    const record = this.failedLoginAttempts.get(identifier);

    if (!record) {
      return { allowed: true };
    }

    // Check if lockout period has expired
    if (record.blockUntil && now > record.blockUntil) {
      this.failedLoginAttempts.delete(identifier);
      return { allowed: true };
    }

    // If currently locked out
    if (record.blockUntil) {
      const retryAfter = Math.ceil((record.blockUntil - now) / 1000);
      return { allowed: false, retryAfter };
    }

    // Progressive delay for failed attempts
    if (this.config.bruteForce.progressiveDelay && record.count > 0) {
      const delay = Math.min(record.count * 1000, 10000); // Max 10 seconds
      return { allowed: true, delay };
    }

    return { allowed: true };
  }

  public async recordFailedLogin(identifier: string): Promise<void> {
    const now = Date.now();
    let record = this.failedLoginAttempts.get(identifier);

    if (!record) {
      record = { count: 1, lastAttempt: now };
    } else {
      record.count++;
      record.lastAttempt = now;
    }

    // Check if should be locked out
    if (record.count >= this.config.bruteForce.maxFailedAttempts) {
      record.blockUntil = now + this.config.bruteForce.lockoutDurationMs;

      await this.logSecurityEvent({
        type: 'suspicious_activity',
        timestamp: now,
        details: {
          type: 'brute_force_lockout',
          identifier,
          failedAttempts: record.count,
          lockoutDuration: this.config.bruteForce.lockoutDurationMs
        }
      });
    }

    this.failedLoginAttempts.set(identifier, record);
    await this.persistSecurityData();
  }

  public async recordSuccessfulLogin(identifier: string): Promise<void> {
    // Clear failed attempts on successful login
    this.failedLoginAttempts.delete(identifier);
    await this.persistSecurityData();
  }

  // Input Validation and Sanitization
  public sanitizeInput(input: string): string {
    if (!this.config.validation.enableInputSanitization) {
      return input;
    }

    // Remove potentially dangerous characters
    let sanitized = input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/[<>'"]/g, ''); // Remove HTML characters

    // Limit length to prevent buffer overflow attacks
    if (sanitized.length > 1000) {
      sanitized = sanitized.substring(0, 1000);
    }

    return sanitized.trim();
  }

  public validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const sanitizedEmail = this.sanitizeInput(email);
    return emailRegex.test(sanitizedEmail) && sanitizedEmail.length <= 254;
  }

  public validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
    const sanitizedPhone = this.sanitizeInput(phone);
    return phoneRegex.test(sanitizedPhone);
  }

  public detectSqlInjection(input: string): boolean {
    if (!this.config.validation.enableSqlInjectionProtection) {
      return false;
    }

    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(--|\/\*|\*\/)/,
      /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT)\b)/i,
      /(\bCHAR\s*\(\s*\d+\s*\))/i
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  public detectXssAttempt(input: string): boolean {
    if (!this.config.validation.enableXssProtection) {
      return false;
    }

    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  // Security Event Logging
  public async logSecurityEvent(event: SecurityEvent): Promise<void> {
    return this.logSecurityEventInternal(event);
  }

  private async logSecurityEventInternal(event: SecurityEvent): Promise<void> {
    try {
      this.securityEvents.push(event);

      // Keep only last 1000 events to prevent memory issues
      if (this.securityEvents.length > 1000) {
        this.securityEvents = this.securityEvents.slice(-1000);
      }

      // Log to console for debugging
      console.warn('[SecurityManager] Security Event:', event);

      // For critical events, also log to Firestore (if user is authenticated)
      if (event.type === 'suspicious_activity' || event.type === 'rate_limit_exceeded') {
        await this.logToFirestore(event);
      }

      await this.persistSecurityData();
    } catch (error) {
      console.error('[SecurityManager] Failed to log security event:', error);
    }
  }

  private async logToFirestore(event: SecurityEvent): Promise<void> {
    try {
      if (!auth.currentUser) return;

      // Note: security_logs requires admin access in Firestore rules
      // This will fail for regular users but that's expected
      // We catch and silently log the error to avoid breaking the app
      const securityLogRef = doc(db, 'security_logs', `${auth.currentUser.uid}_${Date.now()}`);
      await updateDoc(securityLogRef, {
        ...event,
        userId: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        platform: Platform.OS,
        appVersion: '1.0.0' // You can get this from your app config
      });
    } catch (error: any) {
      // Silently log permission errors - this is expected for non-admin users
      if (error?.code === 'permission-denied' || error?.message?.includes('permissions')) {
        console.log('[SecurityManager] Auth audit log (expected for non-admin users)');
      } else {
        console.error('[SecurityManager] Failed to log to Firestore:', error);
      }
    }
  }

  // Device and Session Security
  public async validateSession(): Promise<boolean> {
    try {
      if (!auth.currentUser) return false;

      // Check if user account is still active
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists()) {
        await auth.signOut();
        return false;
      }

      const userData = userDoc.data();
      if (userData.suspended || userData.banned) {
        await auth.signOut();
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SecurityManager] Session validation failed:', error);
      return false;
    }
  }

  public async detectAnomalousActivity(userId: string, activity: any): Promise<boolean> {
    try {
      // Check for rapid successive actions
      const recentEvents = this.securityEvents
        .filter(event => event.userId === userId && Date.now() - event.timestamp < 60000) // Last minute
        .length;

      if (recentEvents > 50) { // More than 50 actions per minute
        await this.logSecurityEvent({
          type: 'suspicious_activity',
          timestamp: Date.now(),
          userId,
          details: { type: 'rapid_actions', count: recentEvents, activity }
        });
        return true;
      }

      // Check for unusual patterns (you can expand this based on your app's behavior)
      // For example: booking multiple rides simultaneously, sending too many messages, etc.

      return false;
    } catch (error) {
      console.error('[SecurityManager] Anomaly detection failed:', error);
      return false;
    }
  }

  // Data Persistence
  private async persistSecurityData(): Promise<void> {
    try {
      const securityData = {
        rateLimitStore: Array.from(this.rateLimitStore.entries()),
        failedLoginAttempts: Array.from(this.failedLoginAttempts.entries()),
        lastCleanup: Date.now()
      };

      await AsyncStorage.setItem('security_data', JSON.stringify(securityData));
    } catch (error) {
      console.error('[SecurityManager] Failed to persist security data:', error);
    }
  }

  private async loadSecurityData(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('security_data');
      if (data) {
        try {
          const securityData = JSON.parse(data);
          this.rateLimitStore = new Map(securityData.rateLimitStore || []);
          this.failedLoginAttempts = new Map(securityData.failedLoginAttempts || []);
        } catch (parseError) {
          console.warn('[SecurityManager] Failed to parse stored security data, clearing corrupted data:', parseError);
          await AsyncStorage.removeItem('security_data');
          this.rateLimitStore = new Map();
          this.failedLoginAttempts = new Map();
        }
      }
    } catch (error) {
      console.error('[SecurityManager] Failed to load security data:', error);
    }
  }

  private cleanupExpiredData(): void {
    const now = Date.now();

    // Cleanup rate limit data
    for (const [key, record] of this.rateLimitStore.entries()) {
      if (record.blockUntil && now > record.blockUntil) {
        this.rateLimitStore.delete(key);
      } else if (!record.blocked && now - record.firstRequest > 24 * 60 * 60 * 1000) { // 24 hours
        this.rateLimitStore.delete(key);
      }
    }

    // Cleanup failed login attempts
    for (const [key, record] of this.failedLoginAttempts.entries()) {
      if (record.blockUntil && now > record.blockUntil) {
        this.failedLoginAttempts.delete(key);
      } else if (now - record.lastAttempt > 24 * 60 * 60 * 1000) { // 24 hours
        this.failedLoginAttempts.delete(key);
      }
    }

    // Cleanup old security events
    this.securityEvents = this.securityEvents.filter(event => now - event.timestamp < 24 * 60 * 60 * 1000);
  }

  // Public API for checking security status
  public getSecurityStatus(): {
    rateLimitViolations: number;
    failedLoginAttempts: number;
    suspiciousActivities: number;
    lastSecurityEvent?: SecurityEvent;
  } {
    const now = Date.now();
    const last24Hours = 24 * 60 * 60 * 1000;

    const recentEvents = this.securityEvents.filter(event => now - event.timestamp < last24Hours);

    return {
      rateLimitViolations: recentEvents.filter(e => e.type === 'rate_limit_exceeded').length,
      failedLoginAttempts: recentEvents.filter(e => e.type === 'login_attempt').length,
      suspiciousActivities: recentEvents.filter(e => e.type === 'suspicious_activity').length,
      lastSecurityEvent: this.securityEvents[this.securityEvents.length - 1]
    };
  }

  // Emergency lockdown
  public async emergencyLockdown(reason: string): Promise<void> {
    try {
      await this.logSecurityEvent({
        type: 'suspicious_activity',
        timestamp: Date.now(),
        details: { type: 'emergency_lockdown', reason }
      });

      // Sign out user
      if (auth.currentUser) {
        await auth.signOut();
      }

      // Clear sensitive data
      await AsyncStorage.multiRemove(['user_data', 'auth_token', 'payment_info']);

      console.warn('[SecurityManager] Emergency lockdown activated:', reason);
    } catch (error) {
      console.error('[SecurityManager] Emergency lockdown failed:', error);
    }
  }
}

export default SecurityManager.getInstance();
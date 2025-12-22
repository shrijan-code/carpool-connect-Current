import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Mail, Lock, User, Phone, Car, Users, Chrome } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settings-store';
import { validateEmail, validatePhone, validatePassword, validateName } from '@/utils/validation';
import { ColorScheme } from '@/constants/colors';
import { logger } from '@/utils/logger';

type AuthMode = 'login' | 'register' | 'role-select' | 'forgot-password';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'rider' as 'driver' | 'rider',
  });

  const { login, register, loginWithGoogle, sendPasswordReset } = useAuthStore();
  const { colors } = useTheme();
  const theme = useSettingsStore((s) => s.settings.currentTheme);

  // Match onboarding gradient colors exactly
  const gradientColors: readonly [string, string, string] = theme === 'dark'
    ? ['#1a1a2e', '#16213e', '#0f3460']
    : ['#667eea', '#764ba2', '#f093fb'];

  const handleLogin = async () => {
    // Validate email using shared validator
    if (!validateEmail(formData.email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (!formData.password) {
      Alert.alert('Missing Password', 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await login(formData.email.trim().toLowerCase(), formData.password);
      router.replace('/(tabs)/home');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid email or password';
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    // Validate name using shared validator
    const nameValidation = validateName(formData.name);
    if (!nameValidation.valid) {
      Alert.alert('Invalid Name', nameValidation.error || 'Please enter a valid name');
      return;
    }

    // Validate email using shared validator
    if (!validateEmail(formData.email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Validate phone using shared validator
    if (!validatePhone(formData.phone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (10-15 digits)');
      return;
    }

    // Validate password using shared validator
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.valid) {
      Alert.alert('Weak Password', passwordValidation.error || 'Please enter a stronger password');
      return;
    }

    setLoading(true);
    try {
      await register({
        ...formData,
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      });
      // Show verification email sent message
      Alert.alert(
        '✅ Account Created!',
        `A verification email has been sent to ${formData.email.trim().toLowerCase()}.\n\nPlease check your inbox and click the verification link before logging in.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form and go to login
              setFormData({
                name: '',
                email: '',
                phone: '',
                password: '',
                role: 'rider',
              });
              setMode('login');
            }
          }
        ]
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Please try again';
      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderRoleSelection = () => (
    <View style={styles.roleContainer}>
      <Text style={styles.roleTitle}>How do you want to use CarpoolConnect?</Text>

      <View style={styles.roleOptions}>
        <Card
          style={[
            styles.roleCard,
            formData.role === 'driver' && styles.selectedRole
          ]}
        >
          <Button
            title=""
            onPress={() => setFormData({ ...formData, role: 'driver' })}
            variant="ghost"
            style={styles.roleButton}
          />
          <View style={styles.roleContent}>
            <View style={styles.roleIcon}>
              <Car size={32} color={formData.role === 'driver' ? colors.primary : colors.textSecondary} />
            </View>
            <Text style={[
              styles.roleLabel,
              formData.role === 'driver' && styles.selectedRoleText
            ]}>
              I&apos;m a Driver
            </Text>
            <Text style={styles.roleDescription}>
              Offer rides and earn money by sharing your car
            </Text>
          </View>
        </Card>

        <Card
          style={[
            styles.roleCard,
            formData.role === 'rider' && styles.selectedRole
          ]}
        >
          <Button
            title=""
            onPress={() => setFormData({ ...formData, role: 'rider' })}
            variant="ghost"
            style={styles.roleButton}
          />
          <View style={styles.roleContent}>
            <View style={styles.roleIcon}>
              <Users size={32} color={formData.role === 'rider' ? colors.primary : colors.textSecondary} />
            </View>
            <Text style={[
              styles.roleLabel,
              formData.role === 'rider' && styles.selectedRoleText
            ]}>
              I&apos;m a Rider
            </Text>
            <Text style={styles.roleDescription}>
              Find rides and travel affordably with others
            </Text>
          </View>
        </Card>
      </View>

      <Button
        title="Continue"
        onPress={() => setMode('register')}
        style={styles.continueButton}
      />
    </View>
  );

  const renderLogin = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>

      <View style={styles.inputSection}>
        <Input
          label="Email"
          value={formData.email}
          onChangeText={(email) => setFormData({ ...formData, email })}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          leftIcon={<Mail size={20} color={colors.textSecondary} />}
        />

        <Input
          label="Password"
          value={formData.password}
          onChangeText={(password) => setFormData({ ...formData, password })}
          placeholder="Enter your password"
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          leftIcon={<Lock size={20} color={colors.textSecondary} />}
        />

        <Button
          title="Forgot Password?"
          onPress={() => setMode('forgot-password')}
          variant="ghost"
          style={styles.forgotPasswordButton}
          textStyle={styles.forgotPasswordText}
        />
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={styles.modernSubmitButton}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#FFFFFF', '#F8F9FA']}
            style={styles.modernSubmitButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <Text style={styles.modernSubmitButtonText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.modernGoogleButton}
          onPress={async () => {
            setLoading(true);
            try {
              await loginWithGoogle();
              router.replace('/(tabs)/home');
            } catch (error: any) {
              Alert.alert('Google Sign In Failed', 'Please try again');
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          activeOpacity={0.8}
        >
          <View style={styles.modernGoogleButtonContent}>
            <Chrome size={20} color="#4A5568" style={styles.googleIcon} />
            <Text style={styles.modernGoogleButtonText}>
              {loading ? 'Connecting...' : 'Continue with Google'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMode('role-select')}
          style={styles.modernSwitchButton}
        >
          <Text style={styles.modernSwitchButtonText}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRegister = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join CarpoolConnect as a {formData.role}</Text>

      <View style={styles.inputSection}>
        <Input
          label="Full Name"
          value={formData.name}
          onChangeText={(name) => setFormData({ ...formData, name })}
          placeholder="Enter your full name"
          autoComplete="name"
          textContentType="name"
          leftIcon={<User size={20} color={colors.textSecondary} />}
        />

        <Input
          label="Email"
          value={formData.email}
          onChangeText={(email) => setFormData({ ...formData, email })}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          leftIcon={<Mail size={20} color={colors.textSecondary} />}
        />

        <Input
          label="Phone"
          value={formData.phone}
          onChangeText={(phone) => setFormData({ ...formData, phone })}
          placeholder="Enter your phone number"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          leftIcon={<Phone size={20} color={colors.textSecondary} />}
        />

        <Input
          label="Password"
          value={formData.password}
          onChangeText={(password) => setFormData({ ...formData, password })}
          placeholder="Create a password"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          leftIcon={<Lock size={20} color={colors.textSecondary} />}
        />

        {/* Password Strength Indicator */}
        {formData.password.length > 0 && (
          <View style={styles.passwordStrengthContainer}>
            <View style={styles.passwordStrengthBars}>
              <View style={[
                styles.passwordStrengthBar,
                formData.password.length >= 1 && (
                  formData.password.length >= 8 && /[A-Z]/.test(formData.password) && /[0-9]/.test(formData.password)
                    ? styles.passwordStrengthStrong
                    : formData.password.length >= 6
                      ? styles.passwordStrengthMedium
                      : styles.passwordStrengthWeak
                )
              ]} />
              <View style={[
                styles.passwordStrengthBar,
                formData.password.length >= 6 && (
                  formData.password.length >= 8 && /[A-Z]/.test(formData.password) && /[0-9]/.test(formData.password)
                    ? styles.passwordStrengthStrong
                    : formData.password.length >= 6
                      ? styles.passwordStrengthMedium
                      : styles.passwordStrengthEmpty
                )
              ]} />
              <View style={[
                styles.passwordStrengthBar,
                formData.password.length >= 8 && /[A-Z]/.test(formData.password) && /[0-9]/.test(formData.password)
                  ? styles.passwordStrengthStrong
                  : styles.passwordStrengthEmpty
              ]} />
            </View>
            <Text style={[
              styles.passwordStrengthText,
              formData.password.length >= 8 && /[A-Z]/.test(formData.password) && /[0-9]/.test(formData.password)
                ? styles.passwordStrengthTextStrong
                : formData.password.length >= 6
                  ? styles.passwordStrengthTextMedium
                  : styles.passwordStrengthTextWeak
            ]}>
              {formData.password.length >= 8 && /[A-Z]/.test(formData.password) && /[0-9]/.test(formData.password)
                ? '✓ Strong password'
                : formData.password.length >= 6
                  ? 'Medium - add uppercase & number'
                  : 'Weak - minimum 6 characters'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={styles.modernSubmitButton}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#FFFFFF', '#F8F9FA']}
            style={styles.modernSubmitButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <Text style={styles.modernSubmitButtonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.modernGoogleButton}
          onPress={async () => {
            setLoading(true);
            try {
              await loginWithGoogle();
              router.replace('/(tabs)/home');
            } catch (error: any) {
              Alert.alert('Google Sign Up Failed', 'Please try again');
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          activeOpacity={0.8}
        >
          <View style={styles.modernGoogleButtonContent}>
            <Chrome size={20} color="#4A5568" style={styles.googleIcon} />
            <Text style={styles.modernGoogleButtonText}>
              {loading ? 'Connecting...' : 'Continue with Google'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMode('login')}
          style={styles.modernSwitchButton}
        >
          <Text style={styles.modernSwitchButtonText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleForgotPassword = async () => {
    // Validate email using shared validator
    if (!validateEmail(formData.email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    const trimmedEmail = formData.email.trim().toLowerCase();

    setLoading(true);
    try {
      logger.debug('Sending password reset', { email: trimmedEmail });
      await sendPasswordReset(trimmedEmail);
      logger.auth.loginFailed(trimmedEmail, 'Password reset requested');

      Alert.alert(
        'Reset Link Sent',
        `A password reset link has been sent to ${trimmedEmail}.\n\nPlease check your email inbox and spam folder.\n\nThe link will expire in 1 hour.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setFormData({ ...formData, email: '' });
              setMode('login');
            }
          }
        ]
      );
    } catch (error: unknown) {
      console.error('Password reset error:', error);

      let errorMessage = 'Failed to send reset email. Please try again.';

      if (error instanceof Error && error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderForgotPassword = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>Enter your email address and we&apos;ll send you a link to reset your password</Text>

      <View style={styles.inputSection}>
        <Input
          label="Email Address"
          value={formData.email}
          onChangeText={(email) => setFormData({ ...formData, email: email.trim().toLowerCase() })}
          placeholder="Enter your email address"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          leftIcon={<Mail size={20} color={colors.textSecondary} />}
        />
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={[styles.modernSubmitButton, (!formData.email || loading) && styles.modernSubmitButtonDisabled]}
          onPress={handleForgotPassword}
          disabled={!formData.email || loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#FFFFFF', '#F8F9FA']}
            style={styles.modernSubmitButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <Text style={[styles.modernSubmitButtonText, (!formData.email || loading) && styles.modernSubmitButtonTextDisabled]}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMode('login')}
          style={styles.modernSwitchButton}
        >
          <Text style={styles.modernSwitchButtonText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const styles = createStyles(colors);

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.header}>
              <Text style={styles.appName}>CarpoolConnect</Text>
            </View>

            <Card style={styles.card}>
              {mode === 'role-select' && renderRoleSelection()}
              {mode === 'login' && renderLogin()}
              {mode === 'register' && renderRegister()}
              {mode === 'forgot-password' && renderForgotPassword()}
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const createStyles = (colors: ColorScheme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 36,
    shadowColor: colors.shadow.color,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
    minHeight: 520,
    borderWidth: 0,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 26,
    fontWeight: '400' as const,
  },
  inputSection: {
    flex: 1,
  },
  buttonSection: {
    paddingTop: 16,
  },
  submitButton: {
    marginBottom: 24,
    borderRadius: 16,
    paddingVertical: 18,
    minHeight: 58,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  switchButton: {
    marginTop: 16,
    paddingVertical: 16,
  },
  switchButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  roleContainer: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 28,
  },
  roleOptions: {
    flex: 1,
    gap: 16,
    marginBottom: 32,
  },
  roleCard: {
    position: 'relative',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  selectedRole: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  roleButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  roleContent: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  roleIcon: {
    marginBottom: 16,
  },
  roleLabel: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 8,
  },
  selectedRoleText: {
    color: colors.primary,
  },
  roleDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  continueButton: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
  },
  googleButton: {
    marginBottom: 24,
    borderRadius: 16,
    paddingVertical: 18,
    borderColor: colors.border,
    borderWidth: 2,
    minHeight: 58,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow.color,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: colors.shadow.opacity,
    shadowRadius: 4,
    elevation: 2,
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.text,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500' as const,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    marginBottom: 32,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  forgotPasswordText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  // Modern button styles matching onboarding
  modernSubmitButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modernSubmitButtonDisabled: {
    opacity: 0.6,
  },
  modernSubmitButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  modernSubmitButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  modernSubmitButtonTextDisabled: {
    color: colors.textLight,
  },
  modernGoogleButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modernGoogleButtonContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  googleIcon: {
    marginRight: 12,
  },
  modernGoogleButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.text,
  },
  modernSwitchButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  modernSwitchButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
    opacity: 0.9,
  },
  // Password Strength Indicator Styles
  passwordStrengthContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  passwordStrengthBars: {
    flexDirection: 'row' as const,
    gap: 6,
    marginBottom: 8,
  },
  passwordStrengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  passwordStrengthEmpty: {
    backgroundColor: colors.border,
  },
  passwordStrengthWeak: {
    backgroundColor: '#EF4444',
  },
  passwordStrengthMedium: {
    backgroundColor: '#F59E0B',
  },
  passwordStrengthStrong: {
    backgroundColor: '#10B981',
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  passwordStrengthTextWeak: {
    color: '#EF4444',
  },
  passwordStrengthTextMedium: {
    color: '#F59E0B',
  },
  passwordStrengthTextStrong: {
    color: '#10B981',
  },
});
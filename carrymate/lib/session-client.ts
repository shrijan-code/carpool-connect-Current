export function getAuthErrorMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: string }).code)
      : '';

  const messages: Record<string, string> = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password is too weak.',
    'auth/invalid-verification-code': 'Invalid verification code. Please try again.',
    'auth/code-expired': 'Verification code has expired. Request a new one.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/phone-number-already-exists': 'This phone number is already registered.',
    'auth/credential-already-in-use': 'This phone number is linked to another account.',
    'auth/invalid-phone-number': 'Please enter a valid Australian mobile number.',
    'auth/missing-phone-number': 'Phone number is required.',
    'auth/captcha-check-failed': 'reCAPTCHA verification failed. Please try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
  };

  return messages[code] ?? 'Something went wrong. Please try again.';
}

export async function setSession(idToken: string): Promise<void> {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Failed to create session');
  }
}

export async function clearSession(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE' });
}

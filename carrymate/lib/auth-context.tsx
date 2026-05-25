'use client';

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getClientAuth, getClientDb } from '@/lib/firebase';
import type { User } from '@/types';

interface AuthState {
  user: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useReducer(
    (prev: AuthState, next: Partial<AuthState>) => ({ ...prev, ...next }),
    { user: null, userProfile: null, loading: true }
  );

  const fetchProfile = useCallback(async (uid: string): Promise<User | null> => {
    try {
      const snap = await getDoc(doc(getClientDb(), 'users', uid));
      if (snap.exists()) {
        return { uid, ...snap.data() } as User;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
    const profile = await fetchProfile(state.user.uid);
    setState({ userProfile: profile });
  }, [state.user, fetchProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getClientAuth(), async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await fetchProfile(firebaseUser.uid);
        setState({ user: firebaseUser, userProfile: profile, loading: false });
      } else {
        setState({ user: null, userProfile: null, loading: false });
      }
    });
    return () => unsubscribe();
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getClientAuth());
    setState({ user: null, userProfile: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function isProfileComplete(profile: User | null): boolean {
  if (!profile) return false;
  return profile.cities.length > 0 && profile.displayName.length >= 2;
}

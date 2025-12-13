import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './firebase-admin';
import admin from './firebase-admin';
import bcrypt from 'bcryptjs';
import { AdminRole, ROLE_PERMISSIONS } from '@/types';

// Validate required environment variable
if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET environment variable is required');
}

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

export interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: AdminRole;
}

// Permission helper functions
export function canManageAdmins(role: AdminRole): boolean {
    return ROLE_PERMISSIONS[role]?.canManageAdmins ?? false;
}

export function canEditData(role: AdminRole): boolean {
    return ROLE_PERMISSIONS[role]?.canEditData ?? false;
}

export function canViewData(role: AdminRole): boolean {
    return ROLE_PERMISSIONS[role]?.canViewData ?? true;
}

export function getRoleLabel(role: AdminRole): string {
    return ROLE_PERMISSIONS[role]?.label ?? role;
}

export async function createSession(adminUser: AdminUser) {
    const token = await new SignJWT({ admin: adminUser })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);

    cookies().set('admin-session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
    });

    return token;
}

export async function getSession(): Promise<AdminUser | null> {
    const token = cookies().get('admin-session')?.value;

    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, secret);
        return payload.admin as AdminUser;
    } catch {
        return null;
    }
}

export async function deleteSession() {
    cookies().delete('admin-session');
}

export async function verifyAdmin(email: string, password: string): Promise<AdminUser | null> {
    try {
        // Check if admin exists in Firestore
        const adminsSnapshot = await db.collection('admins')
            .where('email', '==', email)
            .where('active', '==', true)
            .limit(1)
            .get();

        if (adminsSnapshot.empty) {
            return null;
        }

        const adminDoc = adminsSnapshot.docs[0];
        const adminData = adminDoc.data();

        // Verify password using bcrypt
        let isPasswordValid = false;

        if (adminData.passwordHash) {
            // Production: Use hashed password
            isPasswordValid = await bcrypt.compare(password, adminData.passwordHash);
        } else if (adminData.password) {
            // Legacy: Support plain text password (for migration)
            // Check if it matches, and if so, hash it
            if (password === adminData.password) {
                isPasswordValid = true;

                // Automatically upgrade to hashed password
                const hashedPassword = await bcrypt.hash(password, 10);
                await adminDoc.ref.update({
                    passwordHash: hashedPassword,
                    password: admin.firestore.FieldValue.delete(), // Remove plain text
                });
                console.log('✅ Upgraded admin password to hashed version:', adminData.email);
            }
        } else {
            // Fallback for demo accounts without any password set
            if (password === 'admin123') {
                isPasswordValid = true;
                // Set hashed password
                const hashedPassword = await bcrypt.hash(password, 10);
                await adminDoc.ref.update({
                    passwordHash: hashedPassword,
                });
            }
        }

        if (!isPasswordValid) {
            return null;
        }

        // Update last login
        await adminDoc.ref.update({
            lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            id: adminDoc.id,
            email: adminData.email,
            name: adminData.name,
            role: adminData.role,
        };
    } catch (error) {
        console.error('Error verifying admin:', error);
        return null;
    }
}

/**
 * Hash a password for storage
 * Use this when creating new admin users
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = db.collection('users').orderBy('createdAt', 'desc');

        const snapshot = await query.limit(limit).get();

        let users = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        }));

        // Client-side search for simplicity
        if (search) {
            const searchLower = search.toLowerCase();
            users = users.filter((user: any) =>
                user.email?.toLowerCase().includes(searchLower) ||
                user.name?.toLowerCase().includes(searchLower) ||
                user.phone?.includes(search)
            );
        }

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

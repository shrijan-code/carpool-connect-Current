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
        const limit = parseInt(searchParams.get('limit') || '100');
        const action = searchParams.get('action');

        let query: any = db.collection('admin_logs').orderBy('createdAt', 'desc');

        if (action && action !== 'all') {
            query = query.where('action', '==', action);
        }

        const snapshot = await query.limit(limit).get();

        const logs = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        }));

        return NextResponse.json({ logs });
    } catch (error) {
        console.error('Error fetching logs:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

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
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = db.collection('rides').orderBy('createdAt', 'desc');

        if (status && status !== 'all') {
            query = query.where('status', '==', status) as any;
        }

        const snapshot = await query.limit(limit).get();

        const rides = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
            departureTime: doc.data().departureTime?.toDate?.()?.toISOString() || doc.data().departureTime,
        }));

        return NextResponse.json({ rides });
    } catch (error) {
        console.error('Error fetching rides:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

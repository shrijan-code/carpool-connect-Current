import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';
import { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';

interface SafetyReport {
    id: string;
    status: string;
    severity: string;
    type: string;
    description: string;
    reporterId: string;
    createdAt: string;
    updatedAt: string;
}

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const severity = searchParams.get('severity');
        const maxLimit = parseInt(searchParams.get('limit') || '50');

        let query = db.collection('safety_reports').orderBy('createdAt', 'desc');

        if (status && status !== 'all') {
            query = query.where('status', '==', status);
        }

        if (severity && severity !== 'all') {
            query = query.where('severity', '==', severity);
        }

        const snapshot = await query.limit(maxLimit).get();

        const reports: SafetyReport[] = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
        })) as SafetyReport[];

        return NextResponse.json({ reports });
    } catch (error) {
        console.error('Error fetching safety reports:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

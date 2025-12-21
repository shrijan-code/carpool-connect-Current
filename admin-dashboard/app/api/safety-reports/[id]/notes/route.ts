import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';
import admin from '@/lib/firebase-admin';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;

    try {
        const { note } = await request.json();

        const noteData = {
            adminId: session.id,
            adminName: session.name,
            note,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection('safety_reports')
            .doc(resolvedParams.id)
            .collection('notes')
            .add(noteData);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error adding note:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

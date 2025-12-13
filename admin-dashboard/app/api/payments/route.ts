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

        // Fetch payment logs
        const logsSnapshot = await db.collection('payment_logs')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const payments = logsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        }));

        // Calculate stats
        let totalRevenue = 0;
        let totalPlatformFees = 0;
        let totalTransactions = payments.length;

        payments.forEach((p: any) => {
            totalRevenue += (p.amount || 0);
            totalPlatformFees += (p.platformFee || 0);
        });

        // Also check payments collection if payment_logs is empty
        if (payments.length === 0) {
            const paymentsSnapshot = await db.collection('payments')
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            const altPayments = paymentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
            }));

            altPayments.forEach((p: any) => {
                totalRevenue += (p.amount || 0);
                totalPlatformFees += (p.platformFee || 0);
            });

            return NextResponse.json({
                payments: altPayments,
                stats: {
                    totalRevenue: totalRevenue / 100,
                    totalPlatformFees: totalPlatformFees / 100,
                    totalTransactions: altPayments.length,
                },
            });
        }

        return NextResponse.json({
            payments,
            stats: {
                totalRevenue: totalRevenue / 100,
                totalPlatformFees: totalPlatformFees / 100,
                totalTransactions,
            },
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

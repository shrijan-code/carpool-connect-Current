import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get total users
        const usersSnapshot = await db.collection('users').count().get();
        const totalUsers = usersSnapshot.data().count;

        // Get total rides
        const ridesSnapshot = await db.collection('rides').count().get();
        const totalRides = ridesSnapshot.data().count;

        // Get active rides
        const activeRidesSnapshot = await db.collection('rides')
            .where('status', '==', 'active')
            .count()
            .get();
        const activeRides = activeRidesSnapshot.data().count;

        // Get pending safety reports
        const pendingReportsSnapshot = await db.collection('safety_reports')
            .where('status', '==', 'pending')
            .count()
            .get();
        const pendingSafetyReports = pendingReportsSnapshot.data().count;

        // Get total revenue (sum of all paid bookings)
        const bookingsSnapshot = await db.collection('bookings')
            .where('paymentStatus', '==', 'paid')
            .get();

        const totalRevenue = bookingsSnapshot.docs.reduce((sum, doc) => {
            return sum + (doc.data().totalPrice || 0);
        }, 0);

        // Get user growth (users created in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentUsersSnapshot = await db.collection('users')
            .where('createdAt', '>=', thirtyDaysAgo.toISOString())
            .count()
            .get();
        const userGrowth = recentUsersSnapshot.data().count;

        const stats = {
            totalUsers,
            totalRides,
            activeRides,
            pendingSafetyReports,
            totalRevenue,
            userGrowth,
        };

        return NextResponse.json({ stats });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

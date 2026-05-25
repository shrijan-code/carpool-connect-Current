'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Star, User as UserIcon } from 'lucide-react';
import { getClientDb } from '@/lib/firebase';
import type { Rating, User } from '@/types';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { DetailPageSkeleton, Skeleton } from '@/components/ui/Skeleton';
import Image from 'next/image';

export default function PublicProfilePage() {
  const params = useParams();
  const userId = params.userId as string;

  const [profile, setProfile] = useState<User | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [userSnap, ratingsSnap] = await Promise.all([
          getDoc(doc(getClientDb(), 'users', userId)),
          getDocs(
            query(
              collection(getClientDb(), 'ratings'),
              where('ratedUser', '==', userId),
              orderBy('createdAt', 'desc')
            )
          ),
        ]);

        if (userSnap.exists()) {
          setProfile({ uid: userSnap.id, ...userSnap.data() } as User);
        }
        setRatings(ratingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Rating));
      } catch {
        const userSnap = await getDoc(doc(getClientDb(), 'users', userId));
        if (userSnap.exists()) {
          setProfile({ uid: userSnap.id, ...userSnap.data() } as User);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [userId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <EmptyState
        icon={UserIcon}
        title="User not found"
        description="This profile does not exist or has been removed."
      />
    );
  }

  const initials = profile.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="mb-6">
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-brand-light">
            {profile.photoURL ? (
              <Image
                src={profile.photoURL}
                alt={profile.displayName}
                fill
                className="object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-brand-primary">
                {initials}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{profile.displayName}</h1>
              {profile.communityVerified && (
                <span className="rounded bg-brand-accent/10 px-2 py-0.5 text-xs text-brand-accent">
                  Community verified
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-gray-600">
              <Star className="h-4 w-4 fill-brand-warning text-brand-warning" />
              <span className="font-medium">{profile.rating.toFixed(1)}</span>
              <span className="text-sm">({profile.totalRatings} ratings)</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {profile.totalDeliveries} deliveries · {profile.totalSent} items sent
            </p>
            {profile.cities.length > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                Travels: {profile.cities.join(', ')}
              </p>
            )}
          </div>
        </div>
        {profile.bio && <p className="mt-4 text-sm text-gray-600">{profile.bio}</p>}
      </Card>

      <h2 className="mb-4 text-lg font-semibold">Ratings & reviews</h2>
      {ratings.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500">No ratings yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {ratings.map((rating) => (
            <Card key={rating.id}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < rating.score
                          ? 'fill-brand-warning text-brand-warning'
                          : 'text-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-400">
                  {format(rating.createdAt.toDate(), 'dd MMM yyyy')}
                </span>
              </div>
              {rating.comment && <p className="text-sm text-gray-600">{rating.comment}</p>}
              <p className="mt-1 text-xs text-gray-400 capitalize">As {rating.role}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

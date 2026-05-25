import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';
import type { User } from '@/types';
import { cn } from '@/lib/utils';

interface UserCardProps {
  user: Pick<User, 'uid' | 'displayName' | 'photoURL' | 'rating' | 'totalRatings' | 'totalDeliveries' | 'communityVerified'>;
  className?: string;
  showLink?: boolean;
}

export default function UserCard({ user, className, showLink = true }: UserCardProps) {
  const initials = user.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const content = (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-brand-light">
        {user.photoURL ? (
          <Image src={user.photoURL} alt={user.displayName} fill className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-brand-primary">
            {initials}
          </span>
        )}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{user.displayName}</span>
          {user.communityVerified && (
            <span className="rounded bg-brand-accent/10 px-1.5 py-0.5 text-xs text-brand-accent">
              Community
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Star className="h-3.5 w-3.5 fill-brand-warning text-brand-warning" />
          <span>{user.rating.toFixed(1)}</span>
          <span>({user.totalRatings})</span>
          <span>·</span>
          <span>{user.totalDeliveries} deliveries</span>
        </div>
      </div>
    </div>
  );

  if (showLink) {
    return <Link href={`/profile/${user.uid}`}>{content}</Link>;
  }
  return content;
}

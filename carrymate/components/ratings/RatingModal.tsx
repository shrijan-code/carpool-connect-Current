'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getClientAuth } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface RatingModalProps {
  open: boolean;
  bookingId: string;
  ratedUserId: string;
  role: 'traveller' | 'sender';
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function RatingModal({
  open,
  bookingId,
  ratedUserId,
  role,
  onClose,
  onSubmitted,
}: RatingModalProps) {
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async () => {
    if (score < 1) {
      setError('Please select a star rating.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      if (!token) {
        setError('You must be logged in.');
        return;
      }
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId,
          ratedUser: ratedUserId,
          role,
          score,
          comment: comment.slice(0, 200),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Failed to submit rating');
        return;
      }
      onSubmitted?.();
      onClose();
    } catch {
      setError('Failed to submit rating. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Leave a rating</h2>
        <div className="mb-4 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setScore(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="p-1"
              aria-label={`Rate ${star} stars`}
            >
              <Star
                className={cn(
                  'h-8 w-8 transition-colors',
                  (hover || score) >= star
                    ? 'fill-brand-warning text-brand-warning'
                    : 'text-gray-300'
                )}
              />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 200))}
          placeholder="Optional comment (max 200 chars)"
          rows={3}
          className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
        <p className="mb-4 text-right text-xs text-gray-400">{comment.length}/200</p>
        {error && <p className="mb-3 text-sm text-brand-danger">{error}</p>}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Skip
          </Button>
          <Button className="flex-1" onClick={() => void handleSubmit()} loading={loading}>
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}

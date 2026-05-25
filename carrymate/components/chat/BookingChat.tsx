'use client';

import { useEffect, useRef, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import type { Message, BookingStatus } from '@/types';
import Button from '@/components/ui/Button';
import { format } from 'date-fns';
import { Check, Clock } from 'lucide-react';

interface BookingChatProps {
  bookingId: string;
  bookingStatus: BookingStatus;
}

export default function BookingChat({ bookingId, bookingStatus }: BookingChatProps) {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatDisabled =
    bookingStatus === 'delivered' ||
    bookingStatus === 'cancelled' ||
    bookingStatus === 'refunded';

  useEffect(() => {
    const q = query(
      collection(getClientDb(), 'messages'),
      where('bookingId', '==', bookingId),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Message);
      setMessages(msgs);
      setPendingIds(new Set());
    });
    return () => unsubscribe();
  }, [bookingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!user || !userProfile || !text.trim() || chatDisabled || sending) return;
    if (pendingIds.size > 0) return;

    setSending(true);
    const messageText = text.trim();
    setText('');
    const tempId = crypto.randomUUID();
    setPendingIds((prev) => new Set(prev).add(tempId));

    try {
      await addDoc(collection(getClientDb(), 'messages'), {
        bookingId,
        senderId: user.uid,
        senderName: userProfile.displayName,
        text: messageText,
        createdAt: serverTimestamp(),
        readBy: [user.uid],
      });
    } catch {
      setText(messageText);
    } finally {
      setSending(false);
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
    }
  };

  const markRead = async (message: Message) => {
    if (!user || message.readBy.includes(user.uid)) return;
    try {
      await updateDoc(doc(getClientDb(), 'messages', message.id), {
        readBy: [...message.readBy, user.uid],
      });
    } catch {
      // non-critical
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold text-gray-900">Chat</h3>
        {chatDisabled && (
          <p className="text-xs text-gray-500">Chat is closed for this booking.</p>
        )}
      </div>
      <div className="flex h-64 flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400">
            No messages yet. Coordinate pickup details here.
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.senderId === user?.uid;
          void markRead(msg);
          const created = msg.createdAt?.toDate?.() ?? new Date();
          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  isOwn
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {!isOwn && (
                  <p className="mb-0.5 text-xs font-medium opacity-70">{msg.senderName}</p>
                )}
                <p>{msg.text}</p>
                <div
                  className={`mt-1 flex items-center gap-1 text-xs ${
                    isOwn ? 'text-white/70' : 'text-gray-400'
                  }`}
                >
                  <span>{format(created, 'HH:mm')}</span>
                  {isOwn && <Check className="h-3 w-3" />}
                </div>
              </div>
            </div>
          );
        })}
        {pendingIds.size > 0 && (
          <div className="flex justify-end">
            <div className="flex items-center gap-1 rounded-lg bg-brand-primary/50 px-3 py-2 text-sm text-white">
              <Clock className="h-3 w-3" />
              Sending…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {!chatDisabled && (
        <div className="flex gap-2 border-t p-3">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void sendMessage()}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            disabled={sending || pendingIds.size > 0}
          />
          <Button onClick={() => void sendMessage()} loading={sending} disabled={!text.trim()}>
            Send
          </Button>
        </div>
      )}
    </div>
  );
}

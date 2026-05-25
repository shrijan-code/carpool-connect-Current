'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { DeclarationRecord } from '@/types';
import { useAuth } from '@/lib/auth-context';

interface ProhibitedItemsDeclarationProps {
  open: boolean;
  onClose: () => void;
  onComplete: (declaration: DeclarationRecord) => Promise<void>;
  loading?: boolean;
}

const CHECKBOXES = [
  {
    key: 'noDrugs' as const,
    label:
      'This item does NOT contain illegal drugs, narcotics, or controlled substances',
  },
  {
    key: 'noWeapons' as const,
    label:
      'This item does NOT contain weapons, firearms, ammunition, or explosive materials',
  },
  {
    key: 'noCash' as const,
    label:
      'This item does NOT contain cash, money orders, or monetary instruments exceeding $200',
  },
  {
    key: 'noStolenGoods' as const,
    label:
      'This item does NOT contain stolen goods or items obtained through illegal means',
  },
  {
    key: 'noDangerousGoods' as const,
    label:
      'This item does NOT contain dangerous goods, flammable materials, or hazardous substances',
  },
  {
    key: 'noRestrictedItems' as const,
    label:
      'This item does NOT require a permit, licence, or special authorisation to transport',
  },
  {
    key: 'descriptionAccurate' as const,
    label:
      'The item description and photo I have provided accurately represents what is being sent',
  },
  {
    key: 'acceptsLiability' as const,
    label:
      'I understand that I am solely and exclusively liable for the contents of this item and indemnify CarryMate and the traveller against any legal consequences arising from undeclared contents',
  },
];

export default function ProhibitedItemsDeclaration({
  open,
  onClose,
  onComplete,
  loading,
}: ProhibitedItemsDeclarationProps) {
  const { userProfile } = useAuth();
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [signedName, setSignedName] = useState('');
  const [nameWarning, setNameWarning] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const allChecked =
    CHECKBOXES.every((c) => checks[c.key]) && signedName.trim().length >= 2;

  const handleNameChange = (value: string) => {
    setSignedName(value);
    if (
      userProfile?.displayName &&
      value.trim().length >= 2 &&
      value.trim().toLowerCase() !== userProfile.displayName.toLowerCase()
    ) {
      setNameWarning(
        'Your signature name differs from your registered name. Please ensure this is your legal name.'
      );
    } else {
      setNameWarning('');
    }
  };

  const handleSubmit = async () => {
    if (!allChecked) {
      setError('You must check every box and enter your full legal name to proceed.');
      return;
    }
    setError('');

    let ipAddress = 'unknown';
    try {
      const ipRes = await fetch('/api/client-ip');
      if (ipRes.ok) {
        const data = (await ipRes.json()) as { ip: string };
        ipAddress = data.ip;
      }
    } catch {
      // continue with unknown IP
    }

    const declaration: DeclarationRecord = {
      noDrugs: !!checks.noDrugs,
      noWeapons: !!checks.noWeapons,
      noCash: !!checks.noCash,
      noStolenGoods: !!checks.noStolenGoods,
      noDangerousGoods: !!checks.noDangerousGoods,
      noRestrictedItems: !!checks.noRestrictedItems,
      descriptionAccurate: !!checks.descriptionAccurate,
      acceptsLiability: !!checks.acceptsLiability,
      signedName: signedName.trim(),
      signedAt: new Date().toISOString(),
      ipAddress,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    console.info('[audit] declaration_completed', {
      signedName: declaration.signedName,
      signedAt: declaration.signedAt,
    });

    await onComplete(declaration);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="declaration-title"
      >
        <div className="bg-brand-danger px-6 py-4 text-white">
          <h2 id="declaration-title" className="text-lg font-bold">
            Legal Declaration Required
          </h2>
        </div>
        <div className="p-6">
          <p className="mb-6 text-sm text-gray-700">
            Before proceeding, you must declare that the item you are sending does not contain
            any prohibited goods. This declaration is legally binding and permanently recorded.
            Providing false information constitutes fraud under Australian law.
          </p>
          <div className="mb-6 space-y-3">
            {CHECKBOXES.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!checks[key]}
                  onChange={(e) =>
                    setChecks((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                  className="mt-0.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <Input
            label="Type your full legal name as your digital signature"
            value={signedName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Full legal name"
          />
          {nameWarning && (
            <p className="mt-1 text-xs text-brand-warning">{nameWarning}</p>
          )}
          {error && <p className="mt-2 text-sm text-brand-danger">{error}</p>}
          <div className="mt-6 flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={() => void handleSubmit()}
              loading={loading}
              disabled={!allChecked}
            >
              Proceed
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700"
              disabled={loading}
            >
              Cancel and return to booking form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

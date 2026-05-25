'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { DeclarationRecord } from '@/types';

interface DeclarationModalProps {
  open: boolean;
  onClose: () => void;
  onSign: (declaration: DeclarationRecord) => Promise<void>;
  loading?: boolean;
}

const CHECKBOXES = [
  { key: 'noDrugs' as const, label: 'This item contains no illegal drugs or substances' },
  { key: 'noWeapons' as const, label: 'This item contains no weapons or explosives' },
  { key: 'noCash' as const, label: 'This item contains no cash or negotiable instruments' },
  { key: 'noStolenGoods' as const, label: 'This item is not stolen property' },
  { key: 'noDangerousGoods' as const, label: 'This item contains no dangerous goods' },
  { key: 'noRestrictedItems' as const, label: 'This item complies with all biosecurity restrictions' },
  { key: 'descriptionAccurate' as const, label: 'The item description is accurate and complete' },
  { key: 'acceptsLiability' as const, label: 'I accept liability for the contents of this shipment' },
];

export default function DeclarationModal({ open, onClose, onSign, loading }: DeclarationModalProps) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [signedName, setSignedName] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const allChecked = CHECKBOXES.every((c) => checks[c.key]) && signedName.trim().length >= 2;

  const handleSubmit = async () => {
    if (!allChecked) {
      setError('Please complete all declarations and sign with your full name.');
      return;
    }
    setError('');
    const declaration: DeclarationRecord = {
      noDrugs: checks.noDrugs,
      noWeapons: checks.noWeapons,
      noCash: checks.noCash,
      noStolenGoods: checks.noStolenGoods,
      noDangerousGoods: checks.noDangerousGoods,
      noRestrictedItems: checks.noRestrictedItems,
      descriptionAccurate: checks.descriptionAccurate,
      acceptsLiability: checks.acceptsLiability,
      signedName: signedName.trim(),
      signedAt: new Date().toISOString(),
      ipAddress: 'client',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };
    await onSign(declaration);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Sender declaration</h2>
        <p className="mb-4 text-sm text-gray-600">
          You must declare that your item complies with Australian law and CarryMate policies before payment.
        </p>
        <div className="mb-4 space-y-3">
          {CHECKBOXES.map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!checks[key]}
                onChange={(e) => setChecks((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="mt-0.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <Input
          label="Full legal name (electronic signature)"
          value={signedName}
          onChange={(e) => setSignedName(e.target.value)}
          placeholder="Your full name"
        />
        {error && <p className="mt-2 text-sm text-brand-danger">{error}</p>}
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => void handleSubmit()} loading={loading} disabled={!allChecked}>
            Sign & continue
          </Button>
        </div>
      </div>
    </div>
  );
}

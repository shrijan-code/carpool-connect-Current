'use client';

import { useState, type ChangeEvent } from 'react';
import Input from '@/components/ui/Input';
import { formatAustralianPhone } from '@/lib/utils';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
}

export default function PhoneInput({
  value,
  onChange,
  label = 'Phone number',
  error,
  disabled,
}: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState(value || '+61');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    if (!input.startsWith('+61')) {
      input = '+61' + input.replace(/^\+?61?/, '');
    }
    setDisplayValue(input);
    const formatted = formatAustralianPhone(input);
    onChange(formatted);
  };

  const handleBlur = () => {
    const formatted = formatAustralianPhone(displayValue);
    setDisplayValue(formatted);
    onChange(formatted);
  };

  return (
    <Input
      label={label}
      type="tel"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="+61412345678"
      error={error}
      disabled={disabled}
    />
  );
}

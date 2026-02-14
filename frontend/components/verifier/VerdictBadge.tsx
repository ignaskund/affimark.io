'use client';

import { CheckCircle2, AlertTriangle, XCircle, FlaskConical } from 'lucide-react';
import type { VerdictStatus } from '@/types/verifier';

interface VerdictBadgeProps {
  status: VerdictStatus;
  size?: 'sm' | 'md' | 'lg';
}

const VERDICT_CONFIG: Record<VerdictStatus, {
  label: string;
  icon: typeof CheckCircle2;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  GREEN: {
    label: 'Proceed',
    icon: CheckCircle2,
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
  },
  YELLOW: {
    label: 'Caution',
    icon: AlertTriangle,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
  },
  RED: {
    label: 'Avoid',
    icon: XCircle,
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
  },
  TEST_FIRST: {
    label: 'Test First',
    icon: FlaskConical,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
  },
};

export default function VerdictBadge({ status, size = 'md' }: VerdictBadgeProps) {
  const config = VERDICT_CONFIG[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs gap-1',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  const iconSizes = { sm: 14, md: 16, lg: 20 };

  return (
    <div
      className={`inline-flex items-center ${sizeClasses[size]} ${config.bgColor} ${config.textColor} border ${config.borderColor} rounded-full font-semibold`}
    >
      <Icon size={iconSizes[size]} />
      {config.label}
    </div>
  );
}

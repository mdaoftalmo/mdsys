'use client';

import { scoreBadgeClass } from '@/types/orientacao';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

export default function ScoreBadge({ score, size = 'sm' }: ScoreBadgeProps) {
  const cls = scoreBadgeClass(score);
  const sizeClasses = size === 'sm'
    ? 'w-8 h-8 text-xs'
    : 'w-10 h-10 text-sm font-semibold';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border ${cls} ${sizeClasses} shrink-0`}
      title={`Score: ${score}/50`}
    >
      {score}
    </span>
  );
}

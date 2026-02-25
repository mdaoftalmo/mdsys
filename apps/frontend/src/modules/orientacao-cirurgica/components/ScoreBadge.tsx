'use client';

import { getScoreColor } from '../constants';

interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm font-semibold',
  lg: 'w-12 h-12 text-base font-bold',
};

export function ScoreBadge({ score, size = 'md' }: Props) {
  return (
    <div
      className={`${sizes[size]} ${getScoreColor(score)} rounded-full flex items-center justify-center shrink-0 shadow-sm`}
      title={`Score: ${score}/100`}
    >
      {score}
    </div>
  );
}

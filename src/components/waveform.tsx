'use client';

import { useEffect, useState } from 'react';

interface WaveformProps {
  isActive: boolean;
  isTakenOver?: boolean;
  compact?: boolean;
}

export function Waveform({ isActive, isTakenOver, compact = false }: WaveformProps) {
  const [bars, setBars] = useState<number[]>(Array(24).fill(0));

  useEffect(() => {
    if (!isActive) {
      setBars(Array(24).fill(0));
      return;
    }

    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.random()));
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  const color = isTakenOver ? '#1f2937' : '#0a0a0a';
  const heightClass = compact ? 'h-6' : 'h-8';
  const barWidth = compact ? 'w-[3px]' : 'w-1';

  return (
    <div className={`flex ${heightClass} items-center justify-center gap-0.5 rounded bg-gray-100`}>
      {bars.map((height, i) => (
        <div
          key={i}
          className={`${barWidth} rounded-full transition-all duration-100`}
          style={{
            height: `${4 + height * 20}px`,
            backgroundColor: color,
            opacity: isActive ? 0.3 + height * 0.7 : 0.2
          }}
        />
      ))}
    </div>
  );
}

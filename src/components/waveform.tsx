'use client';

import { useEffect, useState } from 'react';

interface WaveformProps {
  isActive: boolean;
  isTakenOver?: boolean;
}

export function Waveform({ isActive, isTakenOver }: WaveformProps) {
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

  const color = isTakenOver ? '#f97316' : '#6C5CE7';

  return (
    <div className="flex items-center justify-center gap-0.5 h-8 bg-slate-950/50 rounded">
      {bars.map((height, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all duration-100"
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

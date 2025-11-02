'use client';

import { motion } from 'motion/react';
import { Voicemail } from 'lucide-react';

interface AnimatedVoicemailIconProps {
  size?: number;
  iconColor?: string;
  waveColor?: string;
  className?: string;
  barCount?: number;
}

export function AnimatedVoicemailIcon({ 
  size = 64, 
  iconColor = "#523429",
  waveColor = "#523429",
  className = "",
  barCount = 5
}: AnimatedVoicemailIconProps) {
  // Generate height variations for each bar
  const barHeights = Array.from({ length: barCount }, (_, i) => {
    const position = i / (barCount - 1); // 0 to 1
    const centerDistance = Math.abs(position - 0.5) * 2; // 0 at center, 1 at edges
    return 0.4 + (1 - centerDistance) * 0.6; // Bars are taller in the middle
  });

  const barWidth = size * 0.12;
  const barGap = size * 0.08;

  return (
    <div className={`inline-flex items-center gap-4 ${className}`}>
      {/* Left sound wave bars */}
      <div className="flex items-center gap-1" style={{ gap: barGap }}>
        {barHeights.map((baseHeight, index) => (
          <motion.div
            key={`left-${index}`}
            className="rounded-full"
            style={{
              backgroundColor: waveColor,
              width: barWidth,
            }}
            animate={{
              height: [
                size * baseHeight * 0.3,
                size * baseHeight * 0.9,
                size * baseHeight * 0.3,
              ],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: index * 0.1,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Voicemail icon */}
      <motion.div
        className="rounded-full flex items-center justify-center shrink-0"
        style={{
          backgroundColor: iconColor,
          width: size,
          height: size,
        }}
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Voicemail 
          size={size * 0.45} 
          color="white" 
          strokeWidth={2.5}
        />
      </motion.div>

      {/* Right sound wave bars */}
      <div className="flex items-center gap-1" style={{ gap: barGap }}>
        {barHeights.map((baseHeight, index) => (
          <motion.div
            key={`right-${index}`}
            className="rounded-full"
            style={{
              backgroundColor: waveColor,
              width: barWidth,
            }}
            animate={{
              height: [
                size * baseHeight * 0.3,
                size * baseHeight * 0.9,
                size * baseHeight * 0.3,
              ],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: index * 0.1,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}


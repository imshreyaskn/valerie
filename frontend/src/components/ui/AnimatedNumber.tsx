import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number | string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}

/**
 * AnimatedNumber — Smooth Notion-grade numeric ticker that increments/decrements
 * with fluid ease-out interpolation on value changes instead of jarring snaps.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = React.memo(({
  value,
  decimals,
  prefix = '',
  suffix = '',
  className = '',
  duration = 320,
}) => {
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value));
  const isNumeric = !isNaN(numericValue);

  const [displayValue, setDisplayValue] = useState<number>(isNumeric ? numericValue : 0);
  const prevValueRef = useRef<number>(isNumeric ? numericValue : 0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isNumeric) return;

    const startVal = prevValueRef.current;
    const endVal = numericValue;
    prevValueRef.current = endVal;

    if (startVal === endVal) {
      setDisplayValue(endVal);
      return;
    }

    const startTime = performance.now();

    const updateValue = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth cubic ease-out curve
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * easeProgress;
      
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(updateValue);
      } else {
        setDisplayValue(endVal);
        animFrameRef.current = null;
      }
    };

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }
    animFrameRef.current = requestAnimationFrame(updateValue);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [numericValue, isNumeric, duration]);

  if (!isNumeric) {
    return <span className={`tabular-nums ${className}`}>{value}</span>;
  }

  const decCount = decimals !== undefined ? decimals : Number.isInteger(numericValue) ? 0 : 2;
  const formatted = displayValue.toFixed(decCount);

  return (
    <span className={`tabular-nums inline-block tracking-tight ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
});

AnimatedNumber.displayName = 'AnimatedNumber';

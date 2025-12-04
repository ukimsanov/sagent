"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "motion/react";

interface AnimatedProgressProps {
  value: number;
  max: number;
  label: string;
  color: string;
  delay?: number;
}

export function AnimatedProgress({
  value,
  max,
  label,
  color,
  delay = 0,
}: AnimatedProgressProps) {
  const [percentage, setPercentage] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => {
        setPercentage(max > 0 ? Math.round((value / max) * 100) : 0);
      }, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [isInView, value, max, delay]);

  return (
    <div ref={ref} className="flex items-center gap-2">
      <span className="text-xs w-20">{label}</span>
      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
        <motion.div
          className={`h-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{
            duration: 0.8,
            delay: delay,
            ease: [0.4, 0, 0.2, 1],
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">
        {value}
      </span>
    </div>
  );
}

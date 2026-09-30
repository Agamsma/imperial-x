"use client";

import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/useReducedMotionPref";

// Counts up to a number when it scrolls into view. The server renders the final number.
export default function CountUp({ to, className }: { to: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = usePrefersReducedMotion();
  const value = useMotionValue(to);
  const text = useTransform(value, (v) => Math.round(v).toLocaleString("en-IN"));

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(value, to, { from: 0, duration: 1.8, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [inView, reduce, to, value]);

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}

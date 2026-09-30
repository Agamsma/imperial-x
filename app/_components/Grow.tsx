"use client";

import { motion } from "framer-motion";

// Grows from the left edge the first time it scrolls into view.
export default function Grow({
  children,
  className,
  style,
  delay = 0,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      style={{ ...style, originX: 0 }}
      initial={{ scaleX: 0, opacity: 0 }}
      whileInView={{ scaleX: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

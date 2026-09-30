"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/useReducedMotionPref";

// A card that tilts in 3D towards the mouse, with a soft light that follows the pointer.
export default function TiltCard({
  children,
  className = "",
  max = 7,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const reduce = usePrefersReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const glare = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 180, damping: 18 });
  const sry = useSpring(ry, { stiffness: 180, damping: 18 });
  const sglare = useSpring(glare, { stiffness: 200, damping: 30 });
  const light = useMotionTemplate`radial-gradient(420px circle at ${mx}% ${my}%, rgba(141,185,227,0.16), transparent 45%)`;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    ry.set((x - 0.5) * max * 2);
    rx.set(-(y - 0.5) * max * 2);
    mx.set(x * 100);
    my.set(y * 100);
    glare.set(1);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
    glare.set(0);
  };

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      // Drop the 3D transform when the card is flat so text stays sharp.
      transformTemplate={(latest, generated) =>
        Math.abs(Number(latest.rotateX) || 0) < 0.05 && Math.abs(Number(latest.rotateY) || 0) < 0.05 ? "none" : generated
      }
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition-colors duration-300 hover:border-white/20 ${className}`}
    >
      <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: light, opacity: sglare }} />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

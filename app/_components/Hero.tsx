"use client";

import Link from "next/link";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import RadarScene from "./RadarScene";
import { GITHUB_URL } from "@/lib/site";
import { usePrefersReducedMotion } from "@/lib/useReducedMotionPref";

const QUESTIONS = ["Which hazard?", "Where, how precisely?", "How sure?", "How many minutes?"];
const EASE = [0.22, 1, 0.36, 1] as const;

const label = "text-[10.5px] font-medium uppercase tracking-[0.16em] text-white/60";

function Letters({ word, className, delay }: { word: string; className: string; delay: number }) {
  return (
    <span className={`block ${className}`} style={{ perspective: "700px" }} aria-hidden="true">
      {word.split("").map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          style={{ transformOrigin: "50% 100%" }}
          initial={{ opacity: 0, rotateX: -85, y: 26 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={{ duration: 0.9, delay: delay + i * 0.06, ease: EASE }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 1.8 21 7v10l-9 5.2L3 17V7z" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M13.4 5.5 8.6 12.6h3.3l-1.3 5.9 4.8-7.1h-3.3z" fill="#F2C94C" />
    </svg>
  );
}

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = usePrefersReducedMotion();

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -160]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const barOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const scrollTilt = useTransform(scrollYProgress, [0, 1], [0, 12]);

  // The radar plane leans gently towards the mouse.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spx = useSpring(px, { stiffness: 45, damping: 18 });
  const spy = useSpring(py, { stiffness: 45, damping: 18 });
  const rotateX = useTransform(() => 63 + spy.get() * 5 + scrollTilt.get());
  const rotateZ = useTransform(() => -20 + spx.get() * 8);

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    py.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };

  return (
    <section
      id="top"
      ref={ref}
      onPointerMove={onPointerMove}
      className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-night text-white"
    >
      <motion.div className="absolute inset-0" style={{ scale: sceneScale }}>
        <RadarScene rotateX={rotateX} rotateZ={rotateZ} reduceMotion={reduce} />
      </motion.div>

      {/* Overlays that keep the text readable over the moving scene */}
      <div className="pointer-events-none absolute inset-0 bg-black/20" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 24%, transparent 58%, rgba(5,8,13,0.55) 86%, #05080d 100%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to right, rgba(0,0,0,0.25) 0%, transparent 18%, transparent 82%, rgba(0,0,0,0.25) 100%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 46% 40% at 50% 47%, rgba(5,8,13,0.62) 0%, rgba(5,8,13,0.25) 60%, transparent 100%)" }}
      />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 flex h-full flex-col items-center justify-center px-6 pt-14 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="mb-7 flex flex-col items-center gap-2.5"
        >
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="pl-[0.28em] text-[15px] font-medium uppercase tracking-[0.28em]">Team OmniSense</span>
          </div>
          <span className="pl-[0.34em] text-[10px] font-medium uppercase tracking-[0.34em] text-white/65">Presents</span>
        </motion.div>

        <h1
          aria-label="Imperial-X"
          className="m-0 font-serif uppercase text-white"
          style={{ textShadow: "0 2px 40px rgba(0,0,0,0.5)" }}
        >
          <Letters word="Imperial" delay={0.25} className="text-[clamp(3.6rem,12vw,8.6rem)] font-normal leading-[0.95] tracking-[0.04em]" />
          <Letters word="-X" delay={0.55} className="text-[clamp(3.4rem,11.4vw,8.2rem)] font-bold leading-[0.95] tracking-[0.03em]" />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.75, ease: "easeOut" }}
          className="mt-6 max-w-[560px] font-serif text-lg italic leading-relaxed text-white/85 sm:text-xl"
          style={{ textShadow: "0 1px 20px rgba(0,0,0,0.5)" }}
        >
          A web dashboard that tells officials which storm hazard is coming, where and how precisely, how sure we are, and how many
          minutes they have.
        </motion.p>

        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.9, ease: "easeOut" }}
          className="mt-7 flex max-w-2xl flex-wrap justify-center gap-2"
        >
          {QUESTIONS.map((q) => (
            <li
              key={q}
              className="rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-white/75 backdrop-blur-md"
            >
              {q}
            </li>
          ))}
        </motion.ul>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.05, ease: "easeOut" }}
          className="mt-9 flex flex-col items-center gap-4"
        >
          {/* Oval button: border-radius 50% gives a true ellipse */}
          <Link
            href="/demo"
            className="rounded-[50%] border border-white/60 px-[58px] py-5 text-xs font-medium uppercase tracking-[0.22em] text-white transition-colors duration-300 hover:border-white hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-light active:scale-[0.97]"
          >
            View demo
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs tracking-wide text-white/55 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
          >
            or read the code on GitHub
          </a>
        </motion.div>
      </motion.div>

      {/* Footer bar */}
      <motion.div style={{ opacity: barOpacity }} className="absolute inset-x-0 bottom-0 z-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2, ease: "easeOut" }}
          className="flex items-center justify-between px-5 pb-6 sm:px-10"
        >
          <div className="hidden items-center gap-5 sm:flex">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="opacity-70 transition-opacity hover:opacity-100">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.5 9.5 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2" />
              </svg>
            </a>
            <span className={label}>SIH26084 · MoES</span>
          </div>

          <a href="#problem" className={`absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 ${label}`}>
            <span className="font-semibold text-white/90">Scroll</span>
            <span>to explore</span>
            <svg className="vn-bob ml-1" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>

          <div className="hidden items-center gap-4 sm:flex">
            <span className={label}>Illustrative radar, synthetic data</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="opacity-70" aria-hidden="true">
              <path d="M5 15V9M10 19V5M15 16V8M20 13v-2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

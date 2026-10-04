"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11.3 4.6 4.7 10.1c-.44.37-.7.92-.7 1.5V19a1.6 1.6 0 0 0 1.6 1.6H9v-4.4a3 3 0 0 1 6 0v4.4h3.4A1.6 1.6 0 0 0 20 19v-7.4c0-.58-.26-1.13-.7-1.5l-6.6-5.5a1.1 1.1 0 0 0-1.4 0Z" fill="currentColor" />
    </svg>
  );
}

function FlowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <rect x="15" y="14" width="6" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 7h4a2 2 0 0 1 2 2v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13.5 3 6 13.2h5.2L10 21l7.5-10.2h-5.2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function DataIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="6" rx="7" ry="2.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 21V4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 4.5h11l-2 3.5 2 3.5H5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

// Each dock item lights up while any of its sections is on screen.
const ITEMS = [
  { key: "home", href: "#top", label: "Home", sections: ["top", "problem"], Icon: HomeIcon },
  { key: "how", href: "#how", label: "How it works", sections: ["how", "engine", "real-data"], Icon: FlowIcon },
  { key: "hazards", href: "#hazards", label: "Hazards", sections: ["hazards"], Icon: BoltIcon },
  { key: "data", href: "#data", label: "Data", sections: ["data"], Icon: DataIcon },
  { key: "roadmap", href: "#roadmap", label: "Roadmap and team", sections: ["roadmap", "team", "cta"], Icon: FlagIcon },
];

export default function Dock() {
  const [active, setActive] = useState("home");

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.4;
        let current = "home";
        for (const item of ITEMS) {
          for (const id of item.sections) {
            const el = document.getElementById(id);
            if (el && el.getBoundingClientRect().top <= line) current = item.key;
          }
        }
        setActive(current);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[22px] z-50 flex justify-center px-4">
      <motion.nav
        aria-label="Sections"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-white/14 bg-[rgba(12,18,28,0.45)] px-2 py-[5px] shadow-[0_12px_44px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-[22px] sm:gap-1.5 sm:px-2.5"
      >
        {ITEMS.map(({ key, href, label, Icon }) => {
          const isActive = active === key;
          return (
            <a
              key={key}
              href={href}
              onClick={() => setActive(key)}
              aria-label={label}
              aria-current={isActive ? "true" : undefined}
              className={`group relative flex h-[30px] w-[44px] items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-accent-light sm:w-[54px] ${
                isActive ? "text-white" : "text-white/60 hover:text-white/90"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="dock-active"
                  className="absolute inset-0 rounded-full border border-white/10 bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <span className="relative z-10 flex">
                <Icon />
              </span>
              <span className="pointer-events-none absolute top-full mt-2.5 whitespace-nowrap rounded-md border border-white/10 bg-[rgba(12,18,28,0.85)] px-2 py-1 text-[11px] text-white/85 opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                {label}
              </span>
            </a>
          );
        })}
        <span className="mx-1 h-4 w-px bg-white/15" aria-hidden="true" />
        <Link
          href="/demo"
          className="flex h-[30px] items-center rounded-full bg-accent px-3.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-[#2a649a] focus-visible:outline-2 focus-visible:outline-accent-light"
        >
          Demo
        </Link>
      </motion.nav>
    </div>
  );
}

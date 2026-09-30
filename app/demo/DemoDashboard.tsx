"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  LEVEL_COLOR,
  LEVEL_TEXT,
  OUTLOOK_STEP,
  STEP_COUNT,
  arrivalWindows,
  buildAlerts,
  stepLabel,
  type Level,
} from "@/lib/storm";

const DemoMap = dynamic(() => import("./DemoMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-[#eef1f4] text-sm text-muted">Loading map...</div>,
});

const LEVELS: Level[] = ["green", "yellow", "orange", "red"];

function Swatch({ level, className = "" }: { level: Level; className?: string }) {
  return <span className={`inline-block h-3 w-3 shrink-0 rounded-sm ${className}`} style={{ background: LEVEL_COLOR[level] }} />;
}

function Chip({ children, dot }: { children: React.ReactNode; dot: "ok" | "warn" | "info" }) {
  const dotClass = dot === "ok" ? "bg-accent" : dot === "warn" ? "bg-[#8a94a3]" : "border border-[#8a94a3] bg-white";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      {children}
    </span>
  );
}

export default function DemoDashboard() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const arrivals = useMemo(() => arrivalWindows(), []);
  const alerts = useMemo(() => buildAlerts(arrivals), [arrivals]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setStep((s) => {
        if (s >= STEP_COUNT - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [playing]);

  const togglePlay = () => {
    if (!playing && step >= STEP_COUNT - 1) setStep(0);
    setPlaying((p) => !p);
  };

  const isOutlook = step >= OUTLOOK_STEP;

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6f8] lg:h-screen lg:min-h-0">
      <div className="bg-[#16202b] px-4 py-2 text-center text-sm font-semibold text-white">
        Illustrative demo. Synthetic data, not a real forecast.
      </div>

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-white px-4 py-3">
        <Link href="/" className="text-lg font-bold text-accent">
          VajraNow
        </Link>
        <span className="rounded-md bg-accent px-2 py-1 text-xs font-bold tracking-wide text-white">REPLAY MODE (demo)</span>
        <div className="flex flex-wrap gap-2">
          <Chip dot="ok">Radar OK</Chip>
          <Chip dot="warn">Satellite 12 min old</Chip>
          <Chip dot="info">Lightning proxy</Chip>
        </div>
        <Link href="/" className="ml-auto text-sm text-muted hover:text-accent">
          Back to site
        </Link>
      </header>

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <section className="flex flex-col lg:min-h-0 lg:flex-1">
          <div className="relative h-[55vh] min-h-[320px] lg:h-auto lg:flex-1">
            <DemoMap step={step} />
            <div className="pointer-events-none absolute right-2 top-2 rounded-lg bg-white/95 px-3 py-2 text-right shadow">
              <p className="text-xs text-muted">Showing</p>
              <p className="text-lg font-bold text-accent">{stepLabel(step)}</p>
              <p className="text-xs text-muted">{isOutlook ? "Area outlook, low detail" : step <= 6 ? "Sharp 2 km map" : "Probability zone"}</p>
            </div>
          </div>

          <div className="border-t border-line bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent/90"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? (
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
                ) : (
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor"><path d="M4 2.5v11l9.5-5.5z" /></svg>
                )}
              </button>
              <input
                type="range"
                min={0}
                max={STEP_COUNT - 1}
                step={1}
                value={step}
                onChange={(e) => {
                  setPlaying(false);
                  setStep(Number(e.target.value));
                }}
                className="w-full accent-[#1F4E79]"
                aria-label="Forecast time"
                aria-valuetext={stepLabel(step)}
              />
            </div>
            <div className="mt-1 flex justify-between pl-12 text-[11px] text-muted">
              <span>Now</span>
              <span className="hidden sm:inline">+30 min</span>
              <span>+60 min</span>
              <span className="hidden sm:inline">+90 min</span>
              <span>+120 min</span>
              <span>6 h outlook</span>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-4 border-line p-4 lg:w-[380px] lg:overflow-y-auto lg:border-l lg:bg-white">
          <div className="rounded-xl border border-line bg-white p-4">
            <h2 className="font-semibold">Arrival windows</h2>
            <p className="mt-1 text-xs text-muted">From the synthetic storm speed, with a +/- range.</p>
            <ul className="mt-3 divide-y divide-line">
              {arrivals.map((a) => (
                <li key={a.place.id} className="py-3">
                  <div className="flex items-center gap-2">
                    <Swatch level={a.worst} />
                    <span className="font-medium">{a.place.name}</span>
                    <span className="ml-auto text-xs text-muted">{LEVEL_TEXT[a.worst].name}</span>
                  </div>
                  <p
                    className={`mt-1 pl-5 ${
                      a.place.unreliable
                        ? "text-sm font-medium text-muted"
                        : a.worst === "green"
                          ? "text-sm font-semibold text-ink"
                          : "text-lg font-bold text-ink"
                    }`}
                  >
                    {a.text}
                  </p>
                  <p className="pl-5 text-xs text-muted">{a.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-line bg-white p-4">
            <h2 className="font-semibold">Alerts</h2>
            <ul className="mt-3 space-y-3">
              {alerts.map((al) => (
                <li key={al.title} className="flex gap-3 rounded-lg bg-[#f7f9fb] p-3">
                  <span className="w-1 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[al.level] }} />
                  <div>
                    <p className="text-sm font-semibold">{al.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{al.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-line bg-white p-4">
            <h2 className="font-semibold">IMD colour scheme</h2>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {LEVELS.map((l) => (
                <li key={l} className="flex items-center gap-2">
                  <Swatch level={l} className="h-4 w-4" />
                  <span>
                    <span className="font-medium">{LEVEL_TEXT[l].name}</span>{" "}
                    <span className="text-muted">{LEVEL_TEXT[l].action}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 border-t border-line pt-3 text-xs text-muted">
              <p className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6 bg-accent" /> Forecast storm track
              </p>
              <p className="flex items-center gap-2">
                <span className="inline-block w-6 border-t-2 border-dashed border-accent" /> Uncertainty cone (widens with time)
              </p>
            </div>
          </div>

          <p className="px-1 text-xs text-muted">
            Decision-support prototype. Not an official IMD warning. All storms, times and alerts on this page are made up in
            code to show the idea.
          </p>
        </aside>
      </div>
    </div>
  );
}

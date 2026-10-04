"use client";

import { useEffect, useRef, useState } from "react";
import { fetchNowcast, fetchScenarios, type Bundle, type ScenarioInfo } from "@/lib/engine";
import DemoDashboard from "./DemoDashboard";
import EngineDashboard from "./EngineDashboard";

const DEFAULT_SCENARIO = "kochi-squall";

const STEPS = [
  "Quality checks on radar scans",
  "Tracking storm motion (TREC)",
  "Small CNN: growth from satellite and lightning",
  "20-member ensemble, 2 hours ahead",
  "IMD colour levels and arrival windows",
];

function Loading() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6f8] text-ink">
      <div className="bg-[#16202b] px-4 py-2 text-center text-sm font-semibold text-white">
        Illustrative demo. Synthetic data, not a real forecast.
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-sm">
          <p className="text-lg font-semibold text-accent">Running the VajraNow engine</p>
          <p className="mt-1 text-sm text-muted">On synthetic radar, satellite and lightning data. The first run can take a few seconds.</p>
          <ul className="mt-4 space-y-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span
                  className="h-2 w-2 rounded-full bg-accent motion-safe:animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function DemoApp() {
  const [scenarios, setScenarios] = useState<ScenarioInfo[] | null>(null);
  const [bundles, setBundles] = useState<Record<string, Bundle>>({});
  const [current, setCurrent] = useState(DEFAULT_SCENARIO);
  const [failed, setFailed] = useState(false);
  const [switching, setSwitching] = useState(false);
  const pending = useRef<Record<string, Promise<Bundle>>>({});

  const load = (id: string) => {
    if (!pending.current[id]) {
      pending.current[id] = fetchNowcast(id).then((b) => {
        setBundles((m) => ({ ...m, [id]: b }));
        return b;
      });
      pending.current[id].catch(() => delete pending.current[id]);
    }
    return pending.current[id];
  };

  useEffect(() => {
    let alive = true;
    // A shared link can open a specific scenario: /demo?scenario=ghats-afternoon
    const first = new URLSearchParams(window.location.search).get("scenario") ?? DEFAULT_SCENARIO;
    Promise.all([fetchScenarios(), load(first).catch(() => load(DEFAULT_SCENARIO))])
      .then(([s, b]) => {
        if (!alive) return;
        setScenarios(s);
        setCurrent(b.scenario.id);
        // Warm up the other scenarios so switching is instant.
        s.filter((x) => x.id !== b.scenario.id).reduce((p, x) => p.then(() => load(x.id).then(() => undefined, () => undefined)), Promise.resolve());
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const choose = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("scenario", id);
    window.history.replaceState(null, "", url);
    if (bundles[id]) {
      setCurrent(id);
      return;
    }
    setSwitching(true);
    load(id)
      .then(() => setCurrent(id))
      .catch(() => undefined)
      .finally(() => setSwitching(false));
  };

  if (failed) return <DemoDashboard notice="The engine is not reachable right now, so this is the simple built-in demo." />;
  const bundle = bundles[current];
  if (!scenarios || !bundle) return <Loading />;
  return <EngineDashboard bundle={bundle} scenarios={scenarios} onScenario={choose} switching={switching} />;
}

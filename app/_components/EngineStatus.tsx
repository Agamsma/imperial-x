"use client";

import { useEffect, useState } from "react";
import { fetchHealth } from "@/lib/engine";

type State = { kind: "checking" } | { kind: "online"; version: string; fusion: string } | { kind: "offline" };

// Live check of the Python engine behind the site.
export default function EngineStatus() {
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    const ctrl = new AbortController();
    fetchHealth(ctrl.signal)
      .then((h) => setState({ kind: "online", version: h.version, fusion: h.fusion_model }))
      .catch((err: unknown) => {
        if ((err as Error).name !== "AbortError") setState({ kind: "offline" });
      });
    return () => ctrl.abort();
  }, []);

  const dot =
    state.kind === "online" ? "bg-[#4ade80] shadow-[0_0_10px_#4ade80]" : state.kind === "offline" ? "bg-white/40" : "bg-white/40 motion-safe:animate-pulse";
  const text =
    state.kind === "online"
      ? `Engine online · v${state.version} · fusion model ${state.fusion} · synthetic data`
      : state.kind === "offline"
        ? "Engine not reachable right now"
        : "Checking the engine...";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </span>
  );
}

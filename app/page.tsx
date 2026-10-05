import Link from "next/link";
import CountUp from "./_components/CountUp";
import Dock from "./_components/Dock";
import EngineStatus from "./_components/EngineStatus";
import FlowDiagram from "./_components/FlowDiagram";
import Grow from "./_components/Grow";
import Hero from "./_components/Hero";
import MotionProvider from "./_components/MotionProvider";
import Reveal from "./_components/Reveal";
import SiteFooter from "./_components/SiteFooter";
import TiltCard from "./_components/TiltCard";
import { GITHUB_URL, TEAM, VALIDATION_URL } from "@/lib/site";

const TIERS = [
  { range: "0 to 1 h", title: "Main target", body: "2 km probability map from tracked storms", grow: 1, shade: "bg-accent border-accent" },
  { range: "1 to 3 h", title: "Wider probability zones", body: "Coarser zones; a skill-based reliability gate is proposed", grow: 2, shade: "bg-[#2a5f91]/70 border-[#3b76ad]/60" },
  { range: "3 to 6 h", title: "Area outlook", body: "Broad regions only. Blend with NCMRWF model guidance (planned)", grow: 3, shade: "bg-accent-light/[0.08] border-accent-light/25" },
];

const ICON = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

const HAZARDS = [
  {
    name: "Lightning",
    body: "Chance of lightning from a radar proxy (echo of 40 dBZ or more).",
    next: "Echo of 35 dBZ or more at the −10 °C level (temperature from ERA5), then IITM flash data as labels.",
    tag: "Radar proxy",
    icon: <path {...ICON} d="M13.5 3 6 13.2h5.2L10 21l7.5-10.2h-5.2z" />,
  },
  {
    name: "New storms forming",
    body: "Early signs of new cells from fast-cooling satellite cloud tops.",
    next: "Checked against the radar echoes that follow.",
    tag: "Demo",
    icon: (
      <>
        <path {...ICON} d="M7 17a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 17z" />
        <path {...ICON} d="M12 11v4M10 13h4" />
      </>
    ),
  },
  {
    name: "Hail",
    body: "A flag where radar echo reaches 55 dBZ. Kept out of the alert levels.",
    next: "45 dBZ echo at least 1.4 km above the freezing level (Waldvogel), plus VIL and echo-top height, from the 3D radar volume.",
    tag: "Flag only",
    icon: (
      <>
        <path {...ICON} d="M7 14a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 14z" />
        <circle cx="8.5" cy="18" r="1.1" fill="currentColor" />
        <circle cx="12.5" cy="20" r="1.1" fill="currentColor" />
        <circle cx="15.5" cy="17.5" r="1.1" fill="currentColor" />
      </>
    ),
  },
  {
    name: "Extreme rain / cloudburst",
    body: "Radar rain of 50 mm and 100 mm or more in an hour, estimated with a Z-R relation. 100 mm/h is the cloudburst threshold as widely reported.",
    next: "Checked against rain gauges.",
    tag: "Experimental",
    icon: (
      <>
        <path {...ICON} d="M7 13a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 13z" />
        <path {...ICON} d="M8 16l-1 3M12 16l-1 4M16 16l-1 3" />
      </>
    ),
  },
  {
    name: "Downburst / damaging gusts",
    body: "A strong-wind proxy: fast-moving cells with a severe core. Downburst speed is not measured yet.",
    next: "Low-level divergence in the radar's radial velocity (VEL), which is in our files but not yet processed.",
    tag: "Proxy",
    icon: <path {...ICON} d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7" />,
  },
];

type Status = "ordered" | "open" | "planned" | "future";

const SOURCES: { name: string; what: string; use: string; status: Status; label: string }[] = [
  { name: "TERLS Doppler radar (MOSDAC)", what: "3D reflectivity + velocity, ~15 min scans. Reflectivity used so far; velocity not yet processed", use: "Storm cells, motion, hail and downburst signals", status: "ordered", label: "2 days (10–11 May 2026) in hand, more ordered" },
  { name: "INSAT-3DR (MOSDAC)", what: "Infrared cloud tops, 30 min frames", use: "Storm growth and new cells", status: "ordered", label: "In hand, more ordered" },
  { name: "Cherrapunji radar (MOSDAC)", what: "Radar files we hold for 10 and 12 May 2026", use: "Planned second region for cloudburst work", status: "planned", label: "Held, not used yet" },
  { name: "ISS-LIS (NASA Earthdata)", what: "Lightning flashes seen from space, spot passes only", use: "Spot checks of the lightning proxy", status: "open", label: "Free" },
  { name: "IITM lightning network", what: "Ground strike locations, 80+ sensors", use: "Lightning labels and checks", status: "planned", label: "To request" },
  { name: "ERA5 / NCMRWF", what: "Instability, freezing level, wind. ERA5 for past cases; NCMRWF model forecasts for 3–6 h", use: "Context, and hand-over at 3–6 h", status: "open", label: "ERA5 open, NCMRWF to request" },
  { name: "Authorised live feeds", what: "Live IMD radar for real-time runs", use: "Live operation", status: "future", label: "Needs IMD approval" },
];

const STATUS_STYLE: Record<Status, string> = {
  ordered: "bg-accent text-white",
  open: "bg-accent-light/15 text-accent-light",
  planned: "border border-accent-light/40 text-accent-light",
  future: "border border-white/15 text-white/55",
};

const ENGINE_PARTS = [
  { title: "Quality checks", stat: "Clutter, speckle, gaps", body: "Removes ground clutter and speckle, and reports missing radar scans instead of hiding them." },
  { title: "TREC tracking", stat: "30 km blocks", body: "Matches blocks of radar echo between scans to measure storm motion, with a confidence value for every cell." },
  { title: "Extrapolation", stat: "2 km grid", body: "Moves storms along the motion (semi-Lagrangian advection): the baseline every other step must beat." },
  { title: "Small CNN", stat: "17k weights", body: "Predicts growth, decay and new storms from radar, cloud top cooling and lightning. Trained on synthetic storms only." },
  { title: "Ensemble", stat: "20 members", body: "Twenty slightly different futures turn into probabilities. They are not calibrated yet." },
  { title: "Warning logic", stat: "IMD colours", body: "Arrival windows as a range, unvalidated hail, wind and cloudburst flags, and 'not reliable' labels." },
];

const ROADMAP = [
  { title: "Synthetic engine", body: "Engine, dashboard and API on synthetic storms, plus a two-day real-data baseline (this site).", current: true },
  { title: "Real replay", body: "Read archived TERLS and INSAT files, replay past Kerala storms, compare with persistence and pysteps.", current: false },
  { title: "Calibrated hazards", body: "LightGBM hazard models, calibrated probabilities, a daily scorecard and a skill-based reliability gate.", current: false },
  { title: "CAP export, live feeds", body: "CAP export for authorised official channels. Live runs only after IMD and IITM approval.", current: false },
];

// Per-day CSI at >=20 dBZ with 3 km tolerance, from validation/real_radar/skill_results.json.
const DAY_ROWS = [
  { day: "10 May", note: "slow storms, 6.3 km/h, 18 pairs: persistence wins", l15: "0.596 vs 0.567", l30: "0.486 vs 0.398" },
  { day: "11 May", note: "moving storms, 12.3 km/h, 14 pairs: motion wins", l15: "0.642 vs 0.664", l30: "0.366 vs 0.388" },
  { day: "Both days", note: "pooled, 32 pairs", l15: "0.62 vs 0.61", l30: "0.43 vs 0.39" },
];

const STATUS_ROWS = [
  {
    title: "Built",
    items: ["Synthetic engine: tracking, advection, small CNN on synthetic storms, 20-member ensemble (uncalibrated)", "Dashboard", "API"],
  },
  {
    title: "Preliminary evidence",
    items: [
      "Two-day real-data baseline: TERLS radar and INSAT-3DR, 10 and 11 May 2026",
      "Motion helps when storms move (11 May) but not on slow storms (10 May); pooled, it does not beat persistence",
      "So the model must forecast growth and decay, not just motion",
    ],
  },
  {
    title: "Planned",
    items: [
      "Real replay, calibrated hazards, reliability gate",
      "LightGBM hazard models, pysteps comparison",
      "CAP export (no agency endorsement implied)",
      "Blend with NCMRWF model guidance for 3 to 6 h",
      "Archived-file ingestion, then authorised live feeds",
    ],
  },
];

function Glow({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute -top-40 h-[560px] w-[760px] rounded-full blur-3xl ${side === "left" ? "-left-72" : "-right-72"}`}
      style={{ background: "radial-gradient(closest-side, rgba(31,78,121,0.32), transparent)" }}
    />
  );
}

function Section({
  id,
  eyebrow,
  title,
  intro,
  glow = "left",
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  glow?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="relative scroll-mt-24 overflow-hidden border-t border-white/[0.06] py-24 sm:py-32">
      <Glow side={glow} />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mb-12 max-w-2xl sm:mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent-light">{eyebrow}</p>
          <h2 className="mt-4 font-serif text-4xl leading-[1.1] text-white sm:text-5xl">{title}</h2>
          {intro && <p className="mt-5 text-lg leading-relaxed text-white/60">{intro}</p>}
        </Reveal>
        {children}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <MotionProvider>
      <div className="flex flex-1 flex-col bg-night text-white selection:bg-accent-light/30">
        <Dock />

        <main className="flex-1">
          <Hero />

          {/* Problem */}
          <Section id="problem" eyebrow="The problem" title="Storm warnings come too late and cover too much">
            <div className="grid gap-5 md:grid-cols-3">
              <Reveal delay={0}>
                <TiltCard className="h-full p-7">
                  <p className="font-serif text-4xl text-accent-light">Minutes</p>
                  <h3 className="mt-4 text-lg font-semibold">Storms build fast and small</h3>
                  <p className="mt-2 leading-relaxed text-white/60">
                    A thunderstorm can grow from a few clouds to hail and lightning in well under an hour, over an area only a
                    few kilometres across.
                  </p>
                </TiltCard>
              </Reveal>
              <Reveal delay={0.1}>
                <TiltCard className="h-full p-7">
                  <p className="font-serif text-4xl text-accent-light">District, 3 h</p>
                  <h3 className="mt-4 text-lg font-semibold">Current nowcasts are broad</h3>
                  <p className="mt-2 leading-relaxed text-white/60">
                    Today&apos;s nowcasts are issued for whole districts and stay valid for 3 hours. Officials cannot tell which
                    town is hit first or when.
                  </p>
                </TiltCard>
              </Reveal>
              <Reveal delay={0.2}>
                <TiltCard className="flex h-full flex-col p-7">
                  <p className="font-serif text-4xl text-accent-light">
                    <CountUp to={2560} />
                  </p>
                  <h3 className="mt-4 text-lg font-semibold">Lightning deaths in India in 2023</h3>
                  <p className="mt-2 leading-relaxed text-white/60">
                    Lightning is one of the biggest natural killers in India. More precise, earlier warnings give people time
                    to get indoors.
                  </p>
                  <p className="mt-auto pt-5 text-xs text-white/40">
                    39.7% of all deaths from forces of nature. Source: NCRB, Accidental Deaths and Suicides in India (ADSI) 2023
                  </p>
                </TiltCard>
              </Reveal>
            </div>
          </Section>

          {/* How it works */}
          <Section
            id="how"
            glow="right"
            eyebrow="How it works (planned)"
            title="From raw radar to a clear decision"
            intro="Storms build in minutes, so we nowcast 0–3 h from fresh observations and hand over to NCMRWF model guidance for 3–6 h. With each new radar scan (about every 15 minutes), Imperial-X will put radar, satellite, lightning and weather-model data on one 2 km output grid, forecast where storms move and grow, and turn that into IMD colour levels with arrival ranges. Real detail is coarser than 2 km: satellite pixels are about 4 km and the radar beam widens with range."
          >
            <Reveal>
              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-8">
                <FlowDiagram />
              </div>
            </Reveal>
            <p className="mt-4 text-sm text-white/45">
              Design notes live in the{" "}
              <a href={`${GITHUB_URL}/tree/main/design`} className="text-accent-light underline decoration-accent-light/40 underline-offset-4">
                design folder
              </a>{" "}
              of the repo.
            </p>

            <Reveal className="mt-20">
              <h3 className="font-serif text-2xl text-white sm:text-3xl">Lead-time tiers</h3>
              <p className="mt-2 text-white/55">The further ahead we look, the less detail we promise.</p>
            </Reveal>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {TIERS.map((t, i) => (
                <Grow
                  key={t.range}
                  delay={i * 0.15}
                  className={`rounded-2xl border p-5 ${t.shade}`}
                  style={{ flexGrow: t.grow, flexBasis: 0 }}
                >
                  <p className="font-mono text-sm text-white/70">{t.range}</p>
                  <p className="mt-1 font-semibold">{t.title}</p>
                  <p className="mt-1 text-sm text-white/65">{t.body}</p>
                </Grow>
              ))}
            </div>
          </Section>

          {/* Engine */}
          <Section
            id="engine"
            eyebrow="Under the hood"
            title="The engine runs on synthetic storms"
            intro="Align, predict, decide and show are working code behind an open API. They run on synthetic radar, satellite and lightning data made in code. Reading real archived files is planned."
          >
            <Reveal className="-mt-4 mb-10">
              <EngineStatus />
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ENGINE_PARTS.map((p, i) => (
                <Reveal key={p.title} delay={(i % 3) * 0.08}>
                  <TiltCard className="h-full p-7">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent-light">{p.stat}</p>
                    <h3 className="mt-3 text-lg font-semibold">{p.title}</h3>
                    <p className="mt-2 leading-relaxed text-white/60">{p.body}</p>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-10">
              <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
                <div>
                  <h3 className="font-serif text-2xl text-white sm:text-3xl">Ask it about any place</h3>
                  <p className="mt-3 leading-relaxed text-white/60">
                    The dashboard reads everything from the engine&apos;s API, so any other system can too. Click anywhere on the demo map for a
                    point forecast, or call the API directly.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3 text-sm">
                    <Link href="/method" className="rounded-full border border-white/25 px-4 py-2 text-white/85 transition-colors hover:border-white hover:text-white">
                      Read the method
                    </Link>
                    <a href="/api/py/docs" className="rounded-full border border-white/25 px-4 py-2 text-white/85 transition-colors hover:border-white hover:text-white">
                      API docs
                    </a>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a121d] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
                  <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="ml-2 font-mono text-[11px] text-white/45">Example response (synthetic storm)</span>
                  </div>
                  <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-white/80">
                    <span className="text-accent-light">GET</span> /api/py/v1/nowcast/kochi-squall/point?lon=76.40&amp;lat=10.15
                    {"\n\n"}
                    {`{
  "level": "red",
  "arrival": {
    "status": "expected",
    "text": "20 to 50 min",
    "most_likely": 30,
    "chance": 100,
    "confidence": "medium"
  },
  "hazards": [
    "Lightning likely (radar proxy)",
    "Hail flag (55 dBZ, not validated)",
    "Strong winds possible (proxy, not validated)"
  ],
  "rain_next_hour_mm": { "median": 40, "p90": 49 }
}`}
                  </pre>
                </div>
              </div>
            </Reveal>
          </Section>

          {/* Real data */}
          <Section
            id="real-data"
            glow="right"
            eyebrow="Preliminary evidence"
            title="A first look at real radar"
            intro="A two-day baseline on real TERLS radar and INSAT-3DR files from MOSDAC, 10 and 11 May 2026. Motion helps when storms move (11 May, ~12 km/h) but not on slow storms (10 May, ~6 km/h). Pooled over both days, motion extrapolation does not beat persistence. So the model must forecast growth and decay, not just motion."
          >
            <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-center">
              <Reveal>
                <figure className="overflow-hidden rounded-2xl border border-white/10 bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static chart, shown at its own size */}
                  <img
                    src="/real-data/skill-by-day.png"
                    alt="Bar chart of CSI by day and lead time. 10 May, slow storms at about 6 km/h: persistence 0.60 vs motion 0.57 at +15 minutes and 0.49 vs 0.40 at +30 minutes, persistence wins. 11 May, moving storms at about 12 km/h: persistence 0.64 vs motion 0.66 at +15 minutes and 0.37 vs 0.39 at +30 minutes, motion wins."
                    width={1688}
                    height={900}
                    loading="lazy"
                    className="h-auto w-full"
                  />
                </figure>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.025]">
                  <table className="w-full text-left text-sm">
                    <thead className="text-white/45">
                      <tr>
                        <th className="px-4 py-3 font-semibold">CSI, persistence vs motion</th>
                        <th className="px-4 py-3 font-semibold">+15 min</th>
                        <th className="px-4 py-3 font-semibold">+30 min</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DAY_ROWS.map((r) => (
                        <tr key={r.day} className="border-t border-white/[0.07]">
                          <td className="px-4 py-3">
                            <span className="font-medium">{r.day}</span>
                            <span className="block text-xs text-white/50">{r.note}</span>
                          </td>
                          <td className="px-4 py-3 text-white/70">{r.l15}</td>
                          <td className="px-4 py-3 text-white/70">{r.l30}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-white/55">
                  CSI = hits / (hits + misses + false alarms), echo of 20 dBZ or more, 3 km tolerance. 32 forecast pairs (18 on 10 May, 14
                  on 11 May). Team analysis. Two days are too few for a general claim. The Imperial-X engine has not been run on these files.
                </p>
                <a
                  href={VALIDATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-block rounded-full border border-white/25 px-4 py-2 text-sm text-white/85 transition-colors hover:border-white hover:text-white"
                >
                  Code, inputs and results on GitHub
                </a>
              </Reveal>
            </div>

            <div className="mt-16 grid gap-5 md:grid-cols-3">
              {STATUS_ROWS.map((r, i) => (
                <Reveal key={r.title} delay={i * 0.08}>
                  <div className={`h-full rounded-2xl border p-6 ${i === 0 ? "border-accent-light/40 bg-accent-light/[0.06]" : "border-white/10 bg-white/[0.025]"}`}>
                    <h3 className="text-lg font-semibold">{r.title}</h3>
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-white/65">
                      {r.items.map((it) => (
                        <li key={it}>{it}</li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </Section>

          {/* Hazards */}
          <Section
            id="hazards"
            eyebrow="Hazards in the demo"
            title="Five hazards, honestly labelled"
            intro="Each hazard is labelled with what it is today. None of them is validated yet. The next steps use the full 3D TERLS volume (81 levels, 250 m apart) and the radial velocity already in our radar files; they are planned, not built."
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {HAZARDS.map((h, i) => (
                <Reveal key={h.name} delay={(i % 3) * 0.08}>
                  <TiltCard className="h-full p-7">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent-light/25 bg-accent-light/10 text-accent-light">
                        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                          {h.icon}
                        </svg>
                      </span>
                      <span className="shrink-0 rounded-full border border-accent-light/35 px-2.5 py-0.5 text-xs font-medium text-accent-light">
                        {h.tag}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">{h.name}</h3>
                    <p className="mt-2 leading-relaxed text-white/60">{h.body}</p>
                    <p className="mt-3 text-sm leading-relaxed text-white/50">
                      <span className="font-semibold text-accent-light">Next (planned, not built):</span> {h.next}
                    </p>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </Section>

          {/* Data */}
          <Section
            id="data"
            glow="right"
            eyebrow="Data sources"
            title="What we use, and where we stand"
            intro="No MOSDAC or IMD data is stored in this site or repo. Their terms do not allow redistribution."
          >
            <Reveal>
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-sm">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-white/45">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Source</th>
                      <th className="px-5 py-4 font-semibold">What it is</th>
                      <th className="px-5 py-4 font-semibold">Used for</th>
                      <th className="px-5 py-4 font-semibold">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SOURCES.map((s) => (
                      <tr key={s.name} className="border-t border-white/[0.07] transition-colors hover:bg-white/[0.03]">
                        <td className="px-5 py-4 font-medium text-white">{s.name}</td>
                        <td className="px-5 py-4 text-white/60">{s.what}</td>
                        <td className="px-5 py-4 text-white/60">{s.use}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[s.status]}`}>
                            {s.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </Section>

          {/* Roadmap */}
          <Section id="roadmap" eyebrow="Roadmap" title="Step by step, with checks at each stage">
            <div className="relative">
              <div aria-hidden="true" className="absolute left-5 right-5 top-5 hidden h-px bg-white/10 md:block" />
              <Grow className="absolute left-5 top-5 hidden h-px w-[14%] bg-accent-light md:block" delay={0.3} />
              <ol className="relative grid gap-5 md:grid-cols-4">
                {ROADMAP.map((r, i) => (
                  <Reveal key={r.title} delay={i * 0.1}>
                    <li className="list-none">
                      <span className="relative flex h-10 w-10 items-center justify-center">
                        {r.current && <span className="absolute inset-0 rounded-full bg-accent-light/40 motion-safe:animate-ping" />}
                        <span
                          className={`relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                            r.current ? "bg-accent-light text-night" : "border border-white/15 bg-night text-white/60"
                          }`}
                        >
                          {i + 1}
                        </span>
                      </span>
                      <div
                        className={`mt-5 rounded-2xl border p-6 ${
                          r.current ? "border-accent-light/50 bg-accent-light/[0.07]" : "border-white/10 bg-white/[0.025]"
                        }`}
                      >
                        {r.current && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-light">We are here</p>}
                        <h3 className="text-lg font-semibold">{r.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-white/60">{r.body}</p>
                      </div>
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>
          </Section>

          {/* Team */}
          <Section id="team" glow="right" eyebrow="Team OmniSense" title="Who we are" intro="Team ID 167415, Smart India Hackathon 2026.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TEAM.map((m, i) => (
                <Reveal key={m.name} delay={(i % 3) * 0.08}>
                  <TiltCard className="flex items-center gap-4 p-5" max={5}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent-light/30 bg-accent-light/10 font-semibold text-accent-light">
                      {m.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-sm text-white/55">{m.role}</p>
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </Section>

          {/* Closing call to action */}
          <section id="cta" className="relative overflow-hidden border-t border-white/[0.06] py-28 sm:py-36">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              style={{ background: "radial-gradient(closest-side, rgba(31,78,121,0.45), transparent)" }}
            />
            <Reveal className="relative mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent-light">Illustrative demo</p>
              <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-6xl">
                See how a warning <span className="italic">would</span> look
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
                The demo runs the engine on three made-up storm days over Kerala: warning zones, storm tracks, arrival windows with a range,
                new storms seen first by satellite, and places where we say the forecast is not reliable. Prototype UI, synthetic demo
                data.
              </p>
              <Link
                href="/demo"
                className="mt-10 rounded-[50%] border border-white/60 px-[58px] py-5 text-xs font-medium uppercase tracking-[0.22em] text-white transition-colors duration-300 hover:border-white hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-light"
              >
                Open the demo
              </Link>
            </Reveal>
          </section>
        </main>

        <SiteFooter />
      </div>
    </MotionProvider>
  );
}

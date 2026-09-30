import Link from "next/link";
import CountUp from "./_components/CountUp";
import Dock from "./_components/Dock";
import FlowDiagram from "./_components/FlowDiagram";
import Grow from "./_components/Grow";
import Hero from "./_components/Hero";
import MotionProvider from "./_components/MotionProvider";
import Reveal from "./_components/Reveal";
import SiteFooter from "./_components/SiteFooter";
import TiltCard from "./_components/TiltCard";
import { GITHUB_URL, TEAM } from "@/lib/site";

const TIERS = [
  { range: "0 to 1 h", title: "Sharp 2 km map", body: "Where the storm will be, cell by cell", grow: 1, shade: "bg-accent border-accent" },
  { range: "1 to 3 h", title: "Probability zones", body: "Areas with a chance of each hazard", grow: 2, shade: "bg-[#2a5f91]/70 border-[#3b76ad]/60" },
  { range: "3 to 6 h", title: "Area outlook", body: "Broad regions to watch", grow: 3, shade: "bg-accent-light/[0.08] border-accent-light/25" },
];

const ICON = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

const HAZARDS = [
  {
    name: "Lightning",
    body: "Where strikes are likely in the next hour.",
    experimental: false,
    icon: <path {...ICON} d="M13.5 3 6 13.2h5.2L10 21l7.5-10.2h-5.2z" />,
  },
  {
    name: "New storms forming",
    body: "Early signs of new cells from satellite cloud tops.",
    experimental: false,
    icon: (
      <>
        <path {...ICON} d="M7 17a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 17z" />
        <path {...ICON} d="M12 11v4M10 13h4" />
      </>
    ),
  },
  {
    name: "Hail",
    body: "Cells with a strong hail signal on radar.",
    experimental: true,
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
    body: "Rain rates crossing a cloudburst threshold.",
    experimental: true,
    icon: (
      <>
        <path {...ICON} d="M7 13a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 13z" />
        <path {...ICON} d="M8 16l-1 3M12 16l-1 4M16 16l-1 3" />
      </>
    ),
  },
  {
    name: "Damaging gusts",
    body: "Strong outflow winds ahead of storm cells.",
    experimental: true,
    icon: <path {...ICON} d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7" />,
  },
];

type Status = "approved" | "open" | "planned" | "future";

const SOURCES: { name: string; what: string; use: string; status: Status; label: string }[] = [
  { name: "MOSDAC TERLS Doppler radar", what: "Radar reflectivity and winds, Thiruvananthapuram", use: "Storm cells and motion", status: "approved", label: "Access approved" },
  { name: "MOSDAC INSAT-3D/3DR", what: "Infrared cloud top imagery", use: "Storm growth and new cells", status: "approved", label: "Access approved" },
  { name: "ERA5 (Copernicus)", what: "Hourly atmospheric reanalysis", use: "Instability and wind context", status: "open", label: "Open" },
  { name: "SEVIR benchmark", what: "Public storm event dataset (radar, satellite, lightning)", use: "Model pre-training and testing", status: "open", label: "Open" },
  { name: "IITM lightning network", what: "Ground lightning strike data", use: "Lightning labels and checks", status: "planned", label: "Planned request" },
  { name: "Live IMD radar", what: "Real-time national radar network", use: "Live operation", status: "future", label: "Future, needs approval" },
];

const STATUS_STYLE: Record<Status, string> = {
  approved: "bg-accent text-white",
  open: "bg-accent-light/15 text-accent-light",
  planned: "border border-accent-light/40 text-accent-light",
  future: "border border-white/15 text-white/55",
};

const ROADMAP = [
  { title: "Idea", body: "Problem study, design and this demo with synthetic data.", current: true },
  { title: "Replay prototype", body: "Run the pipeline on past storm cases from archived radar and satellite data.", current: false },
  { title: "Fusion model", body: "Train the AI fusion model and check it against the pysteps baseline.", current: false },
  { title: "Live feeds with IMD", body: "Connect live feeds, only with IMD approval and partnership.", current: false },
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
                    <CountUp to={2558} />
                  </p>
                  <h3 className="mt-4 text-lg font-semibold">Lightning deaths in India in 2023</h3>
                  <p className="mt-2 leading-relaxed text-white/60">
                    Lightning is one of the biggest natural killers in India. More precise, earlier warnings give people time
                    to get indoors.
                  </p>
                  <p className="mt-auto pt-5 text-xs text-white/40">
                    Source: NCRB, Accidental Deaths and Suicides in India (ADSI) 2023
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
            intro="Every 10 minutes, VajraNow will put radar, satellite and lightning data on one 2 km grid, forecast where storms move and grow, and turn that into IMD colour warnings with arrival times."
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

          {/* Hazards */}
          <Section
            id="hazards"
            eyebrow="Hazards we cover"
            title="Five hazards, honestly labelled"
            intro="Some hazards are harder to predict from the data we can get. We mark those as experimental."
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
                      {h.experimental && (
                        <span className="shrink-0 rounded-full border border-accent-light/35 px-2.5 py-0.5 text-xs font-medium text-accent-light">
                          Experimental
                        </span>
                      )}
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">{h.name}</h3>
                    <p className="mt-2 leading-relaxed text-white/60">{h.body}</p>
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
            title="What we plan to use, and where we stand"
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
                The demo replays a made-up storm over Kerala: hazard zones, arrival windows with a range, and places where we
                say the forecast is not reliable.
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

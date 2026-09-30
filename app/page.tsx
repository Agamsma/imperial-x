import Link from "next/link";
import FlowDiagram from "./_components/FlowDiagram";
import SiteFooter from "./_components/SiteFooter";
import { GITHUB_URL, TEAM } from "@/lib/site";

const NAV = [
  { href: "#problem", label: "Problem" },
  { href: "#how", label: "How it works" },
  { href: "#hazards", label: "Hazards" },
  { href: "#data", label: "Data" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#team", label: "Team" },
];

const QUESTIONS = ["Which hazard?", "Exactly where?", "How sure?", "How many minutes?"];

const PROBLEMS = [
  {
    stat: "Minutes",
    title: "Storms build fast and small",
    body: "A thunderstorm can grow from a few clouds to hail and lightning in well under an hour, over an area only a few kilometres across.",
  },
  {
    stat: "District, 3 h",
    title: "Current nowcasts are broad",
    body: "Today's nowcasts are issued for whole districts and stay valid for 3 hours. Officials cannot tell which town is hit first or when.",
  },
  {
    stat: "2,558",
    title: "Lightning deaths in India in 2023",
    body: "Lightning is one of the biggest natural killers in India. More precise, earlier warnings give people time to get indoors.",
    source: "Source: NCRB, Accidental Deaths and Suicides in India (ADSI) 2023",
  },
];

const TIERS = [
  { range: "0 to 1 h", title: "Sharp 2 km map", body: "Where the storm will be, cell by cell", grow: 1, shade: "bg-accent text-white" },
  { range: "1 to 3 h", title: "Probability zones", body: "Areas with a chance of each hazard", grow: 2, shade: "bg-[#4f79a3] text-white" },
  { range: "3 to 6 h", title: "Area outlook", body: "Broad regions to watch", grow: 3, shade: "bg-accent-soft text-accent" },
];

const HAZARDS = [
  { name: "Lightning", body: "Where strikes are likely in the next hour.", experimental: false },
  { name: "New storms forming", body: "Early signs of new cells from satellite cloud tops.", experimental: false },
  { name: "Hail", body: "Cells with a strong hail signal on radar.", experimental: true },
  { name: "Extreme rain / cloudburst", body: "Rain rates crossing a cloudburst threshold.", experimental: true },
  { name: "Damaging gusts", body: "Strong outflow winds ahead of storm cells.", experimental: true },
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
  open: "bg-accent-soft text-accent",
  planned: "border border-accent/40 text-accent",
  future: "border border-line text-muted",
};

const ROADMAP = [
  { title: "Idea", body: "Problem study, design and this demo with synthetic data.", current: true },
  { title: "Replay prototype", body: "Run the pipeline on past storm cases from archived radar and satellite data.", current: false },
  { title: "Fusion model", body: "Train the AI fusion model and check it against the pysteps baseline.", current: false },
  { title: "Live feeds with IMD", body: "Connect live feeds, only with IMD approval and partnership.", current: false },
];

function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {intro && <p className="mt-4 text-lg text-muted">{intro}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-accent">
            <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
              <rect width="32" height="32" rx="7" fill="#1F4E79" />
              <path d="M18 4 8 18h7l-2 10 11-15h-7z" fill="#F2C94C" />
            </svg>
            VajraNow
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-accent">
                {n.label}
              </a>
            ))}
          </nav>
          <Link href="/demo" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90">
            View demo
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            <p className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
              Smart India Hackathon 2026 · SIH26084 · Ministry of Earth Sciences
            </p>
            <h1 className="mt-6 text-5xl font-bold tracking-tight text-accent sm:text-6xl">VajraNow</h1>
            <p className="mt-6 text-xl leading-relaxed text-ink">
              A web dashboard that tells officials which storm hazard is coming, exactly where, how sure we are, and how
              many minutes they have.
            </p>
            <p className="mt-4 text-muted">
              Convective scale nowcasting for thunderstorms, hail and cloudbursts, up to 6 hours ahead.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demo" className="rounded-lg bg-accent px-6 py-3 font-semibold text-white hover:bg-accent/90">
                View demo
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-accent px-6 py-3 font-semibold text-accent hover:bg-accent-soft"
              >
                GitHub
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {QUESTIONS.map((q, i) => (
              <div key={q} className="rounded-2xl border border-line bg-white p-6 shadow-sm">
                <p className="font-mono text-sm text-muted">0{i + 1}</p>
                <p className="mt-3 text-xl font-semibold text-ink sm:text-2xl">{q}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Problem */}
        <section id="problem" className="scroll-mt-16 border-t border-line bg-[#f7f9fb] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="The problem" title="Storm warnings come too late and cover too much" />
            <div className="grid gap-6 md:grid-cols-3">
              {PROBLEMS.map((p) => (
                <div key={p.title} className="flex flex-col rounded-2xl border border-line bg-white p-6">
                  <p className="text-3xl font-bold text-accent">{p.stat}</p>
                  <h3 className="mt-3 text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-muted">{p.body}</p>
                  {p.source && <p className="mt-auto pt-4 text-xs text-muted">{p.source}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-16 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="How it works (planned)"
              title="From raw radar to a clear decision"
              intro="Every 10 minutes, VajraNow will put radar, satellite and lightning data on one 2 km grid, forecast where storms move and grow, and turn that into IMD colour warnings with arrival times."
            />
            <div className="rounded-2xl border border-line bg-white p-4 sm:p-8">
              <FlowDiagram />
            </div>
            <p className="mt-4 text-sm text-muted">
              Design notes live in the <a href={`${GITHUB_URL}/tree/main/design`} className="text-accent underline">design folder</a> of the repo.
            </p>

            <h3 className="mt-16 text-xl font-semibold">Lead-time tiers</h3>
            <p className="mt-2 text-muted">The further ahead we look, the less detail we promise.</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              {TIERS.map((t) => (
                <div key={t.range} className={`rounded-xl p-4 ${t.shade}`} style={{ flexGrow: t.grow, flexBasis: 0 }}>
                  <p className="font-mono text-sm opacity-80">{t.range}</p>
                  <p className="mt-1 font-semibold">{t.title}</p>
                  <p className="mt-1 text-sm opacity-80">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Hazards */}
        <section id="hazards" className="scroll-mt-16 border-t border-line bg-[#f7f9fb] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Hazards we cover"
              title="Five hazards, honestly labelled"
              intro="Some hazards are harder to predict from the data we can get. We mark those as experimental."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {HAZARDS.map((h) => (
                <div key={h.name} className="rounded-2xl border border-line bg-white p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold">{h.name}</h3>
                    {h.experimental && (
                      <span className="shrink-0 rounded-full border border-accent/40 px-2 py-0.5 text-xs font-medium text-accent">
                        Experimental
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-muted">{h.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Data */}
        <section id="data" className="scroll-mt-16 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Data sources"
              title="What we plan to use, and where we stand"
              intro="No MOSDAC or IMD data is stored in this site or repo. Their terms do not allow redistribution."
            />
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[#f7f9fb] text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Source</th>
                    <th className="px-4 py-3 font-semibold">What it is</th>
                    <th className="px-4 py-3 font-semibold">Used for</th>
                    <th className="px-4 py-3 font-semibold">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {SOURCES.map((s) => (
                    <tr key={s.name} className="border-t border-line">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-muted">{s.what}</td>
                      <td className="px-4 py-3 text-muted">{s.use}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[s.status]}`}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="scroll-mt-16 border-t border-line bg-[#f7f9fb] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="Roadmap" title="Step by step, with checks at each stage" />
            <ol className="grid gap-4 md:grid-cols-4">
              {ROADMAP.map((r, i) => (
                <li
                  key={r.title}
                  className={`relative rounded-2xl border bg-white p-6 ${r.current ? "border-accent ring-1 ring-accent" : "border-line"}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        r.current ? "bg-accent text-white" : "bg-accent-soft text-accent"
                      }`}
                    >
                      {i + 1}
                    </span>
                    {r.current && <span className="text-xs font-semibold uppercase tracking-wider text-accent">We are here</span>}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{r.title}</h3>
                  <p className="mt-2 text-sm text-muted">{r.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Team */}
        <section id="team" className="scroll-mt-16 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="Team OmniSense" title="Who we are" intro="Team ID 167415, Smart India Hackathon 2026." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TEAM.map((m) => (
                <div key={m.name} className="flex items-center gap-4 rounded-2xl border border-line p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">
                    {m.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div>
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-sm text-muted">{m.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

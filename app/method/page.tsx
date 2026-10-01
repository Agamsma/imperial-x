import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "../_components/SiteFooter";
import { GITHUB_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Method | VajraNow",
  description: "How the VajraNow nowcasting engine works, step by step, with the numbers it uses. Runs on synthetic storms today.",
};

const STEPS = [
  {
    id: "grid",
    title: "1. One grid, every 10 minutes",
    body: [
      "Everything lives on one grid of 2 km cells (189 by 209 cells) over south Kerala, covering the TERLS Doppler radar's 250 km range. The cells are square in Web Mercator, so the engine's maps drop straight onto the web map with no warping.",
      "The engine looks at the last 60 minutes of radar scans, the two latest infrared satellite images, and lightning from the last 10 minutes.",
    ],
  },
  {
    id: "qc",
    title: "2. Quality checks",
    body: [
      "Ground clutter: pixels that stay strong in at least 80% of scans, barely change (under 2.5 dB), and stand at least 15 dB above their surroundings are removed. Real storms move and vary; clutter does not.",
      "Speckle: single strong pixels with almost no echo around them are removed.",
      "Missing scans are reported, not hidden, and tracking uses the scans that remain. Satellite delay is shown on the dashboard.",
    ],
  },
  {
    id: "motion",
    title: "3. Storm motion (TREC tracking)",
    body: [
      "TREC (Tracking Radar Echoes by Correlation) splits a scan into 30 km blocks every 12 km and finds the shift, up to 12 km per 10 minutes (about 72 km/h), that best matches the next scan. Each best shift is the local motion, refined to a fraction of a cell.",
      "Two scan pairs are blended. Vectors that disagree strongly with their neighbours are replaced, blocks without echo are filled from nearby good vectors, and the field is smoothed. A confidence value is kept for every cell: high where echoes were matched well, low where motion had to be guessed.",
    ],
  },
  {
    id: "extrapolation",
    title: "4. Extrapolation (the baseline)",
    body: [
      "For each forecast time, every cell looks back along the motion to where its air was at the start and takes the radar value there (semi-Lagrangian advection, with a midpoint step). This is the same idea as the pysteps baseline the project plans to use, written in numpy.",
      "On its own it assumes storms keep their strength. That is the baseline every other step must beat.",
    ],
  },
  {
    id: "fusion",
    title: "5. Fusion step (growth and new storms)",
    body: [
      "A small neural network (4 dilated convolution layers, about 17 thousand weights, on a 4 km version of the grid) predicts how reflectivity will change over the next 30 and 60 minutes, moving with the storm. Its inputs: radar now, infrared cloud top temperature, cloud top cooling rate, recent lightning, and the radar trend over the last 10 minutes.",
      "Fast-cooling cloud tops often show a growing storm before radar sees much rain. That lets the engine flag new storms (experimental).",
      "It was trained with PyTorch on 600 sets of synthetic storms and exported to numpy, so the live API needs no deep learning library. It stands in for the planned AI fusion model: it shows the pipeline works, and says nothing yet about real storms.",
    ],
  },
  {
    id: "ensemble",
    title: "6. Ensemble and probabilities",
    body: [
      "The engine runs 20 slightly different forecasts plus a control run. Each one gets a different storm speed, a small shift in motion (larger where tracking confidence is low), a different amount of growth or decay, and intensity noise that moves with the storm and grows with lead time.",
      "The probability of a hazard at a place is the share of runs that show it within about 3 km (up to 60 minutes ahead) or about 5 km (70 to 120 minutes ahead).",
    ],
  },
  {
    id: "decide",
    title: "7. Arrival windows and honest flags",
    body: [
      "A storm core is reflectivity of 45 dBZ or more within about 3 km. For each place, the engine finds when each ensemble run brings a core there. The arrival window is the 10th to 90th percentile of those times, rounded to 5 minutes, with the share of runs that agree.",
      "If at least half the runs agree, the window is shown. Between 20% and 50%, the place gets 'possible' with the chance. Hill places (above 800 m) where tracking confidence along the incoming path is below 0.45 get 'Not reliable (terrain, low motion confidence)' instead of a time. Places outside radar coverage are marked as such.",
    ],
  },
];

const THRESHOLDS = [
  ["35 dBZ", "Thunderstorm echo", "Yellow if the chance is 30% or more"],
  ["40 dBZ", "Lightning likely", "Shown as a hazard when the chance is 50% or more"],
  ["45 dBZ", "Heavy thunderstorm core", "Orange if the chance is 40% or more"],
  ["50 dBZ", "Severe core", "Red if the chance is 50% or more"],
  ["55 dBZ", "Hail signal (experimental)", "Shown when the chance is 30% or more"],
  ["50 mm in the next hour", "Very heavy rain burst (experimental)", "Orange if the chance is 40% or more"],
  ["100 mm in the next hour", "Cloudburst threshold (experimental)", "Red if the chance is 40% or more"],
];

export default function MethodPage() {
  return (
    <div className="flex flex-1 flex-col bg-night text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-semibold tracking-wide">
            VajraNow
          </Link>
          <nav className="flex gap-5 text-sm text-white/60">
            <Link href="/demo" className="hover:text-white">
              Demo
            </Link>
            <a href="/api/py/docs" className="hover:text-white">
              API
            </a>
            <a href={GITHUB_URL} className="hover:text-white" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent-light">Method</p>
        <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">How the VajraNow engine works</h1>
        <p className="mt-5 text-lg leading-relaxed text-white/65">
          The engine already runs end to end, on synthetic storms. This page explains each step, the numbers it uses, and what is
          still missing before it can be trusted with real data.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-accent-light/30 bg-accent-light/[0.06] p-6">
            <p className="font-semibold text-accent-light">Runs today</p>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Every step below, on synthetic radar, satellite and lightning data made in code, behind a public API. Automated tests
              check each step on every change.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="font-semibold">Not built yet</p>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Reading real MOSDAC radar and satellite files, a fusion model trained on real storms, verification on past Indian storm
              cases, and any live operation (only with IMD).
            </p>
          </div>
        </div>

        <nav aria-label="Steps" className="mt-10 flex flex-wrap gap-2 text-sm">
          {STEPS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full border border-white/15 px-3 py-1 text-white/70 hover:border-white/40 hover:text-white">
              {s.title.replace(/^\d+\. /, "")}
            </a>
          ))}
          <a href="#thresholds" className="rounded-full border border-white/15 px-3 py-1 text-white/70 hover:border-white/40 hover:text-white">
            Thresholds
          </a>
          <a href="#verification" className="rounded-full border border-white/15 px-3 py-1 text-white/70 hover:border-white/40 hover:text-white">
            Verification
          </a>
        </nav>

        <div className="mt-12 space-y-12">
          {STEPS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-20">
              <h2 className="font-serif text-2xl sm:text-3xl">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p.slice(0, 24)} className="mt-4 leading-relaxed text-white/70">
                  {p}
                </p>
              ))}
            </section>
          ))}

          <section id="thresholds" className="scroll-mt-20">
            <h2 className="font-serif text-2xl sm:text-3xl">8. Hazards and IMD colours</h2>
            <p className="mt-4 leading-relaxed text-white/70">
              Colours follow the IMD scheme: Green (no warning), Yellow (be updated), Orange (be prepared), Red (take action). The
              thresholds below are illustrative starting points from the radar literature and will be agreed with IMD before any real use.
            </p>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-white/45">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Threshold</th>
                    <th className="px-4 py-3 font-semibold">Meaning</th>
                    <th className="px-4 py-3 font-semibold">Effect</th>
                  </tr>
                </thead>
                <tbody>
                  {THRESHOLDS.map(([a, b, c]) => (
                    <tr key={a} className="border-t border-white/[0.07]">
                      <td className="px-4 py-3 font-medium text-white">{a}</td>
                      <td className="px-4 py-3 text-white/65">{b}</td>
                      <td className="px-4 py-3 text-white/65">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/55">
              Rain rate uses Z = 300 R<sup>1.4</sup>, the common relation for convective rain, with reflectivity capped at 53 dBZ because
              stronger echoes are usually hail, not more rain. IMD calls 100 mm of rain in an hour over a small area a cloudburst.
            </p>
          </section>

          <section id="tiers" className="scroll-mt-20">
            <h2 className="font-serif text-2xl sm:text-3xl">9. Lead-time tiers</h2>
            <p className="mt-4 leading-relaxed text-white/70">
              Up to 60 minutes: a sharp 2 km map. From 70 to 120 minutes: probability zones with a wider neighbourhood. From 3 to 6
              hours: a broad area outlook only, built from storm areas carried on by the average motion and from new-storm zones, then
              coarsened to about 10 km blocks. The further ahead, the less detail is promised.
            </p>
          </section>

          <section id="verification" className="scroll-mt-20">
            <h2 className="font-serif text-2xl sm:text-3xl">10. Verification</h2>
            <p className="mt-4 leading-relaxed text-white/70">
              Every forecast method is compared with the extrapolation baseline and with simple persistence on the same cases, using
              standard scores: probability of detection, false alarm ratio, critical success index, and the fractions skill score over 20 km.
            </p>
            <p className="mt-4 leading-relaxed text-white/70">
              Today these comparisons run on held-out synthetic storms inside the automated tests, so a change that makes things worse
              than the baseline fails the build. Scores on synthetic storms say nothing about real skill, so none are published. Real
              scores will come from past storm cases once MOSDAC data is in.
            </p>
          </section>

          <section id="api" className="scroll-mt-20">
            <h2 className="font-serif text-2xl sm:text-3xl">11. Open API</h2>
            <p className="mt-4 leading-relaxed text-white/70">
              The dashboard reads everything from the engine&apos;s API, so any other tool can too. Interactive docs are at{" "}
              <a href="/api/py/docs" className="text-accent-light underline underline-offset-4">
                /api/py/docs
              </a>
              .
            </p>
            <ul className="mt-4 space-y-2 font-mono text-sm text-white/70">
              <li>GET /api/py/health</li>
              <li>GET /api/py/v1/scenarios</li>
              <li>GET /api/py/v1/nowcast/&#123;scenario&#125;</li>
              <li>GET /api/py/v1/nowcast/&#123;scenario&#125;/point?lon=&amp;lat=</li>
              <li>GET /api/py/v1/method</li>
            </ul>
          </section>

          <section id="limits" className="scroll-mt-20">
            <h2 className="font-serif text-2xl sm:text-3xl">12. Limits and next steps</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-white/70">
              <li>Synthetic storms are simpler than real ones: no terrain effects on rain, no beam blockage, no attenuation.</li>
              <li>Hail, gusts and cloudburst flags use reflectivity only. Real use needs radar volume data, dual-polarisation fields and local tuning.</li>
              <li>The fusion network has only seen synthetic storms. It must be retrained and checked on real MOSDAC cases.</li>
              <li>Next: read archived TERLS radar and INSAT-3D/3DR files, replay past Kerala storms, and score against the baseline.</li>
            </ul>
          </section>
        </div>

        <div className="mt-16 flex flex-wrap gap-4">
          <Link
            href="/demo"
            className="rounded-[50%] border border-white/60 px-[52px] py-4 text-xs font-medium uppercase tracking-[0.22em] transition-colors hover:border-white hover:bg-white/10"
          >
            Open the demo
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

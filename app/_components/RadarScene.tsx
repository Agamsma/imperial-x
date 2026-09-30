"use client";

import { motion, type MotionValue } from "framer-motion";
import { useEffect, useRef } from "react";

// Hero background: an illustrative radar scope drawn in code, tilted in 3D.
// The storm cells are made up. This is decoration, not real radar data.

const ACCENT = "141,185,227";
const TAU = Math.PI * 2;
const SWEEP_SECONDS = 6;
const REDUCED_T = 2.3; // frame shown when motion is reduced

// Motion of the made-up storms: towards the north-east (canvas y points down).
const DIR = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
const PERP = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
const DRIFT = 0.012; // scope radii per second

type Part = { dx: number; dy: number; s: number };
type Cell = { x: number; y: number; r: number; k: number; parts: Part[] };
type Bolt = { lines: { pts: [number, number][]; w: number }[]; born: number };
type Drop = { x: number; y: number; len: number; v: number };

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// x, y in scope radii; r = size; k = intensity (0 to 1).
const SEED_CELLS: [number, number, number, number][] = [
  [-0.32, 0.3, 0.13, 0.95],
  [0.2, 0.02, 0.1, 0.72],
  [-0.08, 0.55, 0.085, 0.5],
  [0.42, -0.34, 0.12, 0.88],
  [-0.62, -0.08, 0.08, 0.45],
  [0.06, -0.58, 0.07, 0.62],
  [0.6, 0.36, 0.09, 0.5],
  [-0.3, -0.42, 0.075, 0.4],
];

function makeCells(rand: () => number): Cell[] {
  return SEED_CELLS.map(([x, y, r, k]) => ({
    x,
    y,
    r,
    k,
    parts: [
      { dx: 0, dy: 0, s: 1 },
      { dx: 0.55 + rand() * 0.3, dy: (rand() - 0.5) * 0.5, s: 0.55 + rand() * 0.2 },
      { dx: -0.5 - rand() * 0.3, dy: (rand() - 0.5) * 0.6, s: 0.45 + rand() * 0.2 },
    ],
  }));
}

function layer(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  if (a <= 0.003 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.55, `rgba(${rgb},${a * 0.75})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// Hazard colours: yellow, orange, red. Light rain is a plain blue haze.
function drawEcho(ctx: CanvasRenderingContext2D, r: number, k: number, glow: number) {
  layer(ctx, 0, 0, r * 1.8, "63,127,181", 0.16 * glow);
  layer(ctx, 0, 0, r, "242,201,76", 0.6 * glow);
  if (k > 0.45) layer(ctx, 0, 0, r * 0.62, "242,153,74", 0.75 * glow * k);
  if (k > 0.7) layer(ctx, 0, 0, r * 0.32, "214,69,69", 0.95 * glow * k);
}

function buildStatic(size: number, font: string) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const cx = size / 2;
  const R = cx * 0.96;
  const s = size / 1400;

  const disk = ctx.createRadialGradient(cx, cx, 0, cx, cx, R);
  disk.addColorStop(0, "rgba(24,58,94,0.55)");
  disk.addColorStop(0.7, "rgba(12,30,52,0.4)");
  disk.addColorStop(1, "rgba(8,18,32,0.08)");
  ctx.fillStyle = disk;
  ctx.beginPath();
  ctx.arc(cx, cx, R, 0, TAU);
  ctx.fill();

  // 2 km style grid dots, fading towards the edge.
  const step = size / 58;
  for (let x = step / 2; x < size; x += step) {
    for (let y = step / 2; y < size; y += step) {
      const d = Math.hypot(x - cx, y - cx);
      if (d > R) continue;
      ctx.fillStyle = `rgba(${ACCENT},${0.05 + 0.2 * (1 - d / R)})`;
      ctx.fillRect(x - 0.9 * s, y - 0.9 * s, 1.8 * s, 1.8 * s);
    }
  }

  ctx.lineWidth = 1.3 * s;
  for (let i = 1; i <= 5; i++) {
    ctx.strokeStyle = `rgba(${ACCENT},${i === 5 ? 0.5 : 0.2})`;
    ctx.lineWidth = (i === 5 ? 2.2 : 1.3) * s;
    ctx.beginPath();
    ctx.arc(cx, cx, (R * i) / 5, 0, TAU);
    ctx.stroke();
  }

  ctx.lineWidth = 1 * s;
  ctx.strokeStyle = `rgba(${ACCENT},0.1)`;
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * R * 0.04, cx + Math.sin(ang) * R * 0.04);
    ctx.lineTo(cx + Math.cos(ang) * R, cx + Math.sin(ang) * R);
    ctx.stroke();
  }

  for (let d = 0; d < 360; d += 5) {
    const ang = (d / 360) * TAU;
    const long = d % 30 === 0;
    ctx.strokeStyle = `rgba(${ACCENT},${long ? 0.55 : 0.25})`;
    ctx.lineWidth = (long ? 2 : 1) * s;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * R, cx + Math.sin(ang) * R);
    ctx.lineTo(cx + Math.cos(ang) * (R - (long ? 22 : 10) * s), cx + Math.sin(ang) * (R - (long ? 22 : 10) * s));
    ctx.stroke();
  }

  ctx.fillStyle = `rgba(${ACCENT},0.55)`;
  ctx.font = `500 ${15 * s}px ${font}`;
  for (let i = 1; i <= 5; i++) ctx.fillText(`${i * 50} km`, cx + 8 * s, cx - (R * i) / 5 + 18 * s);
  ctx.font = `600 ${22 * s}px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText("N", cx, cx - R - 14 * s);

  ctx.shadowColor = `rgba(${ACCENT},0.8)`;
  ctx.shadowBlur = 40 * s;
  ctx.strokeStyle = `rgba(${ACCENT},0.35)`;
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(cx, cx, R, 0, TAU);
  ctx.stroke();
  return c;
}

function jag(a: [number, number], b: [number, number], spread: number, depth: number, rand: () => number): [number, number][] {
  if (depth === 0) return [a, b];
  const mx = (a[0] + b[0]) / 2 + (rand() - 0.5) * spread;
  const my = (a[1] + b[1]) / 2 + (rand() - 0.5) * spread * 0.3;
  const m: [number, number] = [mx, my];
  return [...jag(a, m, spread / 2, depth - 1, rand).slice(0, -1), ...jag(m, b, spread / 2, depth - 1, rand)];
}

function makeBolt(w: number, h: number, born: number, rand: () => number): Bolt {
  // Keep bolts to the sides so they never sit behind the headline.
  const left = rand() < 0.5;
  const x0 = w * (left ? 0.06 + rand() * 0.2 : 0.74 + rand() * 0.2);
  const start: [number, number] = [x0, -10];
  const end: [number, number] = [x0 + (rand() - 0.5) * w * 0.1, h * (0.3 + rand() * 0.18)];
  const main = jag(start, end, h * 0.16, 6, rand);
  const lines = [{ pts: main, w: 1 }];
  for (let i = 0; i < 2; i++) {
    const from = main[Math.floor(main.length * (0.3 + rand() * 0.4))];
    const dir = rand() < 0.5 ? -1 : 1;
    const to: [number, number] = [from[0] + dir * w * (0.03 + rand() * 0.05), from[1] + h * (0.08 + rand() * 0.1)];
    lines.push({ pts: jag(from, to, h * 0.06, 4, rand), w: 0.5 });
  }
  return { lines, born };
}

// Brightness of a bolt over its short life, with a flicker.
function boltEnvelope(age: number) {
  if (age < 0.06) return 1;
  if (age < 0.12) return 0.25;
  if (age < 0.2) return 0.85;
  if (age < 0.5) return 0.85 * (1 - (age - 0.2) / 0.3);
  return 0;
}

export default function RadarScene({
  rotateX,
  rotateZ,
  reduceMotion,
}: {
  rotateX: MotionValue<number>;
  rotateZ: MotionValue<number>;
  reduceMotion: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLCanvasElement>(null);
  const skyRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const plane = planeRef.current;
    const sky = skyRef.current;
    const flash = flashRef.current;
    if (!wrap || !plane || !sky || !flash) return;
    const pctx = plane.getContext("2d");
    const sctx = sky.getContext("2d");
    if (!pctx || !sctx) return;

    const rand = mulberry32(20260930);
    const cells = makeCells(rand);
    const font = getComputedStyle(document.body).fontFamily || "sans-serif";
    let size = 0;
    let staticLayer: HTMLCanvasElement | null = null;
    let skyW = 0;
    let skyH = 0;
    let skyDpr = 1;
    let drops: Drop[] = [];
    let bolt: Bolt | null = null;
    let nextBolt = 2.5 + rand() * 2;
    let t = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const next = Math.round(Math.min(1800, plane.clientWidth * dpr));
      if (next > 0 && next !== size) {
        size = next;
        plane.width = plane.height = size;
        staticLayer = buildStatic(size, font);
      }
      skyDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      skyW = wrap.clientWidth;
      skyH = wrap.clientHeight;
      sky.width = Math.round(skyW * skyDpr);
      sky.height = Math.round(skyH * skyDpr);
      const count = Math.round((skyW * skyH) / 15000);
      drops = Array.from({ length: count }, () => ({
        x: rand() * skyW,
        y: rand() * skyH,
        len: 10 + rand() * 14,
        v: 520 + rand() * 360,
      }));
    };

    const drawPlane = (time: number) => {
      if (!staticLayer) return;
      const cx = size / 2;
      const R = cx * 0.96;
      pctx.clearRect(0, 0, size, size);
      pctx.drawImage(staticLayer, 0, 0);

      const sweep = ((time / SWEEP_SECONDS) * TAU) % TAU;
      pctx.save();
      pctx.beginPath();
      pctx.arc(cx, cx, R * 0.985, 0, TAU);
      pctx.clip();

      for (const c of cells) {
        const ang = Math.atan2(c.y, c.x);
        const delta = (((sweep - ang) % TAU) + TAU) % TAU;
        const glow = 0.42 + 0.58 * Math.exp(-delta / 1.3);
        const fade = Math.min(1, (1.02 - Math.hypot(c.x, c.y)) / 0.15);
        if (fade <= 0) continue;
        for (const p of c.parts) {
          pctx.save();
          pctx.translate(cx + c.x * R, cx + c.y * R);
          pctx.rotate(-Math.PI / 4);
          pctx.translate(p.dx * c.r * R, p.dy * c.r * R);
          pctx.scale(1.45, 1);
          drawEcho(pctx, c.r * R * p.s, c.k * (p.s > 0.9 ? 1 : 0.8), glow * fade);
          pctx.restore();
        }
      }

      if (typeof pctx.createConicGradient === "function") {
        const wedge = 1.1;
        const g = pctx.createConicGradient(sweep - wedge, cx, cx);
        g.addColorStop(0, `rgba(${ACCENT},0)`);
        g.addColorStop(wedge / TAU, `rgba(${ACCENT},0.3)`);
        g.addColorStop(wedge / TAU + 0.002, `rgba(${ACCENT},0)`);
        g.addColorStop(1, `rgba(${ACCENT},0)`);
        pctx.fillStyle = g;
        pctx.fillRect(0, 0, size, size);
      }
      pctx.restore();

      const s = size / 1400;
      pctx.save();
      pctx.strokeStyle = "rgba(205,228,250,0.8)";
      pctx.lineWidth = 2 * s;
      pctx.shadowColor = `rgba(${ACCENT},1)`;
      pctx.shadowBlur = 18 * s;
      pctx.beginPath();
      pctx.moveTo(cx, cx);
      pctx.lineTo(cx + Math.cos(sweep) * R, cx + Math.sin(sweep) * R);
      pctx.stroke();
      pctx.restore();
      layer(pctx, cx, cx, 26 * s, "205,228,250", 0.9);
    };

    const drawSky = (time: number, dt: number) => {
      sctx.setTransform(skyDpr, 0, 0, skyDpr, 0, 0);
      sctx.clearRect(0, 0, skyW, skyH);

      sctx.strokeStyle = "rgba(175,205,238,0.11)";
      sctx.lineWidth = 1;
      sctx.beginPath();
      for (const d of drops) {
        d.y += d.v * dt;
        d.x += d.v * 0.18 * dt;
        if (d.y > skyH) {
          d.y = -d.len;
          d.x = rand() * skyW;
        }
        if (d.x > skyW) d.x -= skyW;
        sctx.moveTo(d.x, d.y);
        sctx.lineTo(d.x + d.len * 0.18, d.y + d.len);
      }
      sctx.stroke();

      if (time >= nextBolt) {
        bolt = makeBolt(skyW, skyH, time, rand);
        nextBolt = time + 5 + rand() * 5;
      }
      let flashLevel = 0;
      if (bolt) {
        const env = boltEnvelope(time - bolt.born);
        if (env <= 0) {
          bolt = null;
        } else {
          flashLevel = env;
          sctx.lineCap = "round";
          sctx.lineJoin = "round";
          for (const pass of [
            { color: `rgba(${ACCENT},${0.55 * env})`, width: 5, blur: 24 },
            { color: `rgba(240,247,255,${env})`, width: 1.6, blur: 6 },
          ]) {
            sctx.strokeStyle = pass.color;
            sctx.shadowColor = `rgba(${ACCENT},${env})`;
            sctx.shadowBlur = pass.blur;
            for (const line of bolt.lines) {
              sctx.lineWidth = pass.width * line.w;
              sctx.beginPath();
              line.pts.forEach(([x, y], i) => (i ? sctx.lineTo(x, y) : sctx.moveTo(x, y)));
              sctx.stroke();
            }
          }
          sctx.shadowBlur = 0;
        }
      }
      // Soft, low-contrast flash. Kept well under photosensitivity limits.
      flash.style.opacity = String(flashLevel * 0.07);
    };

    resize();

    if (reduceMotion) {
      drawPlane(REDUCED_T);
      sctx.clearRect(0, 0, sky.width, sky.height);
      flash.style.opacity = "0";
      const ro = new ResizeObserver(() => {
        resize();
        drawPlane(REDUCED_T);
        sctx.clearRect(0, 0, sky.width, sky.height);
      });
      ro.observe(wrap);
      return () => ro.disconnect();
    }

    let raf = 0;
    let last = 0;
    let running = false;

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      t += dt;
      for (const c of cells) {
        c.x += DIR.x * DRIFT * dt;
        c.y += DIR.y * DRIFT * dt;
        if (Math.hypot(c.x, c.y) > 1.05) {
          const side = (rand() - 0.5) * 1.2;
          c.x = -0.95 * DIR.x + side * PERP.x;
          c.y = -0.95 * DIR.y + side * PERP.y;
        }
      }
      drawPlane(t);
      drawSky(t, dt);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
      flash.style.opacity = "0";
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    // Only animate while the hero is on screen.
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    io.observe(wrap);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
    };
  }, [reduceMotion]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 75% at 50% 0%, #0f2033 0%, #070c14 55%, #05080d 100%)" }}
      />
      <div
        className="vn-fog absolute -left-[20%] top-[8%] h-[60%] w-[70%] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(70,110,150,0.45), transparent)" }}
      />
      <div
        className="vn-fog absolute -right-[20%] top-[18%] h-[55%] w-[65%] rounded-full opacity-30 blur-3xl [animation-delay:-14s]"
        style={{ background: "radial-gradient(closest-side, rgba(90,120,160,0.4), transparent)" }}
      />

      <div className="absolute inset-0" style={{ perspective: "1100px", perspectiveOrigin: "50% 25%" }}>
        <motion.div
          className="absolute left-1/2 top-[70%]"
          style={{
            width: "max(92vw, 118vh)",
            height: "max(92vw, 118vh)",
            x: "-50%",
            y: "-50%",
            rotateX,
            rotateZ,
          }}
        >
          <canvas ref={planeRef} className="block h-full w-full" />
        </motion.div>
      </div>

      <canvas ref={skyRef} className="absolute inset-0 h-full w-full" />
      <div ref={flashRef} className="absolute inset-0 bg-[#d6e8ff] opacity-0" />
    </div>
  );
}

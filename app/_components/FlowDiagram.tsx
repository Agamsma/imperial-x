"use client";

import { usePrefersReducedMotion } from "@/lib/useReducedMotionPref";

const INPUTS = ["Doppler radar", "INSAT-3D/3DR IR", "Lightning data"];

const STEPS = [
  { title: "Ingest", lines: ["Pull radar, satellite", "and lightning feeds"] },
  { title: "Align", lines: ["One 2 km grid,", "every 10 minutes"] },
  { title: "Predict", lines: ["pysteps baseline", "+ AI fusion model"] },
  { title: "Decide", lines: ["IMD colours and", "arrival windows"] },
  { title: "Show", lines: ["GIS dashboard", "for officials"] },
];

const LIGHT = "#8DB9E3";
const MUTED = "rgba(255,255,255,0.55)";
const STEP_X0 = 230;
const STEP_W = 130;
const STEP_GAP = 30;
const STEP_Y = 95;
const STEP_H = 80;
const MID_Y = STEP_Y + STEP_H / 2;

const stepX = (i: number) => STEP_X0 + i * (STEP_W + STEP_GAP);

function Pulse({ path, begin, dur = 2.4 }: { path: string; begin: number; dur?: number }) {
  return (
    <circle r="3.2" fill="#dbeafb" filter="url(#pulse-glow)">
      <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={path} />
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
    </circle>
  );
}

export default function FlowDiagram() {
  const reduce = usePrefersReducedMotion();
  const predictMid = stepX(2) + STEP_W / 2;
  const showMid = stepX(4) + STEP_W / 2;
  const loopY = 262;
  const inputPaths = INPUTS.map((_, i) => {
    const y = 40 + i * 70 + 25;
    return `M170 ${y} C 200 ${y}, 200 ${MID_Y}, ${STEP_X0 - 2} ${MID_Y}`;
  });
  const loopPath = `M${showMid} ${STEP_Y + STEP_H} V ${loopY} H ${predictMid} V ${STEP_Y + STEP_H + 4}`;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 1010 310"
        className="w-full min-w-[720px]"
        role="img"
        aria-label="Flow: radar, satellite and lightning inputs go through Ingest, Align, Predict, Decide and Show. Results are verified against a baseline."
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill={LIGHT} />
          </marker>
          <marker id="arrow-muted" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill={MUTED} />
          </marker>
          <filter id="pulse-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="step-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <text x="90" y="22" textAnchor="middle" fontSize="12" fill={MUTED} fontWeight="600" letterSpacing="2">
          INPUTS
        </text>
        {INPUTS.map((label, i) => {
          const y = 40 + i * 70;
          return (
            <g key={label}>
              <rect x="10" y={y} width="160" height="50" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" />
              <text x="90" y={y + 30} textAnchor="middle" fontSize="14" fill="#fff">
                {label}
              </text>
              <path d={inputPaths[i]} fill="none" stroke={LIGHT} strokeOpacity="0.7" strokeWidth="1.5" markerEnd="url(#arrow)" />
            </g>
          );
        })}

        {STEPS.map((step, i) => {
          const x = stepX(i);
          return (
            <g key={step.title}>
              {!reduce && (
                <rect
                  x={x}
                  y={STEP_Y}
                  width={STEP_W}
                  height={STEP_H}
                  rx="12"
                  fill="none"
                  stroke={LIGHT}
                  strokeWidth="4"
                  filter="url(#step-glow)"
                  className="vn-step-glow"
                  style={{ animationDelay: `${0.5 + i * 0.45}s` }}
                />
              )}
              <rect x={x} y={STEP_Y} width={STEP_W} height={STEP_H} rx="12" fill="rgba(13,24,38,0.9)" stroke={LIGHT} strokeOpacity="0.8" strokeWidth="1.3" />
              <text x={x + 12} y={STEP_Y + 22} fontSize="11" fill={MUTED}>
                {i + 1}
              </text>
              <text x={x + STEP_W / 2} y={STEP_Y + 30} textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">
                {step.title}
              </text>
              {step.lines.map((line, j) => (
                <text key={line} x={x + STEP_W / 2} y={STEP_Y + 50 + j * 15} textAnchor="middle" fontSize="11.5" fill={MUTED}>
                  {line}
                </text>
              ))}
              {i < STEPS.length - 1 && (
                <line
                  x1={x + STEP_W}
                  y1={MID_Y}
                  x2={x + STEP_W + STEP_GAP - 2}
                  y2={MID_Y}
                  stroke={LIGHT}
                  strokeOpacity="0.8"
                  strokeWidth="1.5"
                  markerEnd="url(#arrow)"
                />
              )}
            </g>
          );
        })}

        <path
          d={loopPath}
          fill="none"
          stroke={MUTED}
          strokeWidth="1.5"
          strokeDasharray="6 5"
          className="vn-dash-flow"
          markerEnd="url(#arrow-muted)"
        />
        <rect x={(showMid + predictMid) / 2 - 95} y={loopY - 12} width="190" height="24" rx="12" fill="#0a121d" />
        <text x={(showMid + predictMid) / 2} y={loopY + 4} textAnchor="middle" fontSize="13" fill={MUTED} fontStyle="italic">
          Verified against baseline
        </text>

        {!reduce && (
          <g>
            {inputPaths.map((d, i) => (
              <Pulse key={d} path={d} begin={i * 0.5} dur={1.6} />
            ))}
            {STEPS.slice(0, -1).map((_, i) => {
              const x = stepX(i) + STEP_W;
              return <Pulse key={i} path={`M${x} ${MID_Y} H ${x + STEP_GAP - 4}`} begin={0.8 + i * 0.45} dur={0.9} />;
            })}
          </g>
        )}
      </svg>
    </div>
  );
}

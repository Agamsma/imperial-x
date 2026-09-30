const INPUTS = ["Doppler radar", "INSAT-3D/3DR IR", "Lightning data"];

const STEPS = [
  { title: "Ingest", lines: ["Pull radar, satellite", "and lightning feeds"] },
  { title: "Align", lines: ["One 2 km grid,", "every 10 minutes"] },
  { title: "Predict", lines: ["pysteps baseline", "+ AI fusion model"] },
  { title: "Decide", lines: ["IMD colours and", "arrival windows"] },
  { title: "Show", lines: ["GIS dashboard", "for officials"] },
];

const ACCENT = "#1F4E79";
const STEP_X0 = 230;
const STEP_W = 130;
const STEP_GAP = 30;
const STEP_Y = 95;
const STEP_H = 80;
const MID_Y = STEP_Y + STEP_H / 2;

const stepX = (i: number) => STEP_X0 + i * (STEP_W + STEP_GAP);

export default function FlowDiagram() {
  const predictMid = stepX(2) + STEP_W / 2;
  const showMid = stepX(4) + STEP_W / 2;
  const loopY = 262;

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
            <path d="M0 0 10 5 0 10z" fill={ACCENT} />
          </marker>
          <marker id="arrow-muted" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill="#5a6573" />
          </marker>
        </defs>

        <text x="90" y="22" textAnchor="middle" fontSize="12" fill="#5a6573" fontWeight="600" letterSpacing="1">
          INPUTS
        </text>
        {INPUTS.map((label, i) => {
          const y = 40 + i * 70;
          return (
            <g key={label}>
              <rect x="10" y={y} width="160" height="50" rx="8" fill="#f5f7fa" stroke="#e3e7ec" />
              <text x="90" y={y + 30} textAnchor="middle" fontSize="14" fill="#16202b">
                {label}
              </text>
              <path
                d={`M170 ${y + 25} C 200 ${y + 25}, 200 ${MID_Y}, ${STEP_X0 - 2} ${MID_Y}`}
                fill="none"
                stroke={ACCENT}
                strokeWidth="1.5"
                markerEnd="url(#arrow)"
              />
            </g>
          );
        })}

        {STEPS.map((step, i) => {
          const x = stepX(i);
          return (
            <g key={step.title}>
              <rect x={x} y={STEP_Y} width={STEP_W} height={STEP_H} rx="10" fill="#ffffff" stroke={ACCENT} strokeWidth="1.5" />
              <text x={x + 12} y={STEP_Y + 22} fontSize="11" fill="#5a6573">
                {i + 1}
              </text>
              <text x={x + STEP_W / 2} y={STEP_Y + 30} textAnchor="middle" fontSize="16" fontWeight="700" fill={ACCENT}>
                {step.title}
              </text>
              {step.lines.map((line, j) => (
                <text key={line} x={x + STEP_W / 2} y={STEP_Y + 50 + j * 15} textAnchor="middle" fontSize="11.5" fill="#5a6573">
                  {line}
                </text>
              ))}
              {i < STEPS.length - 1 && (
                <line
                  x1={x + STEP_W}
                  y1={MID_Y}
                  x2={x + STEP_W + STEP_GAP - 2}
                  y2={MID_Y}
                  stroke={ACCENT}
                  strokeWidth="1.5"
                  markerEnd="url(#arrow)"
                />
              )}
            </g>
          );
        })}

        <path
          d={`M${showMid} ${STEP_Y + STEP_H} V ${loopY} H ${predictMid} V ${STEP_Y + STEP_H + 4}`}
          fill="none"
          stroke="#5a6573"
          strokeWidth="1.5"
          strokeDasharray="6 5"
          markerEnd="url(#arrow-muted)"
        />
        <rect x={(showMid + predictMid) / 2 - 95} y={loopY - 12} width="190" height="24" rx="12" fill="#ffffff" />
        <text x={(showMid + predictMid) / 2} y={loopY + 4} textAnchor="middle" fontSize="13" fill="#5a6573" fontStyle="italic">
          Verified against baseline
        </text>
      </svg>
    </div>
  );
}

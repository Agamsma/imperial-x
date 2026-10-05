import { ImageResponse } from "next/og";

// Link preview card shown when the site is shared (WhatsApp, LinkedIn, SIH portal).
export const alt = "Imperial-X: storm nowcasting dashboard idea for India. SIH 2026, Team OmniSense.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RINGS = [560, 440, 320, 200];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "radial-gradient(120% 90% at 50% 0%, #10233a 0%, #070c14 60%, #05080d 100%)",
          color: "#fff",
          fontFamily: "serif",
          overflow: "hidden",
        }}
      >
        {/* Radar rings, right side */}
        {RINGS.map((d, i) => (
          <div
            key={d}
            style={{
              position: "absolute",
              right: 90 - d / 2 + 180,
              top: 315 - d / 2,
              width: d,
              height: d,
              borderRadius: "50%",
              border: `${i === 0 ? 3 : 1.5}px solid rgba(141,185,227,${i === 0 ? 0.5 : 0.22})`,
              display: "flex",
            }}
          />
        ))}
        {/* Made-up echo in hazard colours */}
        <div style={{ position: "absolute", right: 250, top: 190, width: 180, height: 120, borderRadius: "50%", background: "rgba(242,201,76,0.35)", display: "flex" }} />
        <div style={{ position: "absolute", right: 285, top: 215, width: 110, height: 72, borderRadius: "50%", background: "rgba(242,153,74,0.6)", display: "flex" }} />
        <div style={{ position: "absolute", right: 318, top: 235, width: 46, height: 32, borderRadius: "50%", background: "rgba(214,69,69,0.9)", display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px", width: 720 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "rgba(255,255,255,0.7)", fontFamily: "sans-serif" }}>
            TEAM OMNISENSE PRESENTS
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 18, lineHeight: 0.95 }}>
            <div style={{ display: "flex", fontSize: 128, letterSpacing: 6 }}>IMPERIAL</div>
            <div style={{ display: "flex", fontSize: 124, fontWeight: 700, letterSpacing: 4 }}>-X</div>
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 30, fontStyle: "italic", color: "rgba(255,255,255,0.85)", lineHeight: 1.35 }}>
            Which storm hazard is coming, where and how precisely, how sure we are, and how many minutes officials have.
          </div>
          <div style={{ display: "flex", marginTop: 32, fontSize: 20, letterSpacing: 3, color: "#8db9e3", fontFamily: "sans-serif" }}>
            SIH 2026 · SIH26084 · IDEA STAGE
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

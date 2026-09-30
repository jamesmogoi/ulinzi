import { ImageResponse } from "next/og";

/*
  The link preview. This game spreads by being shared on WhatsApp and X, so
  this card is its front door more often than the page is.

  Crop-safe: WhatsApp and some other surfaces take a square from the
  middle of the 1200x630, so every word sits inside the centre 630px.
  The palette repeats globals.css (dark mode) as literals because the
  renderer, Satori, cannot read CSS custom properties.
*/

export const alt = "Mlinzi: can you trick the till guard? An AI security game from Nairobi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0d1210";
const LINE = "#26322c";
const INK = "#e8eee9";
const MUTED = "#9aa9a1";
const ACCENT = "#3ddc84";
const GOLD = "#f2b84b";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BG,
          color: INK,
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: "0.22em", color: ACCENT }}>
          UNAWEZA KUMDANGANYA
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 132, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>
          Mlinzi?
        </div>
        <div style={{ display: "flex", marginTop: 22, fontSize: 32, color: MUTED }}>
          Can you trick the till guard?
        </div>
        <div style={{ display: "flex", width: 420, height: 1, marginTop: 36, backgroundColor: LINE }} />
        <div style={{ display: "flex", alignItems: "center", marginTop: 28, fontSize: 21, letterSpacing: "0.12em", color: MUTED }}>
          <span style={{ color: GOLD }}>KES 50,000</span>
          <span style={{ color: LINE, margin: "0 16px" }}>/</span>
          5 LEVELS
          <span style={{ color: LINE, margin: "0 16px" }}>/</span>
          SWAHILI · SHENG
        </div>
      </div>
    ),
    size,
  );
}

import { ImageResponse } from "next/og";

export const alt = "Pranav Thukral, Waterloo CS/BBA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const rows = [
  { label: "Waterloo National Mathematics Scholarship", figure: "$20,000" },
  { label: "Less incident lookup time, SWE @ RBC", figure: "68%" },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "64px 72px",
          background: "#fcfdfb",
          color: "#10231a",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 112, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>
            Pranav Thukral
          </div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 32, color: "#4c5f55" }}>
            Computer Science and Business Administration, Waterloo
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", borderTop: "2px solid #10231a", borderBottom: "6px solid #10231a" }}>
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "18px 20px",
                background: i % 2 === 0 ? "#eaf2ec" : "#fcfdfb",
                fontSize: 32,
              }}
            >
              <div style={{ display: "flex" }}>{row.label}</div>
              <div style={{ display: "flex", fontSize: 52, fontWeight: 800 }}>{row.figure}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}

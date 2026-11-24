import { ImageResponse } from "next/og";

// Home-screen icon for "Add to Home Screen" on iPhone.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const cell = { width: 22, height: 16, borderRadius: 4, background: "#2f5bea" };
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, background: "#2f5bea", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 104, height: 92, background: "#fff", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ height: 22, background: "#dce7ff" }} />
          <div style={{ display: "flex", gap: 10, padding: "12px 16px 0" }}>
            <div style={cell} />
            <div style={cell} />
            <div style={cell} />
          </div>
          <div style={{ display: "flex", gap: 10, padding: "10px 16px 0" }}>
            <div style={cell} />
            <div style={cell} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}

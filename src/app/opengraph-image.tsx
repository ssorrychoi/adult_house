import { ImageResponse } from "next/og";

export const alt = "선생잎 - 선생님들의 익명 커뮤니티";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#eefaf4", color: "#173c31", fontFamily: "sans-serif" }}><div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}><div style={{ fontSize: 116 }}>🌱</div><div style={{ fontSize: 74, fontWeight: 800 }}>선생잎</div><div style={{ fontSize: 34, color: "#527468" }}>선생님들의 마음과 경험이 자라는 곳</div></div></div>, size);
}

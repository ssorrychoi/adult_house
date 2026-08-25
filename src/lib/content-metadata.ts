import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

const unavailable: Metadata = { title: "콘텐츠를 찾을 수 없어요 | 선생잎", robots: { index: false, follow: false } };
const summary = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 140);

export async function contentMetadata(kind: "posts" | "materials" | "jobs" | "reviews", id: number): Promise<Metadata> {
  if (!Number.isSafeInteger(id) || id < 1) return unavailable;
  const path = `/${kind}/${id}`;
  if (kind === "reviews") return {
    title: "어린이집 근무 후기 | 선생잎",
    description: "인증한 선생님이 남긴 어린이집 근무 후기를 확인해 보세요.",
    robots: { index: false, follow: false },
    openGraph: { title: "어린이집 근무 후기", description: "인증한 선생님의 익명 근무 후기", type: "article", url: path, siteName: "선생잎", locale: "ko_KR", images: ["/opengraph-image"] },
  };

  const supabase = await createClient(); let title = ""; let description = "";
  if (kind === "posts" || kind === "materials") {
    const { data } = await supabase.from("posts").select("title,body").eq("id", id).eq("visibility", "public").eq("is_hidden", false).maybeSingle();
    if (!data) return unavailable; title = data.title; description = summary(data.body);
  } else {
    const { data } = await supabase.from("jobs").select("title,description,facility_name,region").eq("id", id).eq("is_published", true).maybeSingle();
    if (!data) return unavailable; title = data.title; description = summary(`${data.facility_name} · ${data.region} · ${data.description}`);
  }

  return {
    title: `${title} | 선생잎`, description, alternates: { canonical: path },
    openGraph: { title, description, type: "article", url: path, siteName: "선생잎", locale: "ko_KR", images: ["/opengraph-image"] },
    twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
  };
}

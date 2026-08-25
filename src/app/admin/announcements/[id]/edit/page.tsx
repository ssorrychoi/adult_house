"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./edit.module.css";

type Announcement = { id: number; title: string; body: string; image_path: string | null; is_published: boolean };

export default function EditAnnouncementPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: auth }) => {
      if (!auth.user) return setReady(true);
      const { data: admin } = await supabase.from("admin_users").select("role").eq("user_id", auth.user.id).eq("is_active", true).maybeSingle();
      if (!admin || !["super_admin", "moderator"].includes(admin.role)) return setReady(true);
      const { data } = await supabase.from("announcements").select("id,title,body,image_path,is_published").eq("id", id).maybeSingle();
      setAnnouncement(data as Announcement | null);
      if (data?.image_path) setImageUrl((await supabase.storage.from("announcement-images").createSignedUrl(data.image_path, 300)).data?.signedUrl ?? null);
      setReady(true);
    });
  }, [id, supabase]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!announcement) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("image") as File;
    let image_path = announcement.image_path;
    if (file.size) {
      if (file.size > 5242880 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return window.alert("5MB 이하 JPG, PNG, WebP 이미지만 올릴 수 있어요.");
      image_path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("announcement-images").upload(image_path, file);
      if (error) return window.alert(error.message);
    }
    const published = form.get("is_published") === "on";
    const { error } = await supabase.from("announcements").update({ title: form.get("title"), body: form.get("body"), image_path, is_published: published, published_at: published ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", announcement.id);
    if (error) return window.alert(error.message);
    if (file.size && announcement.image_path) await supabase.storage.from("announcement-images").remove([announcement.image_path]);
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) await supabase.from("admin_audit_logs").insert({ admin_id: auth.user.id, action: "announcement_updated", target_type: "announcement", target_id: String(announcement.id) });
    router.push("/admin#announcements");
  };

  if (!ready) return <main className={styles.center}>공지사항을 불러오고 있어요.</main>;
  if (!announcement) return <main className={styles.center}><h1>공지를 찾을 수 없거나 권한이 없습니다.</h1><Link href="/admin">관리자로 돌아가기</Link></main>;

  return <main className={styles.page}><header><Link href="/admin#announcements">← 공지 목록</Link><div><small>ADMIN CONSOLE</small><h1>공지사항 수정</h1></div></header><form onSubmit={save}><label>제목<input name="title" required minLength={2} maxLength={100} defaultValue={announcement.title}/></label><label>내용<textarea name="body" required minLength={2} maxLength={5000} defaultValue={announcement.body}/></label>{imageUrl && <div role="img" aria-label="현재 공지 이미지" className={styles.image} style={{ backgroundImage: `url(${imageUrl})` }}/>}<label>이미지 교체<input name="image" type="file" accept="image/jpeg,image/png,image/webp"/><small>선택하지 않으면 기존 이미지를 유지합니다.</small></label><label className={styles.check}><input name="is_published" type="checkbox" defaultChecked={announcement.is_published}/> 사용자에게 공개</label><div className={styles.actions}><Link href="/admin#announcements">취소</Link><button type="submit">변경사항 저장</button></div></form></main>;
}

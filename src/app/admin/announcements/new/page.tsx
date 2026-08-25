"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import styles from "../[id]/edit/edit.module.css";

export default function NewAnnouncementPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: auth }) => {
      if (!auth.user) return setReady(true);
      const { data: admin } = await supabase.from("admin_users").select("role").eq("user_id", auth.user.id).eq("is_active", true).maybeSingle();
      if (admin && ["super_admin", "moderator"].includes(admin.role)) setUser(auth.user);
      setReady(true);
    });
  }, [supabase]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("image") as File;
    let image_path: string | null = null;
    if (file.size) {
      if (file.size > 5242880 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return window.alert("5MB 이하 JPG, PNG, WebP 이미지만 올릴 수 있어요.");
      image_path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("announcement-images").upload(image_path, file);
      if (error) return window.alert(error.message);
    }
    const published = form.get("is_published") === "on";
    const { data, error } = await supabase.from("announcements").insert({ title: form.get("title"), body: form.get("body"), image_path, is_published: published, published_at: published ? new Date().toISOString() : null, created_by: user.id }).select("id").single();
    if (error) {
      if (image_path) await supabase.storage.from("announcement-images").remove([image_path]);
      return window.alert(error.message);
    }
    await supabase.from("admin_audit_logs").insert({ admin_id: user.id, action: "announcement_created", target_type: "announcement", target_id: String(data.id) });
    router.push("/admin#announcements");
  };

  if (!ready) return <main className={styles.center}>관리자 권한을 확인하고 있어요.</main>;
  if (!user) return <main className={styles.center}><h1>공지 등록 권한이 없습니다.</h1><Link href="/admin">관리자로 돌아가기</Link></main>;

  return <main className={styles.page}><header><Link href="/admin#announcements">← 공지 목록</Link><div><small>ADMIN CONSOLE</small><h1>공지사항 등록</h1></div></header><form onSubmit={create}><label>제목<input name="title" required minLength={2} maxLength={100} placeholder="공지 제목을 입력해 주세요"/></label><label>내용<textarea name="body" required minLength={2} maxLength={5000} placeholder="공지 내용을 입력해 주세요"/></label><label>이미지 (선택)<input name="image" type="file" accept="image/jpeg,image/png,image/webp"/><small>5MB 이하 JPG, PNG, WebP</small></label><label className={styles.check}><input name="is_published" type="checkbox" defaultChecked/> 바로 공개</label><div className={styles.actions}><Link href="/admin#announcements">취소</Link><button type="submit">공지 등록</button></div></form></main>;
}

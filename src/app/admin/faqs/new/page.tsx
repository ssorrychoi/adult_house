"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import styles from "../../announcements/[id]/edit/edit.module.css";

export default function NewFaqPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { supabase.auth.getUser().then(async ({ data: auth }) => { if (!auth.user) return setReady(true); const { data } = await supabase.from("admin_users").select("role").eq("user_id", auth.user.id).eq("is_active", true).maybeSingle(); if (data && ["super_admin", "moderator"].includes(data.role)) setUser(auth.user); setReady(true); }); }, [supabase]);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const { data, error } = await supabase.from("faqs").insert({ category: form.get("category"), question: form.get("question"), answer: form.get("answer"), sort_order: Number(form.get("sort_order")), is_published: form.get("is_published") === "on", created_by: user.id }).select("id").single();
    if (error) return window.alert(error.message);
    await supabase.from("admin_audit_logs").insert({ admin_id: user.id, action: "faq_created", target_type: "faq", target_id: String(data.id) });
    router.push("/admin#faqs");
  };
  if (!ready) return <main className={styles.center}>관리자 권한을 확인하고 있어요.</main>;
  if (!user) return <main className={styles.center}><h1>FAQ 등록 권한이 없습니다.</h1><Link href="/admin">관리자로 돌아가기</Link></main>;
  return <main className={styles.page}><header><Link href="/admin#faqs">← FAQ 목록</Link><div><small>ADMIN CONSOLE</small><h1>FAQ 등록</h1></div></header><form onSubmit={create}><label>카테고리<input name="category" required minLength={2} maxLength={30} placeholder="예: 계정·인증"/></label><label>질문<input name="question" required minLength={2} maxLength={200} placeholder="자주 묻는 질문을 입력해 주세요"/></label><label>답변<textarea name="answer" required minLength={2} maxLength={5000} placeholder="답변을 입력해 주세요"/></label><label>노출 순서<input name="sort_order" type="number" min="0" max="32767" defaultValue="0"/></label><label className={styles.check}><input name="is_published" type="checkbox" defaultChecked/> 바로 공개</label><div className={styles.actions}><Link href="/admin#faqs">취소</Link><button type="submit">FAQ 등록</button></div></form></main>;
}

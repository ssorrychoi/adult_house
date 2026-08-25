"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../../../announcements/[id]/edit/edit.module.css";

type Faq = { id: number; category: string; question: string; answer: string; sort_order: number; is_published: boolean };

export default function EditFaqPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [faq, setFaq] = useState<Faq | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { supabase.auth.getUser().then(async ({ data: auth }) => { if (!auth.user) return setReady(true); const { data: admin } = await supabase.from("admin_users").select("role").eq("user_id", auth.user.id).eq("is_active", true).maybeSingle(); if (!admin || !["super_admin", "moderator"].includes(admin.role)) return setReady(true); const { data } = await supabase.from("faqs").select("id,category,question,answer,sort_order,is_published").eq("id", id).maybeSingle(); setFaq(data as Faq | null); setReady(true); }); }, [id, supabase]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!faq) return;
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("faqs").update({ category: form.get("category"), question: form.get("question"), answer: form.get("answer"), sort_order: Number(form.get("sort_order")), is_published: form.get("is_published") === "on", updated_at: new Date().toISOString() }).eq("id", faq.id);
    if (error) return window.alert(error.message);
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) await supabase.from("admin_audit_logs").insert({ admin_id: auth.user.id, action: "faq_updated", target_type: "faq", target_id: String(faq.id) });
    router.push("/admin#faqs");
  };
  if (!ready) return <main className={styles.center}>FAQ를 불러오고 있어요.</main>;
  if (!faq) return <main className={styles.center}><h1>FAQ를 찾을 수 없거나 권한이 없습니다.</h1><Link href="/admin">관리자로 돌아가기</Link></main>;
  return <main className={styles.page}><header><Link href="/admin#faqs">← FAQ 목록</Link><div><small>ADMIN CONSOLE</small><h1>FAQ 수정</h1></div></header><form onSubmit={save}><label>카테고리<input name="category" required minLength={2} maxLength={30} defaultValue={faq.category}/></label><label>질문<input name="question" required minLength={2} maxLength={200} defaultValue={faq.question}/></label><label>답변<textarea name="answer" required minLength={2} maxLength={5000} defaultValue={faq.answer}/></label><label>노출 순서<input name="sort_order" type="number" min="0" max="32767" defaultValue={faq.sort_order}/></label><label className={styles.check}><input name="is_published" type="checkbox" defaultChecked={faq.is_published}/> 사용자에게 공개</label><div className={styles.actions}><Link href="/admin#faqs">취소</Link><button type="submit">변경사항 저장</button></div></form></main>;
}

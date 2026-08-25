"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../../../announcements/[id]/edit/edit.module.css";

type Inquiry = { id: number; title: string; body: string; status: string; answer: string | null; created_at: string; profiles: { nickname: string } | null };

export default function AnswerInquiryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(async ({ data: auth }) => { if (!auth.user) return setReady(true); const { data: admin } = await supabase.from("admin_users").select("role").eq("user_id", auth.user.id).eq("is_active", true).maybeSingle(); if (!admin || !["super_admin", "moderator"].includes(admin.role)) return setReady(true); const { data } = await supabase.from("inquiries").select("id,title,body,status,answer,created_at,profiles(nickname)").eq("id", id).maybeSingle(); setInquiry(data as unknown as Inquiry | null); setReady(true); }); }, [id, supabase]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inquiry) return;
    const response = String(new FormData(event.currentTarget).get("answer") ?? "").trim();
    if (response.length < 2) return;
    const { error } = await supabase.rpc("answer_inquiry", { inquiry_id: inquiry.id, response });
    if (error) return window.alert(error.message);
    router.push("/admin#inquiries");
  };

  if (!ready) return <main className={styles.center}>문의를 불러오고 있어요.</main>;
  if (!inquiry) return <main className={styles.center}><h1>문의를 찾을 수 없거나 권한이 없습니다.</h1><Link href="/admin#inquiries">문의 관리로 돌아가기</Link></main>;

  return <main className={styles.page}><header><Link href="/admin#inquiries">← 문의 목록</Link><div><small>ADMIN CONSOLE</small><h1>{inquiry.answer ? "문의 답변 수정" : "문의 답변"}</h1></div></header><form onSubmit={save}><section style={{ padding: 18, borderRadius: 14, background: "#f7f7f3" }}><small>{inquiry.profiles?.nickname ?? "회원"} · {new Date(inquiry.created_at).toLocaleString("ko-KR")}</small><h2 style={{ margin: "10px 0" }}>{inquiry.title}</h2><p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{inquiry.body}</p></section><label>답변<textarea name="answer" required minLength={2} maxLength={5000} defaultValue={inquiry.answer ?? ""} placeholder="사용자에게 전달할 답변을 입력해 주세요"/></label><div className={styles.actions}><Link href="/admin#inquiries">취소</Link><button type="submit">{inquiry.answer ? "답변 수정" : "답변 등록"}</button></div></form></main>;
}

"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./recruiter.module.css";

type Facility = { id: number; name: string; business_number: string; region: string; status: "pending" | "approved" | "rejected"; rejection_reason: string | null };
type Job = { id: number; title: string; description: string; job_role: string; employment_type: string; closes_at: string | null; apply_url: string | null; is_published: boolean };

export default function RecruiterPage() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async (currentUser: User) => {
    const [{ data: facilities }, { data: jobRows }] = await Promise.all([
      supabase.from("facilities").select("id,name,business_number,region,status,rejection_reason").eq("owner_id", currentUser.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("jobs").select("id,title,description,job_role,employment_type,closes_at,apply_url,is_published").eq("created_by", currentUser.id).order("created_at", { ascending: false }),
    ]);
    setFacility((facilities?.[0] as Facility | undefined) ?? null);
    setJobs((jobRows ?? []) as Job[]);
    setReady(true);
  }, [supabase]);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { setUser(data.user); if (data.user) void load(data.user); else setReady(true); }); }, [load, supabase]);

  const login = () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/recruiter` } });
  const apply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("document") as File;
    if (!file || file.size > 5242880 || !["image/jpeg", "image/png", "application/pdf"].includes(file.type)) return window.alert("5MB 이하 JPG, PNG, PDF 파일만 올릴 수 있어요.");
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("facility-verifications").upload(path, file);
    if (uploadError) return window.alert(uploadError.message);
    const { error } = await supabase.from("facilities").insert({ owner_id: user.id, name: form.get("name"), business_number: form.get("business_number"), region: form.get("region"), document_path: path });
    if (error) return window.alert(error.message);
    await load(user);
  };

  const createJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !facility) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const { error } = await supabase.from("jobs").insert({ created_by: user.id, facility_id: facility.id, facility_name: facility.name, region: facility.region, title: form.get("title"), description: form.get("description"), job_role: form.get("job_role"), employment_type: form.get("employment_type"), closes_at: form.get("closes_at") || null, apply_url: form.get("apply_url") || null, is_published: facility.status === "approved" });
    if (error) return window.alert(error.message);
    formElement.reset();
    await load(user);
  };

  const closeJob = async (id: number) => {
    await supabase.from("jobs").update({ is_published: false, updated_at: new Date().toISOString() }).eq("id", id);
    if (user) await load(user);
  };

  if (!ready) return <main className={styles.center}>운영자 정보를 확인하고 있어요.</main>;
  if (!user) return <main className={styles.center}><span>🏡</span><h1>원장선생님 채용센터</h1><p>로그인 후 어린이집 인증과 채용공고 등록을 시작할 수 있어요.</p><button onClick={login}>Google로 로그인</button><Link href="/">선생잎으로 돌아가기</Link></main>;

  return <main className={styles.page}><header><Link href="/">← 선생잎</Link><div><small>DIRECTOR CENTER</small><h1>원장선생님 채용센터</h1></div><button onClick={() => supabase.auth.signOut().then(() => location.reload())}>로그아웃</button></header>
    {!facility && <section><h2>1. 어린이집 운영자 인증</h2><p>사업자등록증 또는 고유번호증을 제출해 주세요. 승인 전에도 공고를 임시저장할 수 있어요.</p><form onSubmit={apply}><input name="name" required minLength={2} placeholder="어린이집명"/><input name="business_number" required minLength={8} placeholder="사업자·고유번호"/><input name="region" required minLength={2} placeholder="지역 (예: 서울 마포구)"/><input name="document" required type="file" accept="image/jpeg,image/png,application/pdf"/><button type="submit">인증 신청</button></form></section>}
    {facility && <><section className={styles.status}><div><h2>{facility.name}</h2><p>{facility.region} · {facility.business_number}</p></div><strong data-status={facility.status}>{facility.status === "approved" ? "인증 완료" : facility.status === "rejected" ? "인증 반려" : "심사 중"}</strong>{facility.rejection_reason && <p>반려 사유: {facility.rejection_reason}</p>}</section><section><h2>2. 채용공고 등록</h2><p>{facility.status === "approved" ? "등록 즉시 선생님들에게 공개됩니다." : "인증 승인 전까지 임시저장됩니다."}</p><form onSubmit={createJob}><input name="title" required minLength={2} placeholder="공고 제목"/><textarea name="description" required placeholder="담당 업무, 근무 조건, 복지 등을 입력해 주세요"/><div><select name="job_role" required defaultValue="childcare_teacher"><option value="childcare_teacher">보육교사</option><option value="special_education_teacher">특수교사</option><option value="kindergarten_teacher">유치원교사</option><option value="other">기타</option></select><select name="employment_type" required defaultValue="permanent"><option value="permanent">정규직</option><option value="contract">계약직</option><option value="part_time">시간제</option><option value="substitute">대체교사</option></select></div><input name="closes_at" type="date"/><input name="apply_url" type="url" placeholder="지원 링크 (선택)"/><button type="submit">{facility.status === "approved" ? "공고 등록" : "임시저장"}</button></form></section><section><h2>내 채용공고</h2><div className={styles.jobs}>{jobs.map((job) => <article key={job.id}><div><strong>{job.title}</strong><span>{job.is_published ? "공개 중" : "임시저장·마감"}</span></div><p>{job.description}</p><small>{job.employment_type} · 마감 {job.closes_at ?? "상시"}</small>{job.is_published && <button onClick={() => closeJob(job.id)}>공고 마감</button>}</article>)}</div></section></>}
  </main>;
}

"use client";

import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Attachment = { id: number; storage_path: string; file_name: string; mime_type: string; size_bytes: number; kind: "image" | "resource"; url?: string };
type PostDetail = { id: number; author_id: string; title: string; body: string; created_at: string; response_wish: string | null; view_count: number; categories: { name: string } | null; profiles: { nickname: string; career_band: string | null; teacher_started_year: number | null } | null; post_attachments: Attachment[] };
type Comment = { id: number; author_id: string; body: string; created_at: string; profiles: { nickname: string } | null };
type Job = { id: number; facility_name: string; region: string; title: string; description: string; job_role: string; employment_type: string; apply_url: string | null; closes_at: string | null };
type Review = { id: number; facility_name: string; region: string; facility_type: string; worked_from: string; worked_until: string | null; peer_relationship: number; workload: number; leave_policy: number; rating: number; body: string };

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="site-shell"><section className="app-frame"><header className="topbar"><Link className="icon-button" aria-label="홈으로" href="/">‹</Link><h1>{title}</h1><Link className="icon-button" aria-label="홈" href="/">⌂</Link></header>{children}<nav className="bottom-nav"><Link href="/">⌂<span>홈</span></Link><Link href="/?screen=list">☵<span>커뮤니티</span></Link><Link href="/?screen=materials">▤<span>자료실</span></Link><Link href="/?screen=career">▣<span>커리어</span></Link></nav></section></main>;
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title, text: `${title} | 선생잎`, url }); return; } catch (error) { if ((error as Error).name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { window.prompt("아래 링크를 복사해 주세요", url); }
  };
  return <button onClick={() => void share()} aria-label="콘텐츠 공유">{copied ? "✓ 링크 복사됨" : "↗ 공유하기"}</button>;
}

export function PostDetailPage({ id, material = false }: { id: number; material?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [liked, setLiked] = useState(false); const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(0); const [views, setViews] = useState(0);
  const [reply, setReply] = useState(""); const [ready, setReady] = useState(false);

  const load = useCallback(async (currentUser: User | null) => {
    const { data } = await supabase.from("posts").select("id,author_id,title,body,created_at,response_wish,view_count,categories(name),profiles!posts_author_id_fkey(nickname,career_band,teacher_started_year),post_attachments(id,storage_path,file_name,mime_type,size_bytes,kind)").eq("id", id).eq("is_hidden", false).maybeSingle();
    if (!data) { setReady(true); return; }
    const item = data as unknown as PostDetail;
    if (material !== (item.post_attachments.length > 0)) { router.replace(`${item.post_attachments.length ? "/materials" : "/posts"}/${id}`); return; }
    const attachments = await Promise.all(item.post_attachments.map(async (attachment) => ({ ...attachment, url: (await supabase.storage.from("post-attachments").createSignedUrl(attachment.storage_path, 3600)).data?.signedUrl })));
    setPost({ ...item, post_attachments: attachments }); setViews(item.view_count);
    const [commentResult, reactionCount, myReaction, myBookmark] = await Promise.all([
      supabase.from("comments").select("id,author_id,body,created_at,profiles!comments_author_id_fkey(nickname)").eq("post_id", id).eq("is_hidden", false).order("created_at"),
      supabase.from("reactions").select("id", { count: "exact", head: true }).eq("post_id", id).eq("kind", "comfort"),
      currentUser ? supabase.from("reactions").select("id").eq("post_id", id).eq("user_id", currentUser.id).eq("kind", "comfort").maybeSingle() : Promise.resolve({ data: null }),
      currentUser ? supabase.from("bookmarks").select("post_id").eq("post_id", id).eq("user_id", currentUser.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setComments((commentResult.data ?? []) as unknown as Comment[]); setLikes(reactionCount.count ?? 0); setLiked(Boolean(myReaction.data)); setSaved(Boolean(myBookmark.data)); setReady(true);
    let anonymousId: string | null = null;
    if (!currentUser) { anonymousId = localStorage.getItem("anonymous-viewer-id"); if (!anonymousId) { anonymousId = crypto.randomUUID(); localStorage.setItem("anonymous-viewer-id", anonymousId); } }
    const { data: count } = await supabase.rpc("record_post_view", { target_post_id: id, anonymous_id: anonymousId }); if (count !== null) setViews(Number(count));
  }, [id, material, router, supabase]);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { setUser(data.user); void load(data.user); }); }, [load, supabase]);
  const requireUser = () => { if (user) return true; router.push("/?login=1"); return false; };
  const toggleLike = async () => { if (!requireUser() || !user) return; const error = liked ? (await supabase.from("reactions").delete().eq("post_id", id).eq("user_id", user.id).eq("kind", "comfort")).error : (await supabase.from("reactions").insert({ post_id: id, user_id: user.id, kind: "comfort" })).error; if (!error) { setLiked(!liked); setLikes((count) => count + (liked ? -1 : 1)); } };
  const toggleSaved = async () => { if (!requireUser() || !user) return; const error = saved ? (await supabase.from("bookmarks").delete().eq("post_id", id).eq("user_id", user.id)).error : (await supabase.from("bookmarks").insert({ post_id: id, user_id: user.id })).error; if (!error) setSaved(!saved); };
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!requireUser() || !user || !reply.trim()) return; const { error } = await supabase.from("comments").insert({ post_id: id, author_id: user.id, body: reply.trim() }); if (!error) { setReply(""); await load(user); } };
  const download = (attachment: Attachment) => { void supabase.rpc("record_material_download", { target_id: attachment.id }); };

  if (!ready) return <Shell title={material ? "수업자료" : "선생님 이야기"}><div className="empty"><span>🌱</span><strong>콘텐츠를 불러오고 있어요</strong></div></Shell>;
  if (!post) return <Shell title={material ? "수업자료" : "선생님 이야기"}><div className="empty"><span>🪴</span><strong>콘텐츠를 볼 수 없어요</strong><p>삭제·숨김 처리되었거나 접근 권한이 없는 콘텐츠예요.</p><Link className="primary" href="/">홈으로</Link></div></Shell>;
  const careers: Record<string, string> = { under_1: "1년 미만", "1_3": "1~3년 차", "4_6": "4~6년 차", "7_plus": "7년 차 이상" };
  const career = post.profiles?.teacher_started_year ? `${new Date().getFullYear() - post.profiles.teacher_started_year + 1}년 차` : careers[post.profiles?.career_band ?? ""] ?? "경력 미입력";
  return <Shell title={material ? "수업자료" : "선생님 이야기"}><article className="detail"><span className="tag">🌱 {post.categories?.name ?? "선생님 이야기"}</span><div className="author"><span className="avatar">🌱</span><span><strong>{post.profiles?.nickname ?? "익명의 새싹쌤"}</strong><small>{career} · {new Date(post.created_at).toLocaleDateString("ko-KR")} · 조회 {views}</small></span></div><h2>{post.title}</h2><p className="body-copy">{post.body}</p>{post.post_attachments.length > 0 && <section className="post-attachments"><h3>첨부된 수업자료</h3><div className="attachment-images">{post.post_attachments.filter((item) => item.kind === "image" && item.url).map((item) => <a href={item.url} target="_blank" rel="noopener noreferrer" key={item.id}><Image src={item.url!} alt={item.file_name} width={480} height={360} unoptimized/></a>)}</div>{post.post_attachments.filter((item) => item.kind === "resource" && item.url).map((item) => <a className="resource-file" href={item.url} download={item.file_name} onClick={() => download(item)} key={item.id}><span>📎</span><span><strong>{item.file_name}</strong><small>{(item.size_bytes / 1_048_576).toFixed(1)}MB · 다운로드</small></span></a>)}</section>}<div className="reaction-row"><button className={liked ? "active" : ""} onClick={() => void toggleLike()}>🫶 위로해요 {likes}</button><button className={saved ? "active" : ""} onClick={() => void toggleSaved()}>▱ {saved ? "저장됨" : "저장"}</button><ShareButton title={post.title}/></div><section className="comments"><h3>선생님들의 답변 {comments.length}</h3>{comments.map((comment) => <div className="comment" key={comment.id}><strong>🌱 {comment.profiles?.nickname ?? "익명의 새싹쌤"}</strong><p>{comment.body}</p><small>{new Date(comment.created_at).toLocaleDateString("ko-KR")}</small></div>)}</section><form className="composer" onSubmit={submit}><input value={reply} maxLength={1000} onChange={(event) => setReply(event.target.value)} placeholder="따뜻한 답변을 남겨주세요"/><button aria-label="답변 등록">➤</button></form></article></Shell>;
}

export function JobDetailPage({ id }: { id: number }) {
  const supabase = useMemo(() => createClient(), []); const router = useRouter(); const [job, setJob] = useState<Job | null>(null); const [ready, setReady] = useState(false); const [user, setUser] = useState<User | null>(null); const [saved, setSaved] = useState(false);
  useEffect(() => { supabase.auth.getUser().then(async ({ data: auth }) => { setUser(auth.user); const { data } = await supabase.from("jobs").select("id,facility_name,region,title,description,job_role,employment_type,apply_url,closes_at").eq("id", id).eq("is_published", true).maybeSingle(); setJob(data as Job | null); if (auth.user) setSaved(Boolean((await supabase.from("saved_jobs").select("job_id").eq("job_id", id).eq("user_id", auth.user.id).maybeSingle()).data)); setReady(true); }); }, [id, supabase]);
  const toggle = async () => { if (!user) return void router.push("/?login=1"); const error = saved ? (await supabase.from("saved_jobs").delete().eq("job_id", id).eq("user_id", user.id)).error : (await supabase.from("saved_jobs").insert({ job_id: id, user_id: user.id })).error; if (!error) setSaved(!saved); };
  if (!ready || !job) return <Shell title="채용정보"><div className="empty"><span>🏡</span><strong>{ready ? "공고를 볼 수 없어요" : "공고를 불러오고 있어요"}</strong>{ready && <p>마감·삭제되었거나 공개되지 않은 공고예요.</p>}</div></Shell>;
  const role: Record<string,string> = { childcare_teacher:"보육교사", special_education_teacher:"특수교사", kindergarten_teacher:"유치원교사", other:"기타" }; const employment: Record<string,string> = { permanent:"정규직", contract:"계약직", part_time:"시간제", substitute:"대체교사" }; const expired = Boolean(job.closes_at && job.closes_at < new Date().toISOString().slice(0,10));
  return <Shell title="채용정보"><article className="job-detail"><div className="job-detail-title"><span className="avatar">🏡</span><div><small>{job.region}</small><h2>{job.facility_name}</h2></div><button onClick={() => void toggle()}>{saved ? "▣" : "▱"}</button></div><div className="reaction-row"><span className={`job-status ${expired ? "closed" : ""}`}>{expired ? "마감" : "채용 중"}</span><ShareButton title={job.title}/></div><h1>{job.title}</h1><div className="job-facts"><span><small>직군</small>{role[job.job_role] ?? job.job_role}</span><span><small>고용형태</small>{employment[job.employment_type] ?? job.employment_type}</span><span><small>마감일</small>{job.closes_at ?? "상시채용"}</span></div><section><h3>공고 내용</h3><p>{job.description}</p></section>{job.apply_url && !expired ? <a className="job-apply" href={job.apply_url} target="_blank" rel="noopener noreferrer">지원하러 가기 ↗</a> : <div className="privacy">{expired ? "마감된 공고예요" : "지원 링크가 등록되지 않았어요"}</div>}</article></Shell>;
}

export function ReviewDetailPage({ id }: { id: number }) {
  const supabase = useMemo(() => createClient(), []); const [review, setReview] = useState<Review | null>(null); const [ready, setReady] = useState(false);
  useEffect(() => { supabase.from("workplace_reviews").select("id,facility_name,region,facility_type,worked_from,worked_until,peer_relationship,workload,leave_policy,rating,body").eq("id", id).eq("status", "approved").maybeSingle().then(({ data }) => { setReview(data as Review | null); setReady(true); }); }, [id, supabase]);
  if (!ready || !review) return <Shell title="어린이집 후기"><div className="empty"><span>🌱</span><strong>{ready ? "후기를 볼 수 없어요" : "후기를 불러오고 있어요"}</strong>{ready && <p>심사 중이거나 삭제된 후기예요.</p>}</div></Shell>;
  return <Shell title="어린이집 후기"><article className="review review-detail"><h3>{review.region} · {review.facility_name} <i>✓ 근무 인증</i><span>★ {review.rating}</span></h3><small>{review.facility_type} · {review.worked_from}~{review.worked_until ?? "현재"}</small><div><b>동료 관계<strong>{review.peer_relationship}/5</strong></b><b>업무 강도<strong>{review.workload}/5</strong></b><b>휴게·연차<strong>{review.leave_policy}/5</strong></b></div><p>{review.body}</p><div className="reaction-row"><ShareButton title={`${review.facility_name} 근무 후기`}/></div></article></Shell>;
}

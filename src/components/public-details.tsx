"use client";

import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MaterialIcon } from "@/components/material-icon";

type Attachment = {
  id: number;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: "image" | "resource";
  url?: string;
};
type PostDetail = {
  id: number;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  response_wish: string | null;
  view_count: number;
  categories: { name: string } | null;
  profiles: {
    nickname: string;
    career_band: string | null;
    teacher_started_year: number | null;
  } | null;
  post_attachments: Attachment[];
};
type Comment = {
  id: number;
  parent_id: number | null;
  author_id: string;
  body: string;
  created_at: string;
  profiles: { nickname: string } | null;
};
type Job = {
  id: number;
  facility_name: string;
  region: string;
  title: string;
  description: string;
  job_role: string;
  employment_type: string;
  apply_url: string | null;
  closes_at: string | null;
};
type Review = {
  id: number;
  facility_name: string;
  region: string;
  facility_type: string;
  worked_from: string;
  worked_until: string | null;
  peer_relationship: number;
  workload: number;
  leave_policy: number;
  rating: number;
  body: string;
};
type ReviewReply = {
  id: number;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <main className="site-shell detail-shell">
      <section className="app-frame">
        <header className="topbar">
          <button className="icon-button" aria-label="뒤로 가기" onClick={() => router.back()}>
            <MaterialIcon name="arrow_back" />
          </button>
          <h1>{title}</h1>
          <Link className="icon-button" aria-label="홈" href="/">
            <MaterialIcon name="home" />
          </Link>
        </header>
        {children}
        <nav className="bottom-nav">
          <Link href="/">
            <MaterialIcon name="home" />
            <span>홈</span>
          </Link>
          <Link href="/?screen=list">
            <MaterialIcon name="forum" />
            <span>커뮤니티</span>
          </Link>
          <Link href="/?screen=materials">
            <MaterialIcon name="folder_open" />
            <span>자료실</span>
          </Link>
          <Link href="/?screen=career">
            <MaterialIcon name="work" />
            <span>커리어</span>
          </Link>
          <Link href="/?screen=profile">
            <MaterialIcon name="person" />
            <span>내 정보</span>
          </Link>
        </nav>
      </section>
    </main>
  );
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title} | 선생잎`, url });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("아래 링크를 복사해 주세요", url);
    }
  };
  return (
    <button onClick={() => void share()} aria-label="콘텐츠 공유">
      <MaterialIcon name={copied ? "check" : "share"}/>{copied ? "링크 복사됨" : "공유하기"}
    </button>
  );
}

export function PostDetailPage({ id, material = false }: { id: number; material?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(0);
  const [views, setViews] = useState(0);
  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [childReply, setChildReply] = useState("");
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(false);

  const load = useCallback(
    async (currentUser: User | null) => {
      const { data } = await supabase.from("posts").select("id,author_id,title,body,created_at,edited_at,response_wish,view_count,categories(name),profiles!posts_author_id_fkey(nickname,career_band,teacher_started_year),post_attachments(id,storage_path,file_name,mime_type,size_bytes,kind)").eq("id", id).eq("is_hidden", false).maybeSingle();
      if (!data) {
        setReady(true);
        return;
      }
      const item = data as unknown as PostDetail;
      if (material !== item.post_attachments.length > 0) {
        router.replace(`${item.post_attachments.length ? "/materials" : "/posts"}/${id}`);
        return;
      }
      const attachments = await Promise.all(
        item.post_attachments.map(async (attachment) => ({
          ...attachment,
          url: (await supabase.storage.from("post-attachments").createSignedUrl(attachment.storage_path, 3600)).data?.signedUrl,
        })),
      );
      setPost({ ...item, post_attachments: attachments });
      setViews(item.view_count);
      const [commentResult, reactionCount, myReaction, myBookmark] = await Promise.all([supabase.from("comments").select("id,parent_id,author_id,body,created_at,profiles!comments_author_id_fkey(nickname)").eq("post_id", id).eq("is_hidden", false).order("created_at"), supabase.from("reactions").select("id", { count: "exact", head: true }).eq("post_id", id).eq("kind", "comfort"), currentUser ? supabase.from("reactions").select("id").eq("post_id", id).eq("user_id", currentUser.id).eq("kind", "comfort").maybeSingle() : Promise.resolve({ data: null }), currentUser ? supabase.from("bookmarks").select("post_id").eq("post_id", id).eq("user_id", currentUser.id).maybeSingle() : Promise.resolve({ data: null })]);
      setComments((commentResult.data ?? []) as unknown as Comment[]);
      setLikes(reactionCount.count ?? 0);
      setLiked(Boolean(myReaction.data));
      setSaved(Boolean(myBookmark.data));
      setReady(true);
      let anonymousId: string | null = null;
      if (!currentUser) {
        anonymousId = localStorage.getItem("anonymous-viewer-id");
        if (!anonymousId) {
          anonymousId = crypto.randomUUID();
          localStorage.setItem("anonymous-viewer-id", anonymousId);
        }
      }
      const { data: count } = await supabase.rpc("record_post_view", {
        target_post_id: id,
        anonymous_id: anonymousId,
      });
      if (count !== null) setViews(Number(count));
    },
    [id, material, router, supabase],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      void load(data.user);
    });
  }, [load, supabase]);
  const requireUser = () => {
    if (user) return true;
    window.location.href = new URL("/?login=1", window.location.origin).href;
    return false;
  };
  const toggleLike = async () => {
    if (!requireUser() || !user) return;
    const error = liked ? (await supabase.from("reactions").delete().eq("post_id", id).eq("user_id", user.id).eq("kind", "comfort")).error : (await supabase.from("reactions").insert({ post_id: id, user_id: user.id, kind: "comfort" })).error;
    if (!error) {
      setLiked(!liked);
      setLikes((count) => count + (liked ? -1 : 1));
    }
  };
  const toggleSaved = async () => {
    if (!requireUser() || !user) return;
    const error = saved ? (await supabase.from("bookmarks").delete().eq("post_id", id).eq("user_id", user.id)).error : (await supabase.from("bookmarks").insert({ post_id: id, user_id: user.id })).error;
    if (!error) setSaved(!saved);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!requireUser() || !user || !reply.trim()) return;
    const { error } = await supabase.from("comments").insert({ post_id: id, author_id: user.id, body: reply.trim() });
    if (!error) {
      setReply("");
      await load(user);
    }
  };
  const submitChildReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!requireUser() || !user || !replyTo || !childReply.trim()) return;
    const { error } = await supabase.from("comments").insert({ post_id: id, parent_id: replyTo.id, author_id: user.id, body: childReply.trim() });
    if (!error) { setReplyTo(null); setChildReply(""); await load(user); }
  };
  const deleteComment = async (comment: Comment) => {
    if (!user || comment.author_id !== user.id || !window.confirm("작성한 댓글을 삭제할까요?")) return;
    const { error } = await supabase.from("comments").delete().eq("id", comment.id).eq("author_id", user.id);
    if (error) return window.alert("댓글을 삭제하지 못했어요.");
    await load(user);
  };
  const download = (attachment: Attachment) => {
    void supabase.rpc("record_material_download", { target_id: attachment.id });
  };
  const startEdit = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditBody(post.body);
    setEditing(true);
  };
  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !post || editTitle.trim().length < 2 || editBody.trim().length < 10) return;
    setSaving(true);
    const editedAt = new Date().toISOString();
    const { error } = await supabase
      .from("posts")
      .update({
        title: editTitle.trim(),
        body: editBody.trim(),
        edited_at: editedAt,
      })
      .eq("id", post.id)
      .eq("author_id", user.id)
      .is("deleted_at", null);
    setSaving(false);
    if (error) return window.alert("게시글을 수정하지 못했어요.");
    setPost({
      ...post,
      title: editTitle.trim(),
      body: editBody.trim(),
      edited_at: editedAt,
    });
    setEditing(false);
  };
  const deletePost = async () => {
    if (!user || !post || !window.confirm("삭제한 글은 다시 복구하거나 게시할 수 없습니다. 정말 삭제하시겠어요?")) return;
    const { error } = await supabase.from("posts").update({ is_hidden: true, deleted_at: new Date().toISOString() }).eq("id", post.id).eq("author_id", user.id).is("deleted_at", null);
    if (error) return window.alert("게시글을 삭제하지 못했어요.");
    window.location.href = new URL("/?screen=list", window.location.origin).href;
  };

  if (!ready)
    return (
      <Shell title={material ? "수업자료" : "선생님 이야기"}>
        <div className="empty">
          <span>🌱</span>
          <strong>콘텐츠를 불러오고 있어요</strong>
        </div>
      </Shell>
    );
  if (!post)
    return (
      <Shell title={material ? "수업자료" : "선생님 이야기"}>
        <div className="empty">
          <span>🪴</span>
          <strong>콘텐츠를 볼 수 없어요</strong>
          <p>삭제·숨김 처리되었거나 접근 권한이 없는 콘텐츠예요.</p>
          <Link className="primary" href="/">
            홈으로
          </Link>
        </div>
      </Shell>
    );
  const careers: Record<string, string> = {
    under_1: "1년 미만",
    "1_3": "1~3년 차",
    "4_6": "4~6년 차",
    "7_plus": "7년 차 이상",
  };
  const career = post.profiles?.teacher_started_year ? `${new Date().getFullYear() - post.profiles.teacher_started_year + 1}년 차` : (careers[post.profiles?.career_band ?? ""] ?? "경력 미입력");
  return (
    <Shell title={material ? "수업자료" : "선생님 이야기"}>
      <article className="detail">
        <span className="tag">🌱 {post.categories?.name ?? "선생님 이야기"}</span>
        <div className="author">
          <span className="avatar">🌱</span>
          <span>
            <strong>{post.profiles?.nickname ?? "익명의 새싹쌤"}</strong>
            <small>
              {career} · {new Date(post.created_at).toLocaleDateString("ko-KR")} · 조회 {views}
              {post.edited_at ? " · 수정됨" : ""}
            </small>
          </span>
        </div>
        <h2>{post.title}</h2>
        <p className="body-copy">{post.body}</p>
        {user?.id === post.author_id && (
          <div className="owner-actions">
            <button onClick={startEdit}>수정</button>
            <button className="danger-text" onClick={() => void deletePost()}>
              삭제
            </button>
          </div>
        )}
        {editing && (
          <div className="modal-backdrop">
            <form className="report-modal" onSubmit={saveEdit}>
              <h3>게시글 수정</h3>
              <label>
                제목
                <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} minLength={2} maxLength={60} required />
              </label>
              <label>
                내용
                <textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} minLength={10} maxLength={2000} required />
              </label>
              <div>
                <button type="button" onClick={() => setEditing(false)}>
                  취소
                </button>
                <button className="primary" disabled={saving}>
                  {saving ? "저장 중…" : "수정 저장"}
                </button>
              </div>
            </form>
          </div>
        )}
        {post.post_attachments.length > 0 && (
          <section className="post-attachments">
            <h3>첨부된 수업자료</h3>
            <div className="attachment-images">
              {post.post_attachments
                .filter((item) => item.kind === "image" && item.url)
                .map((item) => (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" key={item.id}>
                    <Image src={item.url!} alt={item.file_name} width={480} height={360} unoptimized />
                  </a>
                ))}
            </div>
            {post.post_attachments
              .filter((item) => item.kind === "resource" && item.url)
              .map((item) => (
                <a className="resource-file" href={item.url} download={item.file_name} onClick={() => download(item)} key={item.id}>
                  <span>📎</span>
                  <span>
                    <strong>{item.file_name}</strong>
                    <small>{(item.size_bytes / 1_048_576).toFixed(1)}MB · 다운로드</small>
                  </span>
                </a>
              ))}
          </section>
        )}
        <div className="reaction-row">
          <button className={liked ? "active" : ""} onClick={() => void toggleLike()}>
            🫶 위로해요 {likes}
          </button>
          <button className={saved ? "active" : ""} onClick={() => void toggleSaved()}>
            <MaterialIcon name={saved ? "bookmark" : "bookmark_border"}/>{saved ? "저장됨" : "저장"}
          </button>
          <ShareButton title={post.title} />
        </div>
        <section className="comments">
          <h3>선생님들의 답변 {comments.length}</h3>
          {comments.filter((comment) => !comment.parent_id).map((comment) => (
            <div className="comment-thread" key={comment.id}>
              <div className="comment"><strong>🌱 {comment.profiles?.nickname ?? "익명의 새싹쌤"}</strong><p>{comment.body}</p><small>{new Date(comment.created_at).toLocaleDateString("ko-KR")}</small><div className="reaction-row">{comment.author_id === user?.id ? <button className="danger-text" onClick={() => void deleteComment(comment)}>삭제</button> : <button onClick={() => { if (!user) return setLoginPrompt(true); setReplyTo(comment); setChildReply(""); }}>답글</button>}</div></div>
              {comments.filter((child) => child.parent_id === comment.id).map((child) => <div className="comment child-comment" key={child.id}><strong>↳ 🌱 {child.profiles?.nickname ?? "익명의 새싹쌤"}</strong><p>{child.body}</p><small>{new Date(child.created_at).toLocaleDateString("ko-KR")}</small>{child.author_id === user?.id && <div className="reaction-row"><button className="danger-text" onClick={() => void deleteComment(child)}>삭제</button></div>}</div>)}
              {replyTo?.id === comment.id && <form className="composer child-composer" onSubmit={submitChildReply}><input autoFocus value={childReply} maxLength={1000} onChange={(event) => setChildReply(event.target.value)} placeholder="대댓글을 남겨주세요"/><button type="button" onClick={() => setReplyTo(null)}>취소</button><button>작성</button></form>}
            </div>
          ))}
        </section>
        <form className="composer" onSubmit={submit}>
          <input
            value={reply}
            readOnly={!user}
            maxLength={1000}
            onFocus={() => {
              if (!user) setLoginPrompt(true);
            }}
            onChange={(event) => setReply(event.target.value)}
            placeholder={user ? "따뜻한 답변을 남겨주세요" : "로그인 후 답변을 남길 수 있어요"}
          />
          <button
            type={user ? "submit" : "button"}
            aria-label="답변 등록"
            onClick={() => {
              if (!user) setLoginPrompt(true);
            }}
          >
            작성
          </button>
        </form>
        {loginPrompt && (
          <div className="modal-backdrop" onMouseDown={() => setLoginPrompt(false)}>
            <div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="login-prompt-title" onMouseDown={(event) => event.stopPropagation()}>
              <h2 id="login-prompt-title">🌱 로그인이 필요해요</h2>
              <p>답변을 남기려면 먼저 로그인해 주세요.</p>
              <div>
                <button type="button" onClick={() => setLoginPrompt(false)}>
                  다음에
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    window.location.href = new URL("/?login=1", window.location.origin).href;
                  }}
                >
                  로그인하기
                </button>
              </div>
            </div>
          </div>
        )}
      </article>
    </Shell>
  );
}

export function JobDetailPage({ id }: { id: number }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: auth }) => {
      setUser(auth.user);
      const { data } = await supabase.from("jobs").select("id,facility_name,region,title,description,job_role,employment_type,apply_url,closes_at").eq("id", id).eq("is_published", true).maybeSingle();
      setJob(data as Job | null);
      if (auth.user) setSaved(Boolean((await supabase.from("saved_jobs").select("job_id").eq("job_id", id).eq("user_id", auth.user.id).maybeSingle()).data));
      setReady(true);
    });
  }, [id, supabase]);
  const toggle = async () => {
    if (!user) return void router.push("/?login=1");
    const error = saved ? (await supabase.from("saved_jobs").delete().eq("job_id", id).eq("user_id", user.id)).error : (await supabase.from("saved_jobs").insert({ job_id: id, user_id: user.id })).error;
    if (!error) setSaved(!saved);
  };
  if (!ready || !job)
    return (
      <Shell title="채용정보">
        <div className="empty">
          <span>🏡</span>
          <strong>{ready ? "공고를 볼 수 없어요" : "공고를 불러오고 있어요"}</strong>
          {ready && <p>마감·삭제되었거나 공개되지 않은 공고예요.</p>}
        </div>
      </Shell>
    );
  const role: Record<string, string> = {
    childcare_teacher: "보육교사",
    special_education_teacher: "특수교사",
    kindergarten_teacher: "유치원교사",
    other: "기타",
  };
  const employment: Record<string, string> = {
    permanent: "정규직",
    contract: "계약직",
    part_time: "시간제",
    substitute: "대체교사",
  };
  const expired = Boolean(job.closes_at && job.closes_at < new Date().toISOString().slice(0, 10));
  return (
    <Shell title="채용정보">
      <article className="job-detail">
        <div className="job-detail-title">
          <span className="avatar">🏡</span>
          <div>
            <small>{job.region}</small>
            <h2>{job.facility_name}</h2>
          </div>
          <button onClick={() => void toggle()}>{saved ? "▣" : "▱"}</button>
        </div>
        <div className="reaction-row">
          <span className={`job-status ${expired ? "closed" : ""}`}>{expired ? "마감" : "채용 중"}</span>
          <ShareButton title={job.title} />
        </div>
        <h1>{job.title}</h1>
        <div className="job-facts">
          <span>
            <small>직군</small>
            {role[job.job_role] ?? job.job_role}
          </span>
          <span>
            <small>고용형태</small>
            {employment[job.employment_type] ?? job.employment_type}
          </span>
          <span>
            <small>마감일</small>
            {job.closes_at ?? "상시채용"}
          </span>
        </div>
        <section>
          <h3>공고 내용</h3>
          <p>{job.description}</p>
        </section>
        {job.apply_url && !expired ? (
          <a className="job-apply" href={job.apply_url} target="_blank" rel="noopener noreferrer">
            지원하러 가기 ↗
          </a>
        ) : (
          <div className="privacy">{expired ? "마감된 공고예요" : "지원 링크가 등록되지 않았어요"}</div>
        )}
      </article>
    </Shell>
  );
}

export function ReviewDetailPage({ id }: { id: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [review, setReview] = useState<Review | null>(null);
  const [reply, setReply] = useState<ReviewReply | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<"login" | "verification" | "allowed">("login");
  const [canReply, setCanReply] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    setUser(auth.user);
    if (!auth.user) {
      setAccess("login");
      setReady(true);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("is_verified,account_type").eq("id", auth.user.id).single();
    if (!profile?.is_verified && profile?.account_type !== "director") {
      setAccess("verification");
      setReady(true);
      return;
    }
    setAccess("allowed");
    const [{ data: reviewData }, { data: replyData }] = await Promise.all([supabase.from("workplace_reviews").select("id,facility_name,region,facility_type,worked_from,worked_until,peer_relationship,workload,leave_policy,rating,body").eq("id", id).eq("status", "approved").maybeSingle(), supabase.from("workplace_review_replies").select("id,author_id,body,created_at,updated_at").eq("review_id", id).maybeSingle()]);
    const item = reviewData as Review | null;
    setReview(item);
    setReply(replyData as ReviewReply | null);
    setReplyBody(replyData?.body ?? "");
    if (item && profile.account_type === "director") {
      const { data: facility } = await supabase.from("facilities").select("id").eq("owner_id", auth.user.id).eq("status", "approved").ilike("name", item.facility_name.trim()).maybeSingle();
      setCanReply(Boolean(facility));
    }
    setReady(true);
  }, [id, supabase]);
  useEffect(() => {
    void load();
  }, [load]);
  const saveReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !canReply || replyBody.trim().length < 10) return;
    setSaving(true);
    const error = reply
      ? (
          await supabase
            .from("workplace_review_replies")
            .update({
              body: replyBody.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", reply.id)
            .eq("author_id", user.id)
        ).error
      : (
          await supabase.from("workplace_review_replies").insert({
            review_id: id,
            author_id: user.id,
            body: replyBody.trim(),
          })
        ).error;
    setSaving(false);
    if (error) return window.alert(error.message);
    await load();
  };
  const deleteReply = async () => {
    if (!user || !reply || reply.author_id !== user.id || !window.confirm("원장님 답글을 삭제할까요?")) return;
    const { error } = await supabase.from("workplace_review_replies").delete().eq("id", reply.id).eq("author_id", user.id);
    if (error) return window.alert(error.message);
    setReply(null);
    setReplyBody("");
  };
  if (!ready)
    return (
      <Shell title="어린이집 후기">
        <div className="empty">
          <span>🌱</span>
          <strong>후기를 불러오고 있어요</strong>
        </div>
      </Shell>
    );
  if (access !== "allowed")
    return (
      <Shell title="어린이집 후기">
        <div className="locked-review-detail">
          <div className="review-blur" aria-hidden="true">
            <section className="review-detail-hero">
              <div>
                <span>서울 · 국공립</span>
                <h1>인증 선생님 전용 후기</h1>
              </div>
              <div className="review-overall">
                <small>종합 평점</small>
                <strong>5.0</strong>
                <span>★★★★★</span>
              </div>
            </section>
            <section className="review-story">
              <h2>직접 근무하며 느낀 점이에요</h2>
              <p>근무 환경과 실제 경험에 대한 솔직한 후기입니다.</p>
            </section>
          </div>
          <div className="review-lock-message">
            <span>🪪</span>
            <strong>{access === "login" ? "로그인이 필요해요" : "선생님 인증이 필요해요"}</strong>
            <p>인증된 선생님끼리만 안전하게 어린이집 후기를 확인할 수 있어요.</p>
            <Link className="primary" href={access === "login" ? "/?login=1" : "/?screen=verification"}>
              {access === "login" ? "로그인하기" : "선생님 인증하기"}
            </Link>
          </div>
        </div>
      </Shell>
    );
  if (!review)
    return (
      <Shell title="어린이집 후기">
        <div className="empty">
          <span>🌱</span>
          <strong>후기를 볼 수 없어요</strong>
          <p>심사 중이거나 삭제된 후기예요.</p>
        </div>
      </Shell>
    );
  return (
    <Shell title="어린이집 후기">
      <article className="review-detail">
        <section className="review-detail-hero">
          <div>
            <span className="review-location">
              {review.region} · {review.facility_type}
            </span>
            <h1>{review.facility_name}</h1>
            <div className="review-meta">
              <span>✓ 근무 인증</span>
              <span>
                {review.worked_from.slice(0, 7)} ~ {review.worked_until?.slice(0, 7) ?? "재직 중"}
              </span>
            </div>
          </div>
          <div className="review-overall">
            <small>종합 평점</small>
            <strong>{review.rating.toFixed(1)}</strong>
            <span>
              {"★".repeat(review.rating)}
              {"☆".repeat(5 - review.rating)}
            </span>
          </div>
        </section>
        <section className="review-score-section">
          <h2>근무 환경은 어땠나요?</h2>
          <div className="review-scores">
            <b>
              동료 관계
              <strong>
                {review.peer_relationship}
                <small>/ 5</small>
              </strong>
            </b>
            <b>
              업무 환경
              <strong>
                {review.workload}
                <small>/ 5</small>
              </strong>
            </b>
            <b>
              휴게·연차
              <strong>
                {review.leave_policy}
                <small>/ 5</small>
              </strong>
            </b>
          </div>
        </section>
        <section className="review-story">
          <span>선생님의 솔직한 이야기</span>
          <h2>직접 근무하며 느낀 점이에요</h2>
          <p>{review.body}</p>
        </section>
        <div className="review-anonymous">
          🌿{" "}
          <span>
            <strong>익명으로 작성된 인증 후기예요</strong>
            <small>작성자의 이름과 개인정보는 공개되지 않습니다.</small>
          </span>
        </div>
        {reply && (
          <section className="director-reply">
            <header>
              <span>🏡</span>
              <div>
                <strong>원장 선생님의 답변</strong>
                <small>
                  운영자 인증 완료 · {new Date(reply.updated_at).toLocaleDateString("ko-KR")}
                  {reply.updated_at !== reply.created_at ? " · 수정됨" : ""}
                </small>
              </div>
            </header>
            <p>{reply.body}</p>
            {reply.author_id === user?.id && <button onClick={() => void deleteReply()}>답글 삭제</button>}
          </section>
        )}
        {canReply && (!reply || reply.author_id === user?.id) && (
          <form className="director-reply-form" onSubmit={saveReply}>
            <strong>{reply ? "원장님 답글 수정" : "원장님으로 답글 남기기"}</strong>
            <p>운영자 인증 배지와 함께 공식 답변으로 표시됩니다.</p>
            <textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} minLength={10} maxLength={1000} placeholder="후기에 대한 어린이집의 답변을 정중하게 작성해 주세요." required />
            <small>{replyBody.length} / 1,000</small>
            <button className="primary" disabled={saving || replyBody.trim().length < 10}>
              {saving ? "저장 중…" : reply ? "답글 수정" : "답글 등록"}
            </button>
          </form>
        )}
        <div className="reaction-row">
          <ShareButton title={`${review.facility_name} 근무 후기`} />
        </div>
      </article>
    </Shell>
  );
}

export function FacilityReviewPage({ seedId }: { seedId: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [access, setAccess] = useState<"login" | "verification" | "allowed">("login");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setAccess("login");
        setReady(true);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("is_verified,account_type").eq("id", auth.user.id).single();
      if (!profile?.is_verified && profile?.account_type !== "director") {
        setAccess("verification");
        setReady(true);
        return;
      }
      setAccess("allowed");
      const { data: seed } = await supabase.from("workplace_reviews").select("facility_name,region").eq("id", seedId).eq("status", "approved").maybeSingle();
      if (seed) {
        const { data } = await supabase.from("workplace_reviews").select("id,facility_name,region,facility_type,worked_from,worked_until,peer_relationship,workload,leave_policy,rating,body").eq("status", "approved").eq("facility_name", seed.facility_name).eq("region", seed.region).order("created_at", { ascending: false });
        setReviews((data ?? []) as Review[]);
      }
      setReady(true);
    })();
  }, [seedId, supabase]);
  if (!ready)
    return (
      <Shell title="어린이집 후기">
        <div className="empty">
          <span>🌱</span>
          <strong>후기를 불러오고 있어요</strong>
        </div>
      </Shell>
    );
  if (access !== "allowed")
    return (
      <Shell title="어린이집 후기">
        <div className="locked-review-detail">
          <div className="review-blur" aria-hidden="true">
            <section className="review-detail-hero">
              <div>
                <span>서울 · 어린이집</span>
                <h1>인증 선생님 전용 후기</h1>
              </div>
              <div className="review-overall">
                <small>평균 평점</small>
                <strong>5.0</strong>
                <span>★★★★★</span>
              </div>
            </section>
            <section className="review-story">
              <h2>선생님들의 근무 후기</h2>
              <p>실제 근무 경험을 바탕으로 작성된 후기입니다.</p>
            </section>
          </div>
          <div className="review-lock-message">
            <span>🪪</span>
            <strong>{access === "login" ? "로그인이 필요해요" : "선생님 인증이 필요해요"}</strong>
            <p>인증된 선생님끼리만 안전하게 어린이집 후기를 확인할 수 있어요.</p>
            <Link className="primary" href={access === "login" ? "/?login=1" : "/?screen=verification"}>
              {access === "login" ? "로그인하기" : "선생님 인증하기"}
            </Link>
          </div>
        </div>
      </Shell>
    );
  if (!reviews.length)
    return (
      <Shell title="어린이집 후기">
        <div className="empty">
          <span>🌱</span>
          <strong>후기를 볼 수 없어요</strong>
          <p>심사 중이거나 삭제된 후기예요.</p>
        </div>
      </Shell>
    );
  const average = (field: "rating" | "peer_relationship" | "workload" | "leave_policy") => reviews.reduce((sum, review) => sum + review[field], 0) / reviews.length;
  const facility = reviews[0];
  return (
    <Shell title="어린이집 후기">
      <article className="facility-review-detail">
        <section className="review-detail-hero">
          <div>
            <span className="review-location">
              {facility.region} · {facility.facility_type}
            </span>
            <h1>{facility.facility_name}</h1>
            <div className="review-meta">
              <span>✓ 인증 후기 {reviews.length}개</span>
            </div>
          </div>
          <div className="review-overall">
            <small>평균 평점</small>
            <strong>{average("rating").toFixed(1)}</strong>
            <span>후기 {reviews.length}개</span>
          </div>
        </section>
        <section className="review-score-section">
          <h2>선생님들이 평가한 근무 환경</h2>
          <div className="review-scores">
            <b>
              동료 관계
              <strong>
                {average("peer_relationship").toFixed(1)}
                <small>/ 5</small>
              </strong>
            </b>
            <b>
              업무 환경
              <strong>
                {average("workload").toFixed(1)}
                <small>/ 5</small>
              </strong>
            </b>
            <b>
              휴게·연차
              <strong>
                {average("leave_policy").toFixed(1)}
                <small>/ 5</small>
              </strong>
            </b>
          </div>
        </section>
        <section className="facility-review-stories">
          <div>
            <span>솔직한 근무 경험</span>
            <h2>선생님 후기 {reviews.length}개</h2>
          </div>
          {reviews.map((review, index) => (
            <article key={review.id}>
              <header>
                <span>후기 {reviews.length - index}</span>
                <strong>★ {review.rating.toFixed(1)}</strong>
              </header>
              <small>
                {review.worked_from.slice(0, 7)} ~ {review.worked_until?.slice(0, 7) ?? "재직 중"}
              </small>
              <p>{review.body}</p>
              <div className="review-scores">
                <b>
                  동료<strong>{review.peer_relationship}</strong>
                </b>
                <b>
                  업무<strong>{review.workload}</strong>
                </b>
                <b>
                  휴게·연차<strong>{review.leave_policy}</strong>
                </b>
              </div>
              <Link href={`/reviews/${review.id}`}>원장님 답글과 상세 보기 ›</Link>
            </article>
          ))}
        </section>
      </article>
    </Shell>
  );
}

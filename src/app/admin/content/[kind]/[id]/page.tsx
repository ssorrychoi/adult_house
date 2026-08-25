"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import styles from "../../../admin.module.css";

type Post = { id: number; title: string; body: string; visibility: string; is_hidden: boolean; created_at: string; author_id: string; author: string; category: string };
type Comment = { id: number; body: string; parent_id: number | null; is_hidden: boolean; created_at: string; author_id: string; author: string };
type Attachment = { id: number; storage_path: string; file_name: string; mime_type: string; size_bytes: number; kind: "image" | "resource"; is_hidden: boolean; created_at: string; url?: string };
type AuthorProfile = { id: string; nickname: string; job_role: string | null; teacher_started_year: number | null; is_verified: boolean; created_at: string; user_sanctions: Array<{ kind: string; ends_at: string | null }> };

export default function AdminContentDetailPage() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedCommentId, setSelectedCommentId] = useState<number | null>(null);
  const [authorProfile, setAuthorProfile] = useState<AuthorProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: auth }) => {
      if (!auth.user || !["post", "comment"].includes(kind)) return setReady(true);
      const { data, error } = await supabase.rpc("admin_get_content_detail", { item_kind: kind, item_id: Number(id) });
      if (error) return setReady(true);
      const detail = data as unknown as { post: Post | null; comments: Comment[]; attachments: Attachment[] };
      setPost(detail.post);
      setComments(detail.comments);
      setAttachments(await Promise.all((detail.attachments ?? []).map(async (attachment) => ({ ...attachment, url: (await supabase.storage.from("post-attachments").createSignedUrl(attachment.storage_path, 600)).data?.signedUrl }))));
      if (detail.post) {
        const { data: profile } = await supabase.from("profiles").select("id,nickname,job_role,teacher_started_year,is_verified,created_at,user_sanctions(kind,ends_at)").eq("id", detail.post.author_id).maybeSingle();
        setAuthorProfile(profile as unknown as AuthorProfile | null);
      }
      if (kind === "comment") setSelectedCommentId(Number(id));
      setReady(true);
    });
  }, [id, kind, supabase]);

  const moderate = async (targetType: "post" | "comment", targetId: number, isHidden: boolean) => {
    const reason = window.prompt(`${isHidden ? "복구" : "숨김"} 사유를 입력해 주세요.`)?.trim();
    if (!reason) return;
    const { error } = await supabase.rpc("admin_set_content_hidden", { target_type: targetType, target_id: targetId, hidden: !isHidden, reason });
    if (error) return window.alert(error.message);
    if (targetType === "post") setPost((item) => item ? { ...item, is_hidden: !isHidden } : item);
    else setComments((items) => items.map((item) => item.id === targetId ? { ...item, is_hidden: !isHidden } : item));
  };

  const sanction = async (targetUser: string, action: "warning" | "suspension" | "permanent_ban" | "lift") => {
    const reason = action === "lift" ? null : window.prompt(action === "warning" ? "경고 사유를 입력해 주세요." : action === "suspension" ? "7일 정지 사유를 입력해 주세요." : "영구 정지 사유를 입력해 주세요.")?.trim();
    if (action !== "lift" && !reason) return;
    if (!window.confirm(action === "lift" ? "이 회원의 이용 정지를 해제할까요?" : "선택한 제재를 적용할까요?")) return;
    const { error } = await supabase.rpc("admin_manage_user_sanction", { target_user: targetUser, sanction_action: action, reason });
    if (error) return window.alert(error.message);
    if (authorProfile?.id === targetUser) setAuthorProfile((profile) => profile ? { ...profile, user_sanctions: action === "lift" ? profile.user_sanctions.map((item) => ["suspension", "permanent_ban"].includes(item.kind) ? { ...item, ends_at: new Date().toISOString() } : item) : [...profile.user_sanctions, { kind: action, ends_at: action === "suspension" ? new Date(Date.now() + 7 * 86400000).toISOString() : null }] } : profile);
    window.alert("회원 제재가 반영됐습니다.");
  };

  const moderateAttachment = async (attachment: Attachment) => {
    const reason = window.prompt(`${attachment.is_hidden ? "복구" : "숨김"} 사유를 입력해 주세요.`)?.trim();
    if (!reason) return;
    const { error } = await supabase.rpc("admin_set_attachment_hidden", { target_id: attachment.id, hidden: !attachment.is_hidden, reason });
    if (error) return window.alert(error.message);
    setAttachments((items) => items.map((item) => item.id === attachment.id ? { ...item, is_hidden: !attachment.is_hidden } : item));
  };

  if (!ready) return <main className={styles.center}>콘텐츠를 불러오고 있어요.</main>;
  if (!post) return <main className={styles.center}><h1>콘텐츠를 찾을 수 없거나 권한이 없습니다.</h1><Link href="/admin#content">콘텐츠 관리로 돌아가기</Link></main>;

  return <main className={styles.detailPage}>
    <header><Link href="/admin#content">← 콘텐츠 목록</Link><small>ADMIN CONSOLE</small></header>
    <section className={styles.detailPost}>
      <div><span className={post.is_hidden ? styles.danger : styles.badge}>{post.is_hidden ? "숨김" : "노출"} · {post.visibility}</span><time>{new Date(post.created_at).toLocaleString("ko-KR")}</time><button className={post.is_hidden ? styles.restoreButton : styles.dangerButton} onClick={() => moderate("post", post.id, post.is_hidden)}>{post.is_hidden ? "게시글 복구" : "게시글 숨김"}</button></div>
      <h1>{post.title}</h1><p className={styles.detailMeta}>{post.category} · {post.author} · {post.author_id}</p>
      <p className={styles.detailBody}>{post.body}</p>
    </section>
    {attachments.length > 0 && <section className={styles.attachmentPanel}><div><h2>첨부자료 {attachments.length}개</h2><p>이미지와 문서 내용을 확인한 뒤 문제가 있는 파일만 숨김 처리하세요.</p></div><div className={styles.attachmentGrid}>{attachments.map((attachment) => <article key={attachment.id} className={attachment.is_hidden ? styles.hiddenAttachment : undefined}>{attachment.kind === "image" && attachment.url ? <a href={attachment.url} target="_blank" rel="noopener noreferrer"><Image src={attachment.url} alt={attachment.file_name} width={520} height={360} unoptimized/></a> : <div className={styles.filePreview}>📎</div>}<div><span className={attachment.is_hidden ? styles.danger : styles.badge}>{attachment.is_hidden ? "숨김" : "노출"}</span><strong>{attachment.file_name}</strong><small>{attachment.mime_type} · {(attachment.size_bytes / 1_048_576).toFixed(1)}MB</small></div><footer>{attachment.url && <a href={attachment.url} target="_blank" rel="noopener noreferrer">파일 확인 ↗</a>}<button className={attachment.is_hidden ? styles.restoreButton : styles.dangerButton} onClick={() => void moderateAttachment(attachment)}>{attachment.is_hidden ? "자료 복구" : "자료 숨김"}</button></footer></article>)}</div></section>}
    {authorProfile && <section className={styles.authorPanel}><div><div><small>게시글 작성자</small><h2>{authorProfile.nickname}</h2><p>{authorProfile.job_role ?? "직군 미입력"} · {authorProfile.teacher_started_year ? `${authorProfile.teacher_started_year}년 시작` : "시작 연도 미입력"} · {authorProfile.is_verified ? "인증 교사" : "일반 회원"}<br/>가입 {new Date(authorProfile.created_at).toLocaleDateString("ko-KR")} · {authorProfile.id}</p></div><span className={authorProfile.user_sanctions.some((item) => ["suspension", "permanent_ban"].includes(item.kind) && (!item.ends_at || new Date(item.ends_at) > new Date())) ? styles.danger : styles.badge}>{authorProfile.user_sanctions.some((item) => ["suspension", "permanent_ban"].includes(item.kind) && (!item.ends_at || new Date(item.ends_at) > new Date())) ? "이용 정지" : "이용 가능"}</span></div><div className={styles.sanctionActions}><button onClick={() => sanction(authorProfile.id, "warning")}>경고</button><button onClick={() => sanction(authorProfile.id, "suspension")}>7일 정지</button><button className={styles.dangerButton} onClick={() => sanction(authorProfile.id, "permanent_ban")}>영구 정지</button><button className={styles.restoreButton} onClick={() => sanction(authorProfile.id, "lift")}>정지 해제</button></div></section>}
    <section className={styles.detailComments}>
      <h2>댓글 {comments.length}개</h2>
      {comments.map((comment) => <article key={comment.id} className={selectedCommentId === comment.id ? styles.selectedComment : undefined}><div><strong>{comment.author}</strong><span className={comment.is_hidden ? styles.danger : styles.badge}>{comment.is_hidden ? "숨김" : "노출"}</span><time>{new Date(comment.created_at).toLocaleString("ko-KR")}</time><button className={comment.is_hidden ? styles.restoreButton : styles.dangerButton} onClick={() => moderate("comment", comment.id, comment.is_hidden)}>{comment.is_hidden ? "복구" : "숨김"}</button></div><p>{comment.body}</p><footer><small>{comment.parent_id ? `답글 · 상위 댓글 #${comment.parent_id}` : `댓글 #${comment.id}`} · {comment.author_id}</small><div className={styles.commentSanctions}><button onClick={() => sanction(comment.author_id, "warning")}>작성자 경고</button><button onClick={() => sanction(comment.author_id, "suspension")}>7일 정지</button><button onClick={() => sanction(comment.author_id, "permanent_ban")}>영구 정지</button></div></footer></article>)}
      {comments.length === 0 && <p className={styles.empty}>작성된 댓글이 없습니다.</p>}
    </section>
  </main>;
}

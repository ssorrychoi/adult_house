"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./admin.module.css";

type Report = { id: number; reason: string; status: string; created_at: string; post_id: number | null; comment_id: number | null; posts: { title: string; body: string } | null; comments: { body: string } | null };
type Sanction = { kind: "warning" | "suspension" | "permanent_ban"; reason: string; ends_at: string | null; created_at: string };
type Member = { id: string; nickname: string; job_role: string | null; career_band: string | null; teacher_started_year: number | null; is_verified: boolean; created_at: string; user_sanctions: Sanction[] };
type Verification = { id: number; user_id: string; method: string; document_path: string; status: string; rejection_reason: string | null; reviewed_at: string | null; created_at: string; profiles: { nickname: string; job_role: string | null; career_band: string | null; teacher_started_year: number | null } | null };
type ContentItem = { id: number; kind: "post" | "comment"; title: string; body: string; authorId: string; author: string; category: string; isHidden: boolean; viewCount: number; createdAt: string };
type WorkplaceReview = { id: number; facility_name: string; region: string; facility_type: string; worked_from: string; worked_until: string | null; peer_relationship: number; workload: number; leave_policy: number; rating: number; body: string; status: string; rejection_reason: string | null; reviewed_at: string | null; created_at: string; profiles: { nickname: string } | null };
type FacilityRequest = { id: number; owner_id: string; name: string; business_number: string; region: string; document_path: string; status: string; rejection_reason: string | null; reviewed_at: string | null; created_at: string; profiles: { nickname: string } | null };
type Announcement = { id: number; title: string; body: string; image_path: string | null; image_url?: string; is_published: boolean; created_at: string; updated_at: string };
type Faq = { id: number; category: string; question: string; answer: string; sort_order: number; is_published: boolean; created_at: string; updated_at: string };
type Inquiry = { id: number; title: string; body: string; status: string; answer: string | null; answered_at: string | null; created_at: string; profiles: { nickname: string } | null };
type VerificationDraft = { job_role: string; started_year: number };
type CertifiedTeacher = { id: string; nickname: string; job_role: string | null; teacher_started_year: number | null; is_verified: boolean; verification_revoked_at: string | null; verification_revoke_reason: string | null; created_at: string };
type AuditLog = { id: number; admin_id: string; admin_name: string; action: string; target_type: string; target_id: string | null; details: Record<string, unknown>; created_at: string };
type AdminAccount = { user_id: string; email: string; nickname: string; role: string; is_active: boolean; created_at: string };
type AdminSection = "dashboard" | "announcements" | "faqs" | "inquiries" | "reports" | "content" | "members" | "verifications" | "certified-teachers" | "facilities" | "workplace-reviews" | "audit-logs" | "admins";
const sectionTitles: Record<AdminSection, string> = { dashboard: "운영 대시보드", announcements: "공지사항", faqs: "FAQ", inquiries: "문의 관리", reports: "신고 관리", content: "콘텐츠 관리", members: "회원 관리", verifications: "교사 인증", "certified-teachers": "인증 교사 관리", facilities: "운영자 인증", "workplace-reviews": "어린이집 후기 심사", "audit-logs": "감사 로그", admins: "관리자 계정" };
const roleSections: Record<string, AdminSection[]> = {
  super_admin: Object.keys(sectionTitles) as AdminSection[],
  moderator: ["dashboard", "announcements", "faqs", "inquiries", "reports", "content", "members"],
  verifier: ["dashboard", "verifications", "certified-teachers"],
  recruiter: ["dashboard", "facilities", "workplace-reviews"],
};
const statusLabel = (status: string) => status === "approved" ? "승인" : status === "rejected" ? "반려" : "대기";
const currentYear = new Date().getFullYear();
const contentPageSize = 100;

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [verificationDrafts, setVerificationDrafts] = useState<Record<number, VerificationDraft>>({});
  const [certifiedTeachers, setCertifiedTeachers] = useState<CertifiedTeacher[]>([]);
  const [certifiedDrafts, setCertifiedDrafts] = useState<Record<string, VerificationDraft>>({});
  const [certifiedSearch, setCertifiedSearch] = useState("");
  const [content, setContent] = useState<ContentItem[]>([]);
  const [contentSearch, setContentSearch] = useState("");
  const [contentType, setContentType] = useState("post");
  const [contentStatus, setContentStatus] = useState("all");
  const [contentTotal, setContentTotal] = useState(0);
  const [contentPage, setContentPage] = useState(1);
  const [contentLoading, setContentLoading] = useState(false);
  const [workplaceReviews, setWorkplaceReviews] = useState<WorkplaceReview[]>([]);
  const [facilityRequests, setFacilityRequests] = useState<FacilityRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditTarget, setAuditTarget] = useState("all");
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("moderator");
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0, pending: 0 });
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const pendingCounts: Partial<Record<AdminSection, number>> = {
    inquiries: inquiries.filter((item) => item.status === "pending").length,
    reports: reports.filter((item) => item.status === "pending").length,
    verifications: verifications.filter((item) => item.status === "pending").length,
    facilities: facilityRequests.filter((item) => item.status === "pending").length,
    "workplace-reviews": workplaceReviews.filter((item) => item.status === "pending").length,
  };
  const totalPending = Object.values(pendingCounts).reduce((sum, count) => sum + (count ?? 0), 0);

  const loadContent = useCallback(async () => {
    setContentLoading(true);
    const { data, error } = await supabase.rpc("admin_list_content", {
      filter_search: contentSearch.trim(), filter_type: contentType, filter_visibility: contentStatus,
      requested_page: contentPage, requested_page_size: contentPageSize,
    });
    if (error) { setContentLoading(false); return; }
    const rows = (data ?? []) as Array<{ id: number; kind: "post" | "comment"; title: string; body: string; author_id: string; author: string; category: string; is_hidden: boolean; view_count: number; created_at: string; total_count: number }>;
    if (rows.length === 0 && contentPage > 1) { setContentPage((page) => page - 1); setContentLoading(false); return; }
    setContent(rows.map((item) => ({ id: item.id, kind: item.kind, title: item.title, body: item.body, authorId: item.author_id, author: item.author, category: item.category, isHidden: item.is_hidden, viewCount: item.view_count, createdAt: item.created_at })));
    setContentTotal(rows[0]?.total_count ?? 0);
    setContentLoading(false);
  }, [contentPage, contentSearch, contentStatus, contentType, supabase]);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    const { data, error } = await supabase.rpc("admin_list_audit_logs", { filter_search: auditSearch.trim(), filter_target: auditTarget, requested_page: auditPage, requested_page_size: 50 });
    if (!error) {
      const rows = (data ?? []) as unknown as Array<AuditLog & { total_count: number }>;
      if (rows.length === 0 && auditPage > 1) setAuditPage((page) => page - 1);
      else { setAuditLogs(rows); setAuditTotal(rows[0]?.total_count ?? 0); }
    }
    setAuditLoading(false);
  }, [auditPage, auditSearch, auditTarget, supabase]);

  const loadAdminAccounts = useCallback(async () => {
    setAdminsLoading(true);
    const { data } = await supabase.rpc("admin_list_accounts", { filter_search: adminSearch.trim() });
    setAdminAccounts((data ?? []) as AdminAccount[]);
    setAdminsLoading(false);
  }, [adminSearch, supabase]);

  const load = useCallback(async (currentUser: User) => {
    const { data: admin } = await supabase.from("admin_users").select("role").eq("user_id", currentUser.id).eq("is_active", true).maybeSingle();
    setRole(admin?.role ?? null);
    const requestedSection = location.hash.slice(1) as AdminSection;
    if (admin && !roleSections[admin.role]?.includes(requestedSection)) { location.hash = "dashboard"; setActiveSection("dashboard"); }
    if (admin) {
      const [users, posts, comments, reportResult, memberResult, verificationResult, certifiedResult, reviewResult, facilityResult, announcementResult, faqResult, inquiryResult] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("posts").select("id", { count: "exact", head: true }),
        supabase.from("comments").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id,reason,status,created_at,post_id,comment_id,posts(title,body),comments(body)").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,nickname,job_role,career_band,teacher_started_year,is_verified,created_at,user_sanctions(kind,reason,ends_at,created_at)").order("created_at", { ascending: false }).limit(100),
        supabase.from("teacher_verification_requests").select("id,user_id,method,document_path,status,rejection_reason,reviewed_at,created_at,profiles(nickname,job_role,career_band,teacher_started_year)").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,nickname,job_role,teacher_started_year,is_verified,verification_revoked_at,verification_revoke_reason,created_at").or("is_verified.eq.true,teacher_started_year.not.is.null").order("updated_at", { ascending: false }),
        supabase.from("workplace_reviews").select("id,facility_name,region,facility_type,worked_from,worked_until,peer_relationship,workload,leave_policy,rating,body,status,rejection_reason,reviewed_at,created_at,profiles(nickname)").order("created_at", { ascending: false }),
        supabase.from("facilities").select("id,owner_id,name,business_number,region,document_path,status,rejection_reason,reviewed_at,created_at,profiles(nickname)").order("created_at", { ascending: false }),
        supabase.from("announcements").select("id,title,body,image_path,is_published,created_at,updated_at").order("created_at", { ascending: false }),
        supabase.from("faqs").select("id,category,question,answer,sort_order,is_published,created_at,updated_at").order("sort_order").order("created_at", { ascending: false }),
        supabase.from("inquiries").select("id,title,body,status,answer,answered_at,created_at,profiles(nickname)").order("created_at", { ascending: false }),
      ]);
      const reportRows = (reportResult.data ?? []) as unknown as Report[];
      setReports(reportRows);
      setMembers((memberResult.data ?? []) as unknown as Member[]);
      const verificationRows = (verificationResult.data ?? []) as unknown as Verification[];
      setVerifications(verificationRows);
      setVerificationDrafts(Object.fromEntries(verificationRows.map((request) => [request.id, { job_role: request.profiles?.job_role ?? "childcare_teacher", started_year: request.profiles?.teacher_started_year ?? currentYear }])));
      const certifiedRows = (certifiedResult.data ?? []) as CertifiedTeacher[];
      setCertifiedTeachers(certifiedRows);
      setCertifiedDrafts(Object.fromEntries(certifiedRows.map((teacher) => [teacher.id, { job_role: teacher.job_role ?? "childcare_teacher", started_year: teacher.teacher_started_year ?? currentYear }])));
      setWorkplaceReviews((reviewResult.data ?? []) as unknown as WorkplaceReview[]);
      setFacilityRequests((facilityResult.data ?? []) as unknown as FacilityRequest[]);
      const announcementRows = (announcementResult.data ?? []) as Announcement[];
      setAnnouncements(await Promise.all(announcementRows.map(async (item) => item.image_path ? { ...item, image_url: (await supabase.storage.from("announcement-images").createSignedUrl(item.image_path, 300)).data?.signedUrl } : item)));
      setFaqs((faqResult.data ?? []) as Faq[]);
      setInquiries((inquiryResult.data ?? []) as unknown as Inquiry[]);
      setStats({ users: users.count ?? 0, posts: posts.count ?? 0, comments: comments.count ?? 0, pending: reportRows.filter((report) => report.status === "pending").length });
    }
    setReady(true);
  }, [supabase]);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { setUser(data.user); if (data.user) void load(data.user); else setReady(true); }); }, [load, supabase]);
  useEffect(() => {
    if (!role) return;
    const timer = window.setTimeout(() => void loadContent(), contentSearch ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [contentSearch, loadContent, role]);
  useEffect(() => {
    if (!role || activeSection !== "audit-logs") return;
    const timer = window.setTimeout(() => void loadAuditLogs(), auditSearch ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [activeSection, auditSearch, loadAuditLogs, role]);
  useEffect(() => {
    if (role !== "super_admin" || activeSection !== "admins") return;
    const timer = window.setTimeout(() => void loadAdminAccounts(), adminSearch ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [activeSection, adminSearch, loadAdminAccounts, role]);
  useEffect(() => {
    const syncSection = () => { const section = location.hash.slice(1) as AdminSection; if (role && !roleSections[role]?.includes(section)) { location.hash = "dashboard"; return; } setActiveSection(Object.hasOwn(sectionTitles, section) ? section : "dashboard"); };
    syncSection();
    addEventListener("hashchange", syncSection);
    return () => removeEventListener("hashchange", syncSection);
  }, [role]);
  const login = () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/admin` } });
  const resolve = async (report: Report, action: "resolved" | "dismissed") => {
    if (!user) return;
    const note = window.prompt(action === "resolved" ? "처리 내용을 기록해 주세요" : "기각 사유를 기록해 주세요")?.trim();
    if (!note) return;
    if (action === "resolved") {
      if (report.post_id) await supabase.from("posts").update({ is_hidden: true, hidden_at: new Date().toISOString() }).eq("id", report.post_id);
      if (report.comment_id) await supabase.from("comments").update({ is_hidden: true, hidden_at: new Date().toISOString() }).eq("id", report.comment_id);
    }
    const { error } = await supabase.from("reports").update({ status: action, resolution_note: note, resolved_by: user.id, resolved_at: new Date().toISOString() }).eq("id", report.id);
    if (!error) {
      await supabase.from("admin_audit_logs").insert({ admin_id: user.id, action: `report_${action}`, target_type: "report", target_id: String(report.id), details: { note } });
      setReports((items) => items.map((item) => item.id === report.id ? { ...item, status: action } : item));
    }
  };

  const sanction = async (member: Member, kind: Sanction["kind"] | "lift") => {
    if (!user) return;
    if (kind === "lift") {
      await supabase.from("user_sanctions").update({ ends_at: new Date().toISOString() }).eq("user_id", member.id).in("kind", ["suspension", "permanent_ban"]);
    } else {
      const reason = window.prompt(`${member.nickname} 제재 사유를 입력해 주세요`)?.trim();
      if (!reason || reason.length < 2) return;
      // Event-time value; it is intentionally calculated only when an admin confirms the sanction.
      // eslint-disable-next-line react-hooks/purity
      const ends_at = kind === "suspension" ? new Date(Date.now() + 7 * 86400000).toISOString() : null;
      const { error } = await supabase.from("user_sanctions").insert({ user_id: member.id, kind, reason, ends_at, created_by: user.id });
      if (error) return window.alert(error.message);
    }
    await supabase.from("admin_audit_logs").insert({ admin_id: user.id, action: `member_${kind}`, target_type: "user", target_id: member.id });
    await load(user);
  };

  const visibleMembers = members.filter((member) => `${member.nickname} ${member.id}`.toLowerCase().includes(memberSearch.toLowerCase()));
  const activeSanction = (member: Member) => member.user_sanctions.find((item) => ["suspension", "permanent_ban"].includes(item.kind) && (!item.ends_at || new Date(item.ends_at) > new Date()));

  const openDocument = async (path: string) => {
    const { data, error } = await supabase.storage.from("teacher-verifications").createSignedUrl(path, 300);
    if (error) return window.alert(error.message);
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const reviewVerification = async (request: Verification, decision: "approved" | "rejected") => {
    const reason = decision === "rejected" ? window.prompt("반려 사유를 입력해 주세요")?.trim() : null;
    if (decision === "rejected" && (!reason || reason.length < 2)) return;
    const draft = verificationDrafts[request.id];
    if (!draft?.job_role || !draft.started_year) return window.alert("직군과 교사 시작 연도를 모두 입력해 주세요.");
    const { error } = await supabase.rpc("review_teacher_verification", { request_id: request.id, decision, reason, selected_job_role: draft.job_role, selected_started_year: draft.started_year });
    if (error) return window.alert(error.message);
    if (user) await load(user);
  };

  const setTeacherVerificationActive = async (teacher: CertifiedTeacher, active: boolean) => {
    const reason = active ? null : window.prompt(`${teacher.nickname} 선생님의 인증을 해제하는 사유를 입력해 주세요.`)?.trim();
    if (!active && (!reason || reason.length < 2)) return;
    if (!window.confirm(active ? "이 선생님의 인증을 복구할까요?" : "인증 기록은 보존하고 인증 권한만 해제할까요?")) return;
    const { error } = await supabase.rpc("set_teacher_verification_active", { target_user: teacher.id, active, reason });
    if (error) return window.alert(error.message);
    if (user) await load(user);
  };

  const updateTeacherCareer = async (teacher: CertifiedTeacher) => {
    const draft = certifiedDrafts[teacher.id];
    if (!draft?.job_role || !draft.started_year || draft.started_year<1950 || draft.started_year>currentYear) return window.alert("올바른 직군과 시작 연도를 입력해 주세요.");
    const { error } = await supabase.rpc("update_teacher_career", { target_user: teacher.id, selected_job_role: draft.job_role, selected_started_year: draft.started_year });
    if (error) return window.alert(error.message);
    if (user) await load(user);
  };

  const visibleCertifiedTeachers = certifiedTeachers.filter((teacher) => `${teacher.nickname} ${teacher.id} ${teacher.job_role ?? ""}`.toLowerCase().includes(certifiedSearch.toLowerCase()));

  const moderateContent = async (item: ContentItem) => {
    if (!user) return;
    const reason = window.prompt(`${item.isHidden ? "복구" : "숨김"} 사유를 입력해 주세요`)?.trim();
    if (!reason) return;
    const { error } = await supabase.from(item.kind === "post" ? "posts" : "comments").update({ is_hidden: !item.isHidden, hidden_at: item.isHidden ? null : new Date().toISOString() }).eq("id", item.id);
    if (error) return window.alert(error.message);
    await supabase.from("admin_audit_logs").insert({ admin_id: user.id, action: `content_${item.isHidden ? "restored" : "hidden"}`, target_type: item.kind, target_id: String(item.id), details: { reason } });
    await loadContent();
  };

  const reviewWorkplace = async (review: WorkplaceReview, decision: "approved" | "rejected") => {
    const reason = decision === "rejected" ? window.prompt("반려 사유를 입력해 주세요")?.trim() : null;
    if (decision === "rejected" && (!reason || reason.length < 2)) return;
    const { error } = await supabase.rpc("review_workplace_review", { review_id: review.id, decision, reason });
    if (error) return window.alert(error.message);
    if (user) await load(user);
  };

  const reviewFacility = async (facility: FacilityRequest, decision: "approved" | "rejected") => {
    const reason = decision === "rejected" ? window.prompt("반려 사유를 입력해 주세요")?.trim() : null;
    if (decision === "rejected" && (!reason || reason.length < 2)) return;
    const { error } = await supabase.rpc("review_facility", { facility_id: facility.id, decision, reason });
    if (error) return window.alert(error.message);
    if (user) await load(user);
  };

  const openFacilityDocument = async (path: string) => {
    const { data, error } = await supabase.storage.from("facility-verifications").createSignedUrl(path, 300);
    if (error) return window.alert(error.message);
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const toggleAnnouncement = async (announcement: Announcement) => {
    if (!user) return;
    const published = !announcement.is_published;
    const { error } = await supabase.from("announcements").update({ is_published: published, published_at: published ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", announcement.id);
    if (error) return window.alert(error.message);
    await supabase.from("admin_audit_logs").insert({ admin_id: user.id, action: `announcement_${published ? "published" : "unpublished"}`, target_type: "announcement", target_id: String(announcement.id) });
    setAnnouncements((items) => items.map((item) => item.id === announcement.id ? { ...item, is_published: published } : item));
  };

  const toggleFaq = async (faq: Faq) => {
    if (!user) return;
    const published = !faq.is_published;
    const { error } = await supabase.from("faqs").update({ is_published: published, updated_at: new Date().toISOString() }).eq("id", faq.id);
    if (error) return window.alert(error.message);
    await supabase.from("admin_audit_logs").insert({ admin_id: user.id, action: `faq_${published ? "published" : "unpublished"}`, target_type: "faq", target_id: String(faq.id) });
    setFaqs((items) => items.map((item) => item.id === faq.id ? { ...item, is_published: published } : item));
  };

  const saveAdminAccount = async (email: string, selectedRole: string, active: boolean) => {
    const { error } = await supabase.rpc("admin_save_account", { target_email: email, selected_role: selectedRole, active });
    if (error) return window.alert(error.message);
    setNewAdminEmail("");
    await loadAdminAccounts();
  };

  if (!ready) return <main className={styles.center}>관리자 권한을 확인하고 있어요.</main>;
  if (!user) return <main className={styles.center}><h1>선생잎 관리자</h1><p>등록된 관리자 Google 계정으로 로그인해 주세요.</p><button onClick={login}>Google로 관리자 로그인</button></main>;
  if (!role) return <main className={styles.center}><h1>접근 권한이 없습니다</h1><p>{user.email}</p><button onClick={() => supabase.auth.signOut().then(() => location.reload())}>로그아웃</button></main>;

  return <main className={styles.shell}>
    <aside><h1>🌱 선생잎 Admin</h1><strong>{role}</strong><nav>{Object.entries(sectionTitles).filter(([section]) => roleSections[role]?.includes(section as AdminSection)).map(([section, title]) => { const count = section === "dashboard" ? totalPending : pendingCounts[section as AdminSection]; return <a key={section} href={`#${section}`} aria-current={activeSection === section ? "page" : undefined} onClick={() => setActiveSection(section as AdminSection)} style={activeSection === section ? { background: "#283730", color: "#fff" } : undefined}><span>{title}</span>{Boolean(count) && <b className={styles.navCount}>{count}</b>}</a>; })}</nav></aside>
    <section>
      <header><div><small>ADMIN CONSOLE</small><h2>{sectionTitles[activeSection]}</h2></div><button onClick={() => supabase.auth.signOut().then(() => location.reload())}>로그아웃</button></header>
      {activeSection === "dashboard" && <div className={styles.stats}><article><span>회원</span><strong>{stats.users}</strong></article><article><span>게시글</span><strong>{stats.posts}</strong></article><article><span>댓글</span><strong>{stats.comments}</strong></article><article><span>미처리 신고</span><strong>{stats.pending}</strong></article></div>}

      {activeSection === "announcements" && <>
      <div className={styles.title}><h2 id="announcements">공지사항</h2><Link href="/admin/announcements/new" style={{ padding: "10px 13px", border: "1px solid #dbe3df", borderRadius: 10, color: "inherit", background: "#fff", textDecoration: "none" }}>＋ 공지 등록</Link></div>
      <div className={styles.reports}>{announcements.map((announcement) => <article key={announcement.id}>{announcement.image_url && <div role="img" aria-label={`${announcement.title} 첨부 이미지`} style={{ height: 220, marginBottom: 14, borderRadius: 12, background: `center / cover no-repeat url(${announcement.image_url})` }}/>}<div><span className={announcement.is_published ? styles.badge : styles.danger}>{announcement.is_published ? "공개" : "비공개"}</span><small>{new Date(announcement.updated_at).toLocaleString("ko-KR")}</small></div><h3>{announcement.title}</h3><p>{announcement.body}</p><footer><span>등록 {new Date(announcement.created_at).toLocaleDateString("ko-KR")}</span><div><Link href={`/admin/announcements/${announcement.id}/edit`} style={{ padding: "10px 13px", color: "inherit", textDecoration: "none" }}>수정</Link><button className={announcement.is_published ? undefined : styles.primary} onClick={() => toggleAnnouncement(announcement)}>{announcement.is_published ? "비공개" : "공개"}</button></div></footer></article>)}</div>
      </>}

      {activeSection === "faqs" && <>
      <div className={styles.title}><h2 id="faqs">FAQ</h2><Link href="/admin/faqs/new" style={{ padding: "10px 13px", border: "1px solid #dbe3df", borderRadius: 10, color: "inherit", background: "#fff", textDecoration: "none" }}>＋ FAQ 등록</Link></div>
      <div className={styles.reports}>{faqs.map((faq) => <article key={faq.id}><div><span className={faq.is_published ? styles.badge : styles.danger}>{faq.is_published ? "공개" : "비공개"} · {faq.category}</span><small>노출 순서 {faq.sort_order}</small></div><h3>Q. {faq.question}</h3><p>A. {faq.answer}</p><footer><span>{new Date(faq.updated_at).toLocaleDateString("ko-KR")}</span><div><Link href={`/admin/faqs/${faq.id}/edit`} style={{ padding: "10px 13px", color: "inherit", textDecoration: "none" }}>수정</Link><button className={faq.is_published ? undefined : styles.primary} onClick={() => toggleFaq(faq)}>{faq.is_published ? "비공개" : "공개"}</button></div></footer></article>)}</div>
      </>}

      {activeSection === "inquiries" && <>
      <div className={styles.title}><h2 id="inquiries">문의 관리</h2><span>미답변 {inquiries.filter((item) => item.status === "pending").length}건</span></div>
      <div className={styles.reports}>{inquiries.map((inquiry) => <article key={inquiry.id}><div><span className={inquiry.status === "pending" ? styles.danger : styles.badge}>{inquiry.status === "pending" ? "답변 대기" : "답변 완료"}</span><small>{new Date(inquiry.created_at).toLocaleString("ko-KR")}</small></div><h3>{inquiry.title}</h3><p>{inquiry.profiles?.nickname ?? "회원"}<br/>{inquiry.body}{inquiry.answer && <><br/><br/>답변: {inquiry.answer}</>}</p><footer><span>{inquiry.answered_at ? `답변 ${new Date(inquiry.answered_at).toLocaleDateString("ko-KR")}` : "아직 답변하지 않았어요"}</span><Link href={`/admin/inquiries/${inquiry.id}/answer`} className={styles.primary} style={{ padding: "10px 13px", borderRadius: 10, textDecoration: "none" }}>{inquiry.answer ? "답변 수정" : "답변하기"}</Link></footer></article>)}</div>
      </>}

      {activeSection === "reports" && <>
      <div className={styles.title}><h2 id="reports">신고 관리</h2><span>{reports.length}건</span></div>
      <div className={styles.reports}>{reports.map((report) => <article key={report.id}><div><span className={styles.badge}>{report.status}</span><small>{new Date(report.created_at).toLocaleString("ko-KR")}</small></div><h3>{report.posts?.title ?? "댓글 신고"}</h3><p>{report.posts?.body ?? report.comments?.body}</p><footer><span>사유: {report.reason}</span>{report.status === "pending" && <div><button onClick={() => resolve(report, "dismissed")}>기각</button><button className={styles.primary} onClick={() => resolve(report, "resolved")}>숨김 처리</button></div>}</footer></article>)}</div>
      </>}

      {activeSection === "content" && <>
      <div className={styles.title}><h2 id="content">콘텐츠 관리</h2><span>{contentType === "post" ? "전체 게시글" : contentType === "comment" ? "전체 댓글" : "전체 콘텐츠"} {contentTotal.toLocaleString()}건</span></div>
      <div className={styles.filters}><input aria-label="콘텐츠 검색" placeholder="제목, 내용, 작성자 검색" value={contentSearch} onChange={(event) => { setContentSearch(event.target.value); setContentPage(1); }}/><select aria-label="콘텐츠 유형" value={contentType} onChange={(event) => { setContentType(event.target.value); setContentPage(1); }}><option value="all">전체 유형</option><option value="post">게시글</option><option value="comment">댓글</option></select><select aria-label="노출 상태" value={contentStatus} onChange={(event) => { setContentStatus(event.target.value); setContentPage(1); }}><option value="all">전체 상태</option><option value="visible">노출 중</option><option value="hidden">숨김</option></select></div>
      {contentLoading && <p className={styles.loading}>콘텐츠를 불러오는 중이에요…</p>}
      <div className={styles.tableWrap}><table className={styles.contentTable}><thead><tr><th>콘텐츠</th><th>유형</th><th>작성자</th><th>카테고리</th><th>조회수</th><th>상태</th><th>작성일</th><th>처리</th></tr></thead><tbody>{content.map((item) => <tr key={`${item.kind}-${item.id}`}><td><Link href={`/admin/content/${item.kind}/${item.id}`}><strong>{item.title}</strong><small>{item.body}</small></Link></td><td>{item.kind === "post" ? "게시글" : "댓글"}</td><td>{item.author}</td><td>{item.category}</td><td>{item.kind === "post" ? item.viewCount.toLocaleString() : "-"}</td><td><span className={item.isHidden ? styles.danger : styles.badge}>{item.isHidden ? "숨김" : "노출"}</span></td><td>{new Date(item.createdAt).toLocaleDateString("ko-KR")}</td><td><button className={item.isHidden ? styles.restoreButton : styles.dangerButton} onClick={() => moderateContent(item)}>{item.isHidden ? "복구" : "숨김"}</button></td></tr>)}</tbody></table>{!contentLoading && content.length === 0 && <p className={styles.tableEmpty}>조건에 맞는 콘텐츠가 없습니다.</p>}</div>
      <div className={styles.pagination}><button disabled={contentPage === 1 || contentLoading} onClick={() => setContentPage((page) => page - 1)}>이전</button><span>{contentPage} / {Math.max(1, Math.ceil(contentTotal / contentPageSize))}</span><button disabled={contentPage >= Math.ceil(contentTotal / contentPageSize) || contentLoading} onClick={() => setContentPage((page) => page + 1)}>다음</button></div>
      </>}

      {activeSection === "members" && <>
      <div className={styles.title}><h2 id="members">회원 관리</h2><input aria-label="회원 검색" placeholder="닉네임 또는 사용자 ID 검색" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)}/></div>
      <div className={styles.members}>{visibleMembers.map((member) => { const active = activeSanction(member); return <article key={member.id}><div><strong>{member.nickname}</strong><span className={active ? styles.danger : styles.badge}>{active ? active.kind === "permanent_ban" ? "영구 정지" : "이용 정지" : member.is_verified ? "인증 회원" : "일반 회원"}</span></div><small>{member.id}</small><p>{member.job_role ?? "직군 미입력"} · {member.teacher_started_year ? `${member.teacher_started_year}년 시작 · ${currentYear - member.teacher_started_year + 1}년 차` : member.career_band ?? "경력 미입력"} · 가입 {new Date(member.created_at).toLocaleDateString("ko-KR")}</p><footer>{active ? <button onClick={() => sanction(member, "lift")}>정지 해제</button> : <><button onClick={() => sanction(member, "warning")}>경고</button><button onClick={() => sanction(member, "suspension")}>7일 정지</button><button className={styles.primary} onClick={() => sanction(member, "permanent_ban")}>영구 정지</button></>}</footer></article>; })}</div>
      </>}

      {activeSection === "verifications" && <>
      <div className={styles.title}><h2 id="verifications">인증 심사</h2><span>전체 {verifications.length}건</span></div>
      <div className={styles.reports}>{verifications.map((request) => <article key={request.id}><div><span className={request.status === "rejected" ? styles.danger : styles.badge}>{statusLabel(request.status)} · {request.method === "certificate" ? "자격증" : "경력 증명"}</span><small>{new Date(request.reviewed_at ?? request.created_at).toLocaleString("ko-KR")}</small></div><h3>{request.profiles?.nickname ?? "회원"}</h3><p>현재 설정: {request.profiles?.job_role ?? "직군 미입력"} · {request.profiles?.teacher_started_year ? `${request.profiles.teacher_started_year}년 시작 · ${currentYear - request.profiles.teacher_started_year + 1}년 차` : "시작 연도 미입력"}{request.rejection_reason && <><br/>반려 사유: {request.rejection_reason}</>}</p>{request.status === "pending" && <div className={styles.verificationFields}><label>승인 직군<select value={verificationDrafts[request.id]?.job_role ?? "childcare_teacher"} onChange={(event) => setVerificationDrafts((items) => ({ ...items, [request.id]: { job_role: event.target.value, started_year: items[request.id]?.started_year ?? currentYear } }))}><option value="childcare_teacher">보육교사</option><option value="special_education_teacher">특수교사</option><option value="kindergarten_teacher">유치원교사</option><option value="other">기타</option></select></label><label>교사 시작 연도<input type="number" min="1950" max={currentYear} value={verificationDrafts[request.id]?.started_year ?? currentYear} onChange={(event) => setVerificationDrafts((items) => ({ ...items, [request.id]: { job_role: items[request.id]?.job_role ?? "childcare_teacher", started_year: Number(event.target.value) } }))}/><small>{verificationDrafts[request.id]?.started_year ? `${currentYear - verificationDrafts[request.id].started_year + 1}년 차로 적용` : "연도를 입력해 주세요"}</small></label></div>}<footer><button onClick={() => openDocument(request.document_path)}>제출 문서 보기</button>{request.status === "pending" && <div><button onClick={() => reviewVerification(request, "rejected")}>반려</button><button className={styles.primary} onClick={() => reviewVerification(request, "approved")}>직군·연차 확정 승인</button></div>}</footer></article>)}</div>
      </>}

      {activeSection === "certified-teachers" && <>
      <div className={styles.title}><h2 id="certified-teachers">인증 교사 관리</h2><input aria-label="인증 교사 검색" placeholder="닉네임, ID, 직군 검색" value={certifiedSearch} onChange={(event) => setCertifiedSearch(event.target.value)}/></div>
      <div className={styles.tableWrap}><table><thead><tr><th>선생님</th><th>직군</th><th>교사 시작</th><th>현재 연차</th><th>인증 상태</th><th>처리</th></tr></thead><tbody>{visibleCertifiedTeachers.map((teacher) => <tr key={teacher.id}><td><strong>{teacher.nickname}</strong><small>{teacher.id}</small></td><td><select aria-label={`${teacher.nickname} 직군`} value={certifiedDrafts[teacher.id]?.job_role ?? "childcare_teacher"} onChange={(event) => setCertifiedDrafts((items) => ({ ...items, [teacher.id]: { job_role: event.target.value, started_year: items[teacher.id]?.started_year ?? currentYear } }))}><option value="childcare_teacher">보육교사</option><option value="special_education_teacher">특수교사</option><option value="kindergarten_teacher">유치원교사</option><option value="other">기타</option></select></td><td><input aria-label={`${teacher.nickname} 교사 시작 연도`} type="number" min="1950" max={currentYear} value={certifiedDrafts[teacher.id]?.started_year ?? currentYear} onChange={(event) => setCertifiedDrafts((items) => ({ ...items, [teacher.id]: { job_role: items[teacher.id]?.job_role ?? "childcare_teacher", started_year: Number(event.target.value) } }))}/></td><td>{certifiedDrafts[teacher.id]?.started_year ? `${currentYear - certifiedDrafts[teacher.id].started_year + 1}년 차` : "-"}</td><td><span className={teacher.is_verified ? styles.badge : styles.danger}>{teacher.is_verified ? "인증 활성" : "인증 해제"}</span>{teacher.verification_revoke_reason && <small>사유: {teacher.verification_revoke_reason}<br/>{teacher.verification_revoked_at && new Date(teacher.verification_revoked_at).toLocaleDateString("ko-KR")}</small>}</td><td><div className={styles.tableActions}><button className={styles.restoreButton} onClick={() => void updateTeacherCareer(teacher)}>변경 저장</button><button className={teacher.is_verified ? styles.dangerButton : styles.restoreButton} onClick={() => void setTeacherVerificationActive(teacher, !teacher.is_verified)}>{teacher.is_verified ? "인증 해제" : "인증 복구"}</button></div></td></tr>)}</tbody></table>{visibleCertifiedTeachers.length === 0 && <p className={styles.tableEmpty}>조건에 맞는 인증 교사가 없습니다.</p>}</div>
      </>}

      {activeSection === "facilities" && <>
      <div className={styles.title}><h2 id="facilities">어린이집 운영자 인증</h2><span>전체 {facilityRequests.length}건</span></div>
      <div className={styles.reports}>{facilityRequests.map((facility) => <article key={facility.id}><div><span className={facility.status === "rejected" ? styles.danger : styles.badge}>{statusLabel(facility.status)} · 운영자 신청</span><small>{new Date(facility.reviewed_at ?? facility.created_at).toLocaleString("ko-KR")}</small></div><h3>{facility.name}</h3><p>{facility.region} · 사업자·고유번호 {facility.business_number}<br/>신청자: {facility.profiles?.nickname ?? facility.owner_id}{facility.rejection_reason && <><br/>반려 사유: {facility.rejection_reason}</>}</p><footer><button onClick={() => openFacilityDocument(facility.document_path)}>증빙 문서 보기</button>{facility.status === "pending" && <div><button onClick={() => reviewFacility(facility, "rejected")}>반려</button><button className={styles.primary} onClick={() => reviewFacility(facility, "approved")}>승인</button></div>}</footer></article>)}</div>
      </>}

      {activeSection === "workplace-reviews" && <>
      <div className={styles.title}><h2 id="workplace-reviews">어린이집 후기 심사</h2><span>전체 {workplaceReviews.length}건</span></div>
      <div className={styles.reports}>{workplaceReviews.map((review) => <article key={review.id}><div><span className={review.status === "rejected" ? styles.danger : styles.badge}>{statusLabel(review.status)} · ★ {review.rating} · {review.facility_type}</span><small>{new Date(review.reviewed_at ?? review.created_at).toLocaleString("ko-KR")}</small></div><h3>{review.facility_name}</h3><p>{review.region} · 근무 {review.worked_from}~{review.worked_until ?? "현재"}<br/>{review.body}{review.rejection_reason && <><br/>반려 사유: {review.rejection_reason}</>}</p><footer><span>동료 {review.peer_relationship} · 업무 {review.workload} · 휴가 {review.leave_policy}</span>{review.status === "pending" && <div><button onClick={() => reviewWorkplace(review, "rejected")}>반려</button><button className={styles.primary} onClick={() => reviewWorkplace(review, "approved")}>승인</button></div>}</footer></article>)}</div>
      </>}

      {activeSection === "audit-logs" && <>
      <div className={styles.title}><h2 id="audit-logs">관리자 감사 로그</h2><span>전체 {auditTotal.toLocaleString()}건</span></div>
      <div className={styles.filters}><input aria-label="감사 로그 검색" placeholder="관리자, 작업, 대상 ID, 사유 검색" value={auditSearch} onChange={(event) => { setAuditSearch(event.target.value); setAuditPage(1); }}/><select aria-label="감사 로그 대상" value={auditTarget} onChange={(event) => { setAuditTarget(event.target.value); setAuditPage(1); }}><option value="all">전체 대상</option><option value="post">게시글</option><option value="comment">댓글</option><option value="user">회원</option><option value="report">신고</option><option value="announcement">공지사항</option><option value="faq">FAQ</option></select></div>
      {auditLoading && <p className={styles.loading}>감사 로그를 불러오는 중이에요…</p>}
      <div className={styles.tableWrap}><table className={styles.auditTable}><thead><tr><th>처리 일시</th><th>관리자</th><th>작업</th><th>대상</th><th>처리 사유·상세</th></tr></thead><tbody>{auditLogs.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString("ko-KR")}</td><td><strong>{log.admin_name}</strong><small>{log.admin_id}</small></td><td><span className={styles.badge}>{log.action.replaceAll("_", " ")}</span></td><td>{log.target_type} {log.target_id && (log.target_type === "post" || log.target_type === "comment") ? <Link href={`/admin/content/${log.target_type}/${log.target_id}`}>#{log.target_id}</Link> : log.target_id ? `#${log.target_id}` : "-"}</td><td className={styles.auditDetails}>{log.details.reason ? String(log.details.reason) : Object.keys(log.details).length ? JSON.stringify(log.details) : "기록 없음"}</td></tr>)}</tbody></table>{!auditLoading && auditLogs.length === 0 && <p className={styles.tableEmpty}>조건에 맞는 감사 로그가 없습니다.</p>}</div>
      <div className={styles.pagination}><button disabled={auditPage === 1 || auditLoading} onClick={() => setAuditPage((page) => page - 1)}>이전</button><span>{auditPage} / {Math.max(1, Math.ceil(auditTotal / 50))}</span><button disabled={auditPage >= Math.ceil(auditTotal / 50) || auditLoading} onClick={() => setAuditPage((page) => page + 1)}>다음</button></div>
      </>}

      {activeSection === "admins" && <>
      <div className={styles.title}><h2 id="admins">관리자 계정</h2><span>전체 {adminAccounts.length}명</span></div>
      <form className={styles.adminAddForm} onSubmit={(event) => { event.preventDefault(); void saveAdminAccount(newAdminEmail, newAdminRole, true); }}><label>가입 이메일<input type="email" required placeholder="관리자로 등록할 Google 이메일" value={newAdminEmail} onChange={(event) => setNewAdminEmail(event.target.value)}/></label><label>역할<select value={newAdminRole} onChange={(event) => setNewAdminRole(event.target.value)}><option value="moderator">운영 관리자</option><option value="verifier">교사 인증 담당</option><option value="recruiter">채용·후기 담당</option><option value="super_admin">최고 관리자</option></select></label><button type="submit">관리자 등록</button></form>
      <div className={styles.title}><h3>등록된 관리자</h3><input aria-label="관리자 검색" placeholder="이메일, 닉네임, 역할 검색" value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)}/></div>
      {adminsLoading && <p className={styles.loading}>관리자 계정을 불러오는 중이에요…</p>}
      <div className={styles.tableWrap}><table className={styles.adminTable}><thead><tr><th>관리자</th><th>역할</th><th>상태</th><th>등록일</th><th>처리</th></tr></thead><tbody>{adminAccounts.map((account) => <tr key={account.user_id}><td><strong>{account.nickname}</strong><small>{account.email}<br/>{account.user_id}</small></td><td><select aria-label={`${account.nickname} 역할`} value={account.role} onChange={(event) => setAdminAccounts((items) => items.map((item) => item.user_id === account.user_id ? { ...item, role: event.target.value } : item))}><option value="super_admin">최고 관리자</option><option value="moderator">운영 관리자</option><option value="verifier">교사 인증 담당</option><option value="recruiter">채용·후기 담당</option></select></td><td><span className={account.is_active ? styles.badge : styles.danger}>{account.is_active ? "활성" : "비활성"}</span></td><td>{new Date(account.created_at).toLocaleDateString("ko-KR")}</td><td><div className={styles.tableActions}><button className={styles.restoreButton} onClick={() => void saveAdminAccount(account.email, account.role, account.is_active)}>역할 저장</button><button className={account.is_active ? styles.dangerButton : styles.restoreButton} onClick={() => { if (window.confirm(account.is_active ? "이 관리자의 접근 권한을 비활성화할까요?" : "이 관리자를 다시 활성화할까요?")) void saveAdminAccount(account.email, account.role, !account.is_active); }}>{account.is_active ? "비활성화" : "활성화"}</button></div></td></tr>)}</tbody></table>{!adminsLoading && adminAccounts.length === 0 && <p className={styles.tableEmpty}>등록된 관리자가 없습니다.</p>}</div>
      </>}
    </section>
  </main>;
}

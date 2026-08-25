"use client";

import type { User } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Screen = "home" | "list" | "detail" | "write" | "materials" | "material-detail" | "material-write" | "my-materials" | "search" | "career" | "review-write" | "my-reviews" | "saved-jobs" | "blocked-users" | "account-settings" | "alerts" | "profile" | "verification" | "notices" | "faqs" | "inquiries" | "login";
type JobRole = "childcare_teacher" | "special_education_teacher" | "kindergarten_teacher" | "other";
type CareerBand = "under_1" | "1_3" | "4_6" | "7_plus";
type Attachment = { id: number; storage_path: string; file_name: string; mime_type: string; size_bytes: number; kind: "image" | "resource"; download_count: number; url?: string };
type Post = { id?: number; authorId?: string; category: string; avatar: string; author: string; career: string; time: string; createdAt: string; title: string; preview: string; body: string; likes: number; comments: number; views: number; wish: string; attachments: Attachment[] };
type PostCategory = { id: number; parent_id: number | null; name: string };
type Comment = { id: number; authorId: string; author: string; body: string; time: string };
type Notice = { id: number; title: string; body: string; image_path: string | null; image_url?: string; published_at: string | null; created_at: string };
type UserFaq = { id: number; category: string; question: string; answer: string };
type UserInquiry = { id: number; title: string; body: string; status: string; answer: string | null; answered_at: string | null; created_at: string };
type Notification = { id: number; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };
type TeacherVerification = { id: number; method: string; status: "pending" | "approved" | "rejected"; rejection_reason: string | null; created_at: string; reviewed_at: string | null };
type MyWorkplaceReview = { id: number; facility_name: string; region: string; facility_type: string; worked_from: string; worked_until: string | null; peer_relationship: number; workload: number; leave_policy: number; rating: number; body: string; status: "pending" | "approved" | "rejected"; rejection_reason: string | null; created_at: string; reviewed_at: string | null };
type JobListing = { id: number; facility_name: string; region: string; title: string; description: string; job_role: string; employment_type: string; apply_url: string | null; closes_at: string | null; created_at: string };
type TrendingPost = { post_id: number; author_id: string; category: string; nickname: string; career_band: string | null; teacher_started_year: number | null; title: string; body: string; created_at: string; response_wish: string | null; view_count: number; like_count: number; comment_count: number };

const categories = [
  ["💬", "선생님 이야기", "직장과 관계 고민을 나눠요", "mint"],
  ["🧸", "업무 도움", "수업·행사·행정 자료를 찾아요", "yellow"],
  ["🧭", "커리어", "채용과 어린이집 후기를 살펴봐요", "coral"],
  ["⚖️", "전문가 Q&A", "근로와 법률 고민을 질문해요", "lilac"],
] as const;
const currentYear = new Date().getFullYear();
const postsPageSize = 20;
const initialScreen = (): Screen => {
  if (typeof window === "undefined") return "home";
  const params = new URLSearchParams(window.location.search); const requested = params.get("screen");
  if (params.get("login") === "1") return "login";
  return ["list", "materials", "career"].includes(requested ?? "") ? requested as Screen : "home";
};

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [postsOffset, setPostsOffset] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [postCategories, setPostCategories] = useState<PostCategory[]>([]);
  const [postsVersion, setPostsVersion] = useState(0);
  const [selectedPost] = useState<Post | null>(null);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [previous, setPrevious] = useState<Screen>("home");
  const [category, setCategory] = useState("전체");
  const [search, setSearch] = useState("");
  const [careerTab, setCareerTab] = useState<"jobs" | "reviews">("jobs");
  const [toast, setToast] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [popularPosts, setPopularPosts] = useState<Post[]>([]);
  const go = (next: Screen) => { setPrevious(screen); setScreen(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 1600); };
  const titles: Partial<Record<Screen, string>> = { list: "선생님 이야기", detail: "선생님 이야기", write: "새 이야기", materials: "수업자료", "material-detail": "수업자료", "material-write": "자료 공유", "my-materials": "내 자료 관리", search: "검색", career: "커리어", "review-write": "어린이집 후기", "my-reviews": "작성한 후기", "saved-jobs": "저장한 채용공고", "blocked-users": "차단한 사용자", "account-settings": "계정 설정", alerts: "알림", profile: "내 정보", verification: "선생님 인증", notices: "공지사항", faqs: "FAQ", inquiries: "문의하기" };

  useEffect(() => {
    supabase.from("categories").select("id,parent_id,name").eq("is_active", true).order("sort_order").then(({ data }) => setPostCategories(data ?? []));
  }, [supabase]);

  useEffect(() => {
    const loadUser = async (nextUser: User | null) => {
      setUser(nextUser);
      if (!nextUser) { setNeedsOnboarding(false); setUnreadCount(0); return; }
      const { data } = await supabase.from("profiles").select("job_role,career_band").eq("id", nextUser.id).single();
      setNeedsOnboarding(!data?.job_role || !data?.career_band);
    };
    supabase.auth.getUser().then(({ data }) => loadUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { void loadUser(session?.user ?? null); });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const loadPosts = useCallback(async (offset: number, append = false) => {
    const { data } = await supabase.from("posts").select("id,author_id,title,body,created_at,response_wish,view_count,categories(name),profiles!posts_author_id_fkey(nickname,career_band,teacher_started_year),reactions(count),comments(count),post_attachments(id,storage_path,file_name,mime_type,size_bytes,kind,download_count)").eq("is_hidden", false).order("created_at", { ascending: false }).range(offset, offset + postsPageSize - 1);
    if (!data) { if (!append) setFeedPosts([]); setPostsLoading(false); setPostsLoadingMore(false); return; }
      const careers: Record<string, string> = { under_1: "1년 미만", "1_3": "1~3년 차", "4_6": "4~6년 차", "7_plus": "7년 차 이상" };
      const wishes: Record<string, string> = { comfort: "공감과 위로 💛", experience: "비슷한 경험 🌿", advice: "현실적인 조언 💡", resources: "자료 추천 📎" };
      const nextPosts = data.filter((row) => !blockedIds.includes(row.author_id)).map((row) => {
        const category = row.categories as unknown as { name: string } | null;
        const profile = row.profiles as unknown as { nickname: string; career_band: string | null; teacher_started_year: number | null } | null;
        const reactions = row.reactions as unknown as Array<{ count: number }>;
        const comments = row.comments as unknown as Array<{ count: number }>;
        const attachments = row.post_attachments as unknown as Attachment[];
        return { id: row.id, authorId: row.author_id, category: category?.name ?? "선생님 이야기", avatar: "🌱", author: profile?.nickname ?? "익명의 새싹쌤", career: profile?.teacher_started_year ? `${currentYear - profile.teacher_started_year + 1}년 차` : careers[profile?.career_band ?? ""] ?? "경력 미입력", time: new Date(row.created_at).toLocaleDateString("ko-KR"), createdAt: row.created_at, title: row.title, preview: row.body.slice(0, 100), body: row.body, likes: reactions[0]?.count ?? 0, comments: comments[0]?.count ?? 0, views: row.view_count ?? 0, wish: wishes[row.response_wish ?? ""] ?? "이야기를 들어주세요", attachments: attachments ?? [] };
      });
    setFeedPosts((posts) => append ? [...posts, ...nextPosts.filter((post) => !posts.some((item) => item.id === post.id))] : nextPosts);
    setPostsOffset(offset + data.length);
    setHasMorePosts(data.length === postsPageSize);
    setPostsLoading(false);
    setPostsLoadingMore(false);
  }, [blockedIds, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPosts(0));
    return () => window.clearTimeout(timer);
  }, [loadPosts, postsVersion, user]);

  useEffect(() => {
    supabase.rpc("get_trending_posts", { result_limit: 3 }).then(({ data }) => {
      const careers: Record<string, string> = { under_1: "1년 미만", "1_3": "1~3년 차", "4_6": "4~6년 차", "7_plus": "7년 차 이상" };
      const wishes: Record<string, string> = { comfort: "공감과 위로 💛", experience: "비슷한 경험 🌿", advice: "현실적인 조언 💡", resources: "자료 추천 📎" };
      setPopularPosts(((data ?? []) as TrendingPost[]).filter((row) => !blockedIds.includes(row.author_id)).map((row) => ({
        id: row.post_id, authorId: row.author_id, category: row.category, avatar: "🌱",
        author: row.nickname, career: row.teacher_started_year ? `${currentYear - row.teacher_started_year + 1}년 차` : careers[row.career_band ?? ""] ?? "경력 미입력",
        time: new Date(row.created_at).toLocaleDateString("ko-KR"), createdAt: row.created_at,
        title: row.title, preview: row.body.slice(0, 100), body: row.body,
        likes: row.like_count, comments: row.comment_count, views: row.view_count,
        wish: wishes[row.response_wish ?? ""] ?? "이야기를 들어주세요", attachments: [],
      })));
    });
  }, [blockedIds, postsVersion, supabase, user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id).then(({ data }) => setBlockedIds(data?.map((item) => item.blocked_id) ?? []));
  }, [supabase, user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null).then(({ count }) => setUnreadCount(count ?? 0));
    const channel = supabase.channel(`notification-count-${user.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => setUnreadCount((count) => count + 1)).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, user]);

  const openPost = (post: Post) => { if (post.id) router.push(`/posts/${post.id}`); };
  const openMaterial = (post: Post) => { if (post.id) router.push(`/materials/${post.id}`); };
  const handleViewed = useCallback((id: number, views: number) => {
    const update = (posts: Post[]) => posts.some((item) => item.id === id && item.views !== views) ? posts.map((item) => item.id === id ? { ...item, views } : item) : posts;
    setFeedPosts(update); setPopularPosts(update);
  }, []);

  return <main className="site-shell">
    <aside className="desktop-rail"><button className="brand" onClick={() => go("home")}><span>🌱</span> 선생잎</button><button className={screen === "home" ? "active" : ""} onClick={() => go("home")}>⌂ 홈</button><button className={["list", "detail", "write"].includes(screen) ? "active" : ""} onClick={() => go("list")}>☵ 커뮤니티</button><button className={["materials", "material-detail", "material-write", "my-materials"].includes(screen) ? "active" : ""} onClick={() => go("materials")}>▤ 자료실</button><button className={screen === "career" ? "active" : ""} onClick={() => go("career")}>▣ 커리어</button><button className={screen === "alerts" ? "active" : ""} onClick={() => go("alerts")}>♧ 알림</button><button className={screen === "profile" ? "active" : ""} onClick={() => go("profile")}>☺ 내 정보</button><button className="rail-write" onClick={() => go("write")}>＋ 이야기 쓰기</button></aside>
    <section className="app-frame">
      {needsOnboarding && user ? <OnboardingScreen user={user} supabase={supabase} onComplete={() => { setNeedsOnboarding(false); flash("선생잎에 오신 걸 환영해요 🌱"); }}/>: <>{screen !== "home" && screen !== "login" && <header className="topbar"><button className="icon-button" aria-label="뒤로 가기" onClick={() => setScreen(previous)}>‹</button><h1>{titles[screen]}</h1><button className="icon-button" aria-label="검색" onClick={() => go("search")}>⌕</button></header>}
      {screen === "home" && <HomeScreen posts={feedPosts} loading={postsLoading} openPost={openPost} go={go} unreadCount={unreadCount}/>}
      {screen === "list" && <ListScreen posts={feedPosts.filter((post) => post.attachments.length === 0)} categories={postCategories} loading={postsLoading} loadingMore={postsLoadingMore} hasMore={hasMorePosts} loadMore={() => { if (!postsLoadingMore) { setPostsLoadingMore(true); void loadPosts(postsOffset, true); } }} category={category} setCategory={setCategory} openPost={openPost} go={go}/>}
      {screen === "detail" && selectedPost && <DetailScreen post={selectedPost} user={user} blockedIds={blockedIds} supabase={supabase} go={go} onBlocked={(id) => setBlockedIds((ids) => [...ids, id])} onChanged={() => setPostsVersion((value) => value + 1)} onViewed={handleViewed} flash={flash}/>}
      {screen === "write" && <WriteScreen user={user} categories={postCategories} supabase={supabase} onCreated={() => setPostsVersion((value) => value + 1)} flash={flash} go={go}/>}
      {screen === "materials" && <MaterialsScreen posts={feedPosts} categories={postCategories} openMaterial={openMaterial} go={go}/>}
      {screen === "material-detail" && selectedPost && <DetailScreen post={selectedPost} user={user} blockedIds={blockedIds} supabase={supabase} go={go} onBlocked={(id) => setBlockedIds((ids) => [...ids, id])} onChanged={() => setPostsVersion((value) => value + 1)} onViewed={handleViewed} flash={flash}/>}
      {screen === "material-write" && <MaterialWriteScreen user={user} categories={postCategories} supabase={supabase} onCreated={() => setPostsVersion((value) => value + 1)} flash={flash} go={go}/>}
      {screen === "my-materials" && <MyMaterialsScreen user={user} categories={postCategories} supabase={supabase} onChanged={() => setPostsVersion((value) => value + 1)} flash={flash} go={go}/>}
      {screen === "search" && <SearchScreen search={search} setSearch={setSearch} supabase={supabase} openPost={(post) => post.attachments.length ? openMaterial(post) : openPost(post)} openJob={(id) => router.push(`/jobs/${id}`)} openReview={(id) => router.push(`/reviews/${id}`)}/>} 
      {screen === "career" && <CareerScreen tab={careerTab} setTab={setCareerTab} flash={flash} go={go} user={user}/>}
      {screen === "review-write" && <ReviewWriteScreen user={user} supabase={supabase} go={go} flash={flash}/>}
      {screen === "my-reviews" && <MyReviewsScreen user={user} supabase={supabase} go={go} flash={flash}/>}
      {screen === "saved-jobs" && <SavedJobsScreen user={user} supabase={supabase} go={go} flash={flash}/>}
      {screen === "blocked-users" && <BlockedUsersScreen user={user} supabase={supabase} go={go} flash={flash} onUnblocked={(id) => setBlockedIds((ids) => ids.filter((item) => item !== id))}/>}
      {screen === "account-settings" && <AccountSettingsScreen user={user} supabase={supabase} go={go} flash={flash}/>}
      {screen === "alerts" && <AlertsScreen user={user} supabase={supabase} go={go} onUnreadChange={setUnreadCount}/>} 
      {screen === "profile" && <ProfileScreen user={user} posts={feedPosts} supabase={supabase} openPost={(post) => post.attachments.length ? openMaterial(post) : openPost(post)} go={go} flash={flash} signOut={() => supabase.auth.signOut()}/>}
      {screen === "verification" && <VerificationScreen user={user} supabase={supabase} go={go} flash={flash}/>}
      {screen === "notices" && <NoticesScreen supabase={supabase}/>} {screen === "faqs" && <FaqsScreen supabase={supabase}/>} {screen === "inquiries" && <InquiriesScreen user={user} supabase={supabase} go={go} flash={flash}/>} {screen === "login" && <LoginScreen supabase={supabase} flash={flash}/>} 
      {screen !== "login" && <BottomNav screen={screen} go={go}/>}</>} {toast && <div className="toast" role="status">{toast}</div>}
    </section>
    <aside className="desktop-side"><div className="side-card"><span className="side-sprout">🌱</span><strong>오늘도 수고했어요</strong><p>선생님의 마음도 돌봄이 필요하니까요.</p></div><div className="side-card popular-card"><strong>지금 많이 보는 이야기</strong>{popularPosts.length ? <ol>{popularPosts.map((post) => <li key={post.id}><button onClick={() => openPost(post)}><span>{post.title}</span><small>조회 {post.views} · 🫶 {post.likes} · 💬 {post.comments}</small></button></li>)}</ol> : <p>아직 인기 이야기가 없어요.</p>}</div></aside>
  </main>;
}

function HomeScreen({ posts, loading, openPost, go, unreadCount }: { posts: Post[]; loading: boolean; openPost: (post: Post) => void; go: (screen: Screen) => void; unreadCount: number }) {
  return <><header className="home-header"><button className="brand" onClick={() => go("home")}><span>🌱</span> 선생잎</button><div><button className="icon-button" onClick={() => go("search")} aria-label="검색">⌕</button><button className="icon-button notification-button" onClick={() => go("alerts")} aria-label={`알림 ${unreadCount}개`}>♧{unreadCount > 0 && <b>{unreadCount > 99 ? "99+" : unreadCount}</b>}</button></div></header><section className="welcome"><div><span className="eyebrow">선생님, 어서 와요</span><h1>오늘은 어떤 하루였나요?</h1><p>마음은 가볍게, 정보는 든든하게 나눠요.</p></div><span className="mascot">🌱</span></section><section className="category-grid">{categories.map(([icon, title, copy, tone]) => <button key={title} className={`category-card ${tone}`} onClick={() => go(title === "커리어" ? "career" : title === "업무 도움" ? "materials" : "list")}><span>{icon}</span><strong>{title}</strong><small>{copy}</small><b>›</b></button>)}</section><button className="resource-share-card" onClick={() => go("material-write")}><span>📎</span><span><strong>수업자료 공유하기</strong><small>놀이·수업 이미지와 문서 자료를 함께 나눠요</small></span><b>공유하기 ›</b></button><section className="section-block"><div className="section-title"><div><span>💛 지금 서로에게 필요한</span><h2>선생님들의 이야기</h2></div><button onClick={() => go("list")}>전체 보기 ›</button></div><div className="home-posts">{loading ? <p className="feed-state">이야기를 불러오는 중이에요…</p> : posts.filter((post) => post.attachments.length === 0).length ? posts.filter((post) => post.attachments.length === 0).slice(0, 2).map((post) => <button className="mini-post" key={post.id} onClick={() => openPost(post)}><span className="tag">{post.category}</span><h3>{post.title}</h3><p>{post.preview}</p><small>조회 {post.views}　🫶 {post.likes}　💬 {post.comments}</small></button>) : <p className="feed-state">아직 공개된 이야기가 없어요.<br/>첫 이야기를 들려주세요 🌱</p>}</div></section></>;
}

function ListScreen({ posts, categories, loading, loadingMore, hasMore, loadMore, category, setCategory, openPost, go }: { posts: Post[]; categories: PostCategory[]; loading: boolean; loadingMore: boolean; hasMore: boolean; loadMore: () => void; category: string; setCategory: (value: string) => void; openPost: (post: Post) => void; go: (screen: Screen) => void }) {
  const loadMoreButton = useRef<HTMLButtonElement>(null);
  const storyRoot = categories.find((item) => item.name === "선생님 이야기");
  const sub = ["전체", ...categories.filter((item) => item.parent_id === storyRoot?.id).map((item) => item.name)];
  const visiblePosts = posts.filter((post) => category === "전체" || post.category === category);
  useEffect(() => {
    const button = loadMoreButton.current;
    if (!button || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore(); }, { rootMargin: "160px" });
    observer.observe(button);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadingMore]);
  return <><section className="page-hero"><div><h2>오늘도 수고했어요</h2><p>혼자 담아둔 이야기를 편하게 나눠요.</p></div><span className="small-mascot">🌱</span></section><div className="chips">{sub.map((item) => <button className={category === item ? "selected" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><div className="filterbar"><button>최신순⌄</button><button>☷ 직군·경력</button><span>불러온 글 {posts.length}개</span></div><section className="post-list">{loading ? <p className="feed-state">이야기를 불러오는 중이에요…</p> : visiblePosts.length ? visiblePosts.map((post) => <PostRow key={post.id} post={post} onClick={() => openPost(post)}/>) : <p className="feed-state">이 카테고리에는 아직 이야기가 없어요.</p>}{!loading && hasMore && <button ref={loadMoreButton} className="load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "다음 이야기를 불러오는 중…" : "이야기 더 보기"}</button>}{!loading && !hasMore && posts.length > 0 && <p className="feed-end">모든 이야기를 확인했어요 🌱</p>}</section><button className="floating-write" onClick={() => go("write")}>✎ 이야기 쓰기</button></>;
}

function PostRow({ post, onClick }: { post: Post; onClick: () => void }) { return <button className="post-row" onClick={onClick}><div className="author"><span className="avatar">{post.avatar}</span><span><strong>{post.author}</strong><small>{post.career} · {post.time}</small></span></div><h3>{post.title}</h3><p>{post.preview}</p><footer><span>조회 {post.views}</span><span>🫶 {post.likes}</span><span>💬 {post.comments}</span><b>{post.wish}</b></footer></button>; }

function MaterialsScreen({ posts, categories, openMaterial, go }: { posts: Post[]; categories: PostCategory[]; openMaterial: (post: Post) => void; go: (screen: Screen) => void }) {
  const [selected, setSelected] = useState("전체");
  const workRoot = categories.find((item) => item.name === "업무 도움");
  const materialCategories = categories.filter((item) => item.parent_id === workRoot?.id).map((item) => item.name);
  const materials = posts.filter((post) => post.attachments.length > 0 && (selected === "전체" || post.category === selected));
  return <><section className="materials-hero"><div><span>VERIFIED TEACHERS ONLY</span><h2>선생님 자료실</h2><p>현장에서 만든 놀이·수업 자료를 안전하게 나눠요.</p></div><div className="material-hero-actions"><button onClick={() => go("my-materials")}>내 자료</button><button onClick={() => go("material-write")}>＋ 자료 공유</button></div></section><div className="chips">{["전체", ...materialCategories].map((item) => <button className={selected === item ? "selected" : ""} onClick={() => setSelected(item)} key={item}>{item}</button>)}</div><section className="material-list">{materials.map((post) => <button className="material-card" onClick={() => openMaterial(post)} key={post.id}><div><span className="tag">{post.category}</span><small>{post.time}</small></div><h3>{post.title}</h3><p>{post.preview}</p><footer><span>📎 자료 {post.attachments.length}개</span><span>조회 {post.views} · 🫶 {post.likes} · 💬 {post.comments}</span></footer></button>)}{materials.length === 0 && <div className="empty"><span>🧸</span><strong>아직 공유된 수업자료가 없어요</strong><p>첫 번째 자료를 선생님들과 나눠보세요.</p><button className="primary" onClick={() => go("material-write")}>자료 공유하기</button></div>}</section></>;
}

function DetailScreen({ post, user, blockedIds, supabase, go, onBlocked, onChanged, onViewed, flash }: { post: Post; user: User | null; blockedIds: string[]; supabase: ReturnType<typeof createClient>; go: (screen: Screen) => void; onBlocked: (id: string) => void; onChanged: () => void; onViewed: (id: number, views: number) => void; flash: (text: string) => void }) {
  const [reply, setReply] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsVersion, setCommentsVersion] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(post.views);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reportTarget, setReportTarget] = useState<{ post_id?: number; comment_id?: number } | null>(null);
  const [reportReason, setReportReason] = useState("abuse");
  const [reportDetails, setReportDetails] = useState("");

  useEffect(() => {
    if (!post.id) return;
    let anonymousId: string | null = null;
    if (!user) {
      anonymousId = localStorage.getItem("anonymous-viewer-id");
      if (!anonymousId) { anonymousId = crypto.randomUUID(); localStorage.setItem("anonymous-viewer-id", anonymousId); }
    }
    supabase.rpc("record_post_view", { target_post_id: post.id, anonymous_id: anonymousId }).then(({ data }) => {
      if (data === null) return;
      const views = Number(data); setViewCount(views); onViewed(post.id!, views);
    });
  }, [onViewed, post.id, supabase, user]);

  useEffect(() => {
    if (!post.id) return;
    supabase.from("comments").select("id,author_id,body,created_at,profiles(nickname)").eq("post_id", post.id).eq("is_hidden", false).order("created_at").then(({ data }) => {
      if (!data) return;
      setComments(data.filter((row) => !blockedIds.includes(row.author_id)).map((row) => { const profile = row.profiles as unknown as { nickname: string } | null; return { id: row.id, authorId: row.author_id, author: profile?.nickname ?? "익명의 새싹쌤", body: row.body, time: new Date(row.created_at).toLocaleDateString("ko-KR") }; }));
    });
  }, [blockedIds, commentsVersion, post.id, supabase]);

  useEffect(() => {
    if (!post.id) return;
    Promise.all([
      supabase.from("reactions").select("id", { count: "exact", head: true }).eq("post_id", post.id).eq("kind", "comfort"),
      user ? supabase.from("reactions").select("id").eq("post_id", post.id).eq("user_id", user.id).eq("kind", "comfort").maybeSingle() : Promise.resolve({ data: null }),
      user ? supabase.from("bookmarks").select("post_id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    ]).then(([countResult, reactionResult, bookmarkResult]) => { setLikeCount(countResult.count ?? 0); setLiked(Boolean(reactionResult.data)); setSaved(Boolean(bookmarkResult.data)); });
  }, [post.id, supabase, user]);

  useEffect(() => {
    Promise.all(post.attachments.map(async (attachment) => ({ ...attachment, url: (await supabase.storage.from("post-attachments").createSignedUrl(attachment.storage_path, 3600)).data?.signedUrl }))).then(setAttachments);
  }, [post.attachments, supabase]);

  useEffect(() => {
    const recordDownload = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a.resource-file");
      const attachment = link && attachments.find((item) => item.url === link.href);
      if (attachment) void supabase.rpc("record_material_download", { target_id: attachment.id });
    };
    document.addEventListener("click", recordDownload);
    return () => document.removeEventListener("click", recordDownload);
  }, [attachments, supabase]);

  const toggleLike = async () => {
    if (!user) { flash("로그인 후 공감할 수 있어요"); return go("login"); }
    if (!post.id) return flash("예시 글에는 공감할 수 없어요");
    const { error } = liked ? await supabase.from("reactions").delete().eq("post_id", post.id).eq("user_id", user.id).eq("kind", "comfort") : await supabase.from("reactions").insert({ post_id: post.id, user_id: user.id, kind: "comfort" });
    if (error) return flash("공감 상태를 변경하지 못했어요");
    setLiked(!liked); setLikeCount((count) => count + (liked ? -1 : 1));
  };

  const toggleSaved = async () => {
    if (!user) { flash("로그인 후 저장할 수 있어요"); return go("login"); }
    if (!post.id) return flash("예시 글은 저장할 수 없어요");
    const { error } = saved ? await supabase.from("bookmarks").delete().eq("post_id", post.id).eq("user_id", user.id) : await supabase.from("bookmarks").insert({ post_id: post.id, user_id: user.id });
    if (error) return flash("저장 상태를 변경하지 못했어요");
    setSaved(!saved); flash(saved ? "저장을 취소했어요" : "글을 저장했어요 🌱");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) return flash("답변을 작성해 주세요");
    if (!user) { flash("로그인 후 답변을 작성할 수 있어요"); return go("login"); }
    if (!post.id) return flash("예시 글에는 답변을 등록할 수 없어요");
    const { error } = await supabase.from("comments").insert({ post_id: post.id, author_id: user.id, body: reply.trim() });
    if (error) return flash("답변을 등록하지 못했어요");
    setReply(""); setCommentsVersion((value) => value + 1); flash("답변이 등록되었어요 🌱");
  };

  const editPost = async () => {
    if (!post.id || post.authorId !== user?.id) return;
    const title = window.prompt("글 제목을 수정해 주세요", post.title)?.trim();
    if (!title) return;
    const body = window.prompt("글 내용을 수정해 주세요", post.body)?.trim();
    if (!body) return;
    const { error } = await supabase.from("posts").update({ title, body }).eq("id", post.id);
    if (error) return flash("글을 수정하지 못했어요");
    Object.assign(post, { title, body, preview: body.slice(0, 100) }); onChanged(); flash("글을 수정했어요 🌱");
  };

  const deletePost = async () => {
    if (!post.id || post.authorId !== user?.id || !window.confirm("이 글과 댓글을 모두 삭제할까요?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) return flash("글을 삭제하지 못했어요");
    if (post.attachments.length) await supabase.storage.from("post-attachments").remove(post.attachments.map((attachment) => attachment.storage_path));
    onChanged(); flash("글을 삭제했어요"); go(post.attachments.length ? "materials" : "list");
  };

  const editComment = async (comment: Comment) => {
    if (comment.authorId !== user?.id) return;
    const body = window.prompt("답변을 수정해 주세요", comment.body)?.trim();
    if (!body) return;
    const { error } = await supabase.from("comments").update({ body }).eq("id", comment.id);
    if (error) return flash("답변을 수정하지 못했어요");
    setCommentsVersion((value) => value + 1); flash("답변을 수정했어요 🌱");
  };

  const deleteComment = async (comment: Comment) => {
    if (comment.authorId !== user?.id || !window.confirm("이 답변을 삭제할까요?")) return;
    const { error } = await supabase.from("comments").delete().eq("id", comment.id);
    if (error) return flash("답변을 삭제하지 못했어요");
    setCommentsVersion((value) => value + 1); flash("답변을 삭제했어요");
  };

  const openReport = (target: { post_id?: number; comment_id?: number }) => {
    if (!user) { flash("로그인 후 신고할 수 있어요"); return go("login"); }
    setReportTarget(target); setReportReason("abuse"); setReportDetails("");
  };
  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !reportTarget) return;
    const { error } = await supabase.from("reports").insert({ reporter_id: user.id, reason: reportReason, details: reportDetails.trim() || null, ...reportTarget });
    if (error?.code === "23505") { setReportTarget(null); return flash("이미 신고한 내용이에요"); }
    if (error) return flash("신고를 접수하지 못했어요");
    setReportTarget(null); flash("신고가 접수됐어요. 확인 후 조치할게요");
  };

  const blockUser = async (authorId?: string, leavePost = false) => {
    if (!user) { flash("로그인 후 차단할 수 있어요"); return go("login"); }
    if (!authorId || authorId === user.id || !window.confirm("이 사용자를 차단하고 작성한 글과 답변을 모두 숨길까요?")) return;
    const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: authorId });
    if (error?.code === "23505") return flash("이미 차단한 사용자예요");
    if (error) return flash("사용자를 차단하지 못했어요");
    onBlocked(authorId); flash("사용자를 차단했어요. 내 정보에서 해제할 수 있어요"); if (leavePost) go("list");
  };

  return <article className="detail"><span className="tag">🌱 {post.category}</span><div className="author"><span className="avatar">{post.avatar}</span><span><strong>{post.author}</strong><small>{post.career} · {post.time} · 조회 {viewCount}</small></span></div>{post.authorId === user?.id ? <div className="reaction-row"><button onClick={editPost}>글 수정</button><button onClick={deletePost}>글 삭제</button></div> : post.id && <div className="reaction-row"><button onClick={() => openReport({ post_id: post.id })}>신고</button><button onClick={() => void blockUser(post.authorId, true)}>사용자 차단</button></div>}<h2>{post.title}</h2><span className="wish">💛 {post.wish}</span><p className="body-copy">{post.body}</p>{attachments.length > 0 && <section className="post-attachments"><h3>첨부된 수업자료</h3><div className="attachment-images">{attachments.filter((item) => item.kind === "image" && item.url).map((item) => <a href={item.url} target="_blank" rel="noopener noreferrer" key={item.storage_path}><Image src={item.url!} alt={item.file_name} width={480} height={360} unoptimized/></a>)}</div>{attachments.filter((item) => item.kind === "resource" && item.url).map((item) => <a className="resource-file" href={item.url} download={item.file_name} key={item.storage_path}><span>📎</span><span><strong>{item.file_name}</strong><small>{(item.size_bytes / 1_048_576).toFixed(1)}MB · 다운로드</small></span></a>)}</section>}<div className="privacy">🛡 작성자의 이름과 소속 기관은 공개되지 않아요.</div><div className="reaction-row"><button className={liked ? "active" : ""} onClick={toggleLike}>🫶 위로해요 {post.id ? likeCount : post.likes}</button><button className={saved ? "active" : ""} onClick={toggleSaved}>▱ {saved ? "저장됨" : "저장"}</button></div><section className="comments"><h3>선생님들의 답변 {comments.length}</h3>{comments.map((comment) => <div className="comment" key={comment.id}><strong>🌱 {comment.author}</strong><p>{comment.body}</p><small>{comment.time}</small>{comment.authorId === user?.id ? <div className="reaction-row"><button onClick={() => editComment(comment)}>수정</button><button onClick={() => deleteComment(comment)}>삭제</button></div> : <div className="reaction-row"><button onClick={() => openReport({ comment_id: comment.id })}>신고</button><button onClick={() => void blockUser(comment.authorId)}>차단</button></div>}</div>)}{post.id && comments.length === 0 && <div className="empty"><span>🌱</span><strong>첫 답변을 기다리고 있어요</strong></div>}</section><form className="composer" onSubmit={submit}><input value={reply} maxLength={1000} onChange={(event) => setReply(event.target.value)} placeholder="따뜻한 답변을 남겨주세요"/><button aria-label="답변 등록">➤</button></form>{reportTarget && <div className="modal-backdrop" role="presentation" onMouseDown={() => setReportTarget(null)}><form className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={submitReport} onMouseDown={(event) => event.stopPropagation()}><h2 id="report-title">신고 사유를 알려주세요</h2><p>신고 내용은 작성자에게 공개되지 않아요.</p><label>신고 사유<select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="privacy">개인정보 노출</option><option value="abuse">욕설·괴롭힘</option><option value="spam">광고·도배</option><option value="false_information">허위정보</option><option value="other">기타</option></select></label><label>상세 내용 (선택)<textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={500} placeholder="관리자가 확인할 내용을 적어주세요"/></label><small>{reportDetails.length} / 500</small><div><button type="button" onClick={() => setReportTarget(null)}>취소</button><button className="primary">신고 접수</button></div></form></div>}</article>;
}

function WriteScreen({ user, categories, supabase, onCreated, flash, go }: { user: User | null; categories: PostCategory[]; supabase: ReturnType<typeof createClient>; onCreated: () => void; flash: (text: string) => void; go: (screen: Screen) => void }) {
  const [selected, setSelected] = useState(""); const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [wish, setWish] = useState(""); const [submitting, setSubmitting] = useState(false);
  const storyRoot = categories.find((item) => item.name === "선생님 이야기");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) { flash("로그인 후 이야기를 작성할 수 있어요"); return go("login"); }
    if (submitting) return; setSubmitting(true);
    const wishes: Record<string, string> = { "💛 공감과 위로": "comfort", "🌿 비슷한 경험": "experience", "💡 현실적인 조언": "advice", "📎 자료 추천": "resources" };
    const { error } = await supabase.from("posts").insert({ author_id: user.id, category_id: Number(selected), title, body, response_wish: wishes[wish] ?? null });
    setSubmitting(false); if (error) return flash("등록하지 못했어요. 입력 내용을 확인해 주세요.");
    onCreated(); flash("이야기가 등록되었어요 🌱"); go("list");
  };
  return <form className="write-form" onSubmit={submit}><label>어디에 이야기할까요? *</label><select value={selected} onChange={(event) => setSelected(event.target.value)} required><option value="">카테고리를 선택해 주세요</option>{categories.filter((item) => item.parent_id === storyRoot?.id).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><input className="title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="어떤 고민이 있나요?" maxLength={60} required/><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="상황을 자세히 들려주면 더 따뜻하고 정확한 답변을 받을 수 있어요.&#10;&#10;기관명, 실명 등 나를 특정할 수 있는 정보는 적지 말아주세요." maxLength={2000} required/><small className="count">{body.length.toLocaleString()} / 2,000</small><label>어떤 답변을 원하세요?</label><div className="choice-grid">{["💛 공감과 위로", "🌿 비슷한 경험", "💡 현실적인 조언", "📎 자료 추천"].map((item) => <button type="button" className={wish === item ? "selected" : ""} onClick={() => setWish(item)} key={item}>{item}</button>)}</div><div className="privacy">🛡 <span><strong>익명의 새싹쌤으로 작성돼요</strong><br/>이름과 소속 기관은 공개되지 않습니다.</span></div><button className="primary" disabled={!selected || !title || !body || submitting}>{submitting ? "등록하는 중…" : "이야기 등록하기"}</button></form>;
}

function MaterialWriteScreen({ user, categories, supabase, onCreated, flash, go }: { user: User | null; categories: PostCategory[]; supabase: ReturnType<typeof createClient>; onCreated: () => void; flash: (text: string) => void; go: (screen: Screen) => void }) {
  const [selected, setSelected] = useState(""); const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [resource, setResource] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const workRoot = categories.find((item) => item.name === "업무 도움");
  const chooseImages = (files: FileList | null) => {
    const next = Array.from(files ?? []);
    if (next.length > 5) return flash("이미지는 최대 5장까지 올릴 수 있어요");
    if (next.some((file) => file.size > 10_485_760 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))) return flash("10MB 이하 JPG, PNG, WebP, GIF 이미지만 올릴 수 있어요");
    setImages(next);
  };
  const chooseResource = (file?: File) => {
    if (!file) return setResource(null);
    if (file.size > 10_485_760 || !/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|hwp)$/i.test(file.name)) return flash("10MB 이하 PDF, 워드, PPT, 엑셀, 한글 파일만 올릴 수 있어요");
    setResource(file);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) { flash("로그인 후 자료를 공유할 수 있어요"); return go("login"); }
    if (!images.length && !resource) return flash("공유할 이미지나 자료 파일을 첨부해 주세요");
    if (submitting) return;
    setSubmitting(true);
    const { data: profile } = await supabase.from("profiles").select("is_verified").eq("id", user.id).single();
    if (!profile?.is_verified) { setSubmitting(false); flash("교사 인증을 완료한 선생님만 수업자료를 공유할 수 있어요"); return go("verification"); }
    const { data: post, error } = await supabase.from("posts").insert({ author_id: user.id, category_id: Number(selected), title, body, response_wish: "resources" }).select("id").single();
    if (error || !post) { setSubmitting(false); return flash("등록하지 못했어요. 입력 내용을 확인해 주세요."); }
    const files = [...images.map((file) => ({ file, kind: "image" as const })), ...(resource ? [{ file: resource, kind: "resource" as const }] : [])];
    const uploaded: string[] = [];
    const rows: Array<{ post_id: number; uploader_id: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; kind: "image" | "resource" }> = [];
    for (const { file, kind } of files) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const mimeType = file.type || (extension === "hwp" ? "application/x-hwp" : "application/octet-stream");
      const path = `${user.id}/${post.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("post-attachments").upload(path, file, { contentType: mimeType });
      if (uploadError) {
        if (uploaded.length) await supabase.storage.from("post-attachments").remove(uploaded);
        await supabase.from("posts").delete().eq("id", post.id); setSubmitting(false); return flash("자료를 업로드하지 못했어요. 파일 형식을 확인해 주세요");
      }
      uploaded.push(path); rows.push({ post_id: post.id, uploader_id: user.id, storage_path: path, file_name: file.name, mime_type: mimeType, size_bytes: file.size, kind });
    }
    if (rows.length) {
      const { error: attachmentError } = await supabase.from("post_attachments").insert(rows);
      if (attachmentError) { await supabase.storage.from("post-attachments").remove(uploaded); await supabase.from("posts").delete().eq("id", post.id); setSubmitting(false); return flash("자료 정보를 저장하지 못했어요"); }
    }
    setSubmitting(false);
    onCreated(); flash("수업자료가 등록되었어요 🌱"); go("materials");
  };
  return <form className="write-form" onSubmit={submit}><section className="material-write-intro"><span>🧸</span><div><strong>현장에서 잘 쓴 자료를 나눠주세요</strong><p>교사 인증을 완료한 선생님만 등록할 수 있어요.</p></div></section><label>자료 분류 *</label><select value={selected} onChange={(event) => setSelected(event.target.value)} required><option value="">카테고리를 선택해 주세요</option>{categories.filter((item) => item.parent_id === workRoot?.id).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><input className="title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="자료 제목을 입력해 주세요" maxLength={60} required/><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="대상 연령, 준비물, 활용 방법을 자세히 소개해 주세요.&#10;&#10;아이·보호자·기관의 개인정보가 포함되지 않았는지 확인해 주세요." maxLength={2000} minLength={10} required/><small className="count">{body.length.toLocaleString()} / 2,000</small><section className="attachment-picker"><div><strong>수업자료 첨부 *</strong><small>이미지 최대 5장 + 자료 파일 1개 · 파일당 최대 10MB</small></div><label>🖼 이미지 선택<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => chooseImages(event.target.files)}/></label>{images.map((file, index) => <div className="picked-file" key={`${file.name}-${file.lastModified}`}><span>{file.name}</span><button type="button" onClick={() => setImages((items) => items.filter((_, itemIndex) => itemIndex !== index))}>삭제</button></div>)}<label>📎 PDF·문서 자료 선택<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.hwp" onChange={(event) => chooseResource(event.target.files?.[0])}/></label>{resource && <div className="picked-file"><span>{resource.name}</span><button type="button" onClick={() => setResource(null)}>삭제</button></div>}</section><div className="privacy">🛡 <span><strong>공유 전 개인정보를 꼭 확인해 주세요</strong><br/>아이 얼굴, 이름, 기관명, 연락처가 포함된 자료는 올릴 수 없어요.</span></div><button className="primary" disabled={!selected || !title || !body || (!images.length && !resource) || submitting}>{submitting ? "자료를 등록하는 중…" : "수업자료 등록하기"}</button></form>;
}

type ManagedAttachment = Attachment & { is_hidden: boolean; moderation_reason: string | null };
type ManagedMaterial = { id: number; title: string; body: string; category_id: number; created_at: string; is_hidden: boolean; categories: { name: string } | null; post_attachments: ManagedAttachment[]; bookmarks: Array<{ count: number }> };

function MyMaterialsScreen({ user, categories, supabase, onChanged, flash, go }: { user: User | null; categories: PostCategory[]; supabase: ReturnType<typeof createClient>; onChanged: () => void; flash: (text: string) => void; go: (screen: Screen) => void }) {
  const [materials, setMaterials] = useState<ManagedMaterial[]>([]);
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const workRoot = categories.find((item) => item.name === "업무 도움");
  const workCategories = categories.filter((item) => item.parent_id === workRoot?.id);
  useEffect(() => {
    if (!user) return;
    supabase.from("posts").select("id,title,body,category_id,created_at,is_hidden,categories(name),post_attachments(id,storage_path,file_name,mime_type,size_bytes,kind,is_hidden,moderation_reason,download_count),bookmarks(count)").eq("author_id", user.id).order("created_at", { ascending: false }).then(({ data }) => { setMaterials(((data ?? []) as unknown as ManagedMaterial[]).filter((item) => item.post_attachments.length > 0)); setReady(true); });
  }, [supabase, user, version]);
  const edit = async (material: ManagedMaterial) => {
    const title = window.prompt("자료 제목을 수정해 주세요", material.title)?.trim(); if (!title) return;
    const body = window.prompt("자료 설명을 수정해 주세요", material.body)?.trim(); if (!body) return;
    const { error } = await supabase.from("posts").update({ title, body }).eq("id", material.id);
    if (error) return flash("자료를 수정하지 못했어요"); setVersion((value) => value + 1); onChanged(); flash("자료를 수정했어요");
  };
  const changeCategory = async (material: ManagedMaterial, categoryId: number) => {
    const { error } = await supabase.from("posts").update({ category_id: categoryId }).eq("id", material.id);
    if (error) return flash("카테고리를 변경하지 못했어요"); setVersion((value) => value + 1); onChanged();
  };
  const removeAttachment = async (material: ManagedMaterial, attachment: ManagedAttachment) => {
    if (material.post_attachments.length === 1) return flash("마지막 파일은 삭제할 수 없어요. 자료 전체를 삭제해 주세요");
    if (!window.confirm(`${attachment.file_name} 파일을 삭제할까요?`)) return;
    const { error } = await supabase.from("post_attachments").delete().eq("id", attachment.id);
    if (error) return flash("파일을 삭제하지 못했어요");
    await supabase.storage.from("post-attachments").remove([attachment.storage_path]); setVersion((value) => value + 1); onChanged(); flash("파일을 삭제했어요");
  };
  const addFile = async (material: ManagedMaterial, file: File | undefined, kind: "image" | "resource") => {
    if (!user || !file) return;
    if (file.size > 10_485_760) return flash("파일은 10MB 이하만 올릴 수 있어요");
    if (kind === "image" && material.post_attachments.filter((item) => item.kind === "image").length >= 5) return flash("이미지는 최대 5장까지 등록할 수 있어요");
    if (kind === "resource" && !/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|hwp)$/i.test(file.name)) return flash("지원하는 문서 파일인지 확인해 주세요");
    const extension = file.name.split(".").pop()?.toLowerCase(); const mimeType = file.type || (extension === "hwp" ? "application/x-hwp" : "application/octet-stream");
    const path = `${user.id}/${material.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("post-attachments").upload(path, file, { contentType: mimeType }); if (uploadError) return flash("파일을 업로드하지 못했어요");
    const { error } = await supabase.from("post_attachments").insert({ post_id: material.id, uploader_id: user.id, storage_path: path, file_name: file.name, mime_type: mimeType, size_bytes: file.size, kind });
    if (error) { await supabase.storage.from("post-attachments").remove([path]); return flash("파일 정보를 저장하지 못했어요"); }
    if (kind === "resource") { const old = material.post_attachments.find((item) => item.kind === "resource"); if (old) { await supabase.from("post_attachments").delete().eq("id", old.id); await supabase.storage.from("post-attachments").remove([old.storage_path]); } }
    setVersion((value) => value + 1); onChanged(); flash(kind === "resource" ? "자료 파일을 교체했어요" : "이미지를 추가했어요");
  };
  const removeMaterial = async (material: ManagedMaterial) => {
    if (!window.confirm("이 자료와 첨부파일을 모두 삭제할까요?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", material.id); if (error) return flash("자료를 삭제하지 못했어요");
    await supabase.storage.from("post-attachments").remove(material.post_attachments.map((item) => item.storage_path)); setVersion((value) => value + 1); onChanged(); flash("자료를 삭제했어요");
  };
  if (!user) return <div className="empty"><span>🌱</span><strong>로그인 후 내 자료를 관리할 수 있어요</strong><button className="primary" onClick={() => go("login")}>로그인하기</button></div>;
  if (!ready) return <div className="empty"><span>🧸</span><strong>내 자료를 불러오고 있어요</strong></div>;
  return <section className="my-materials"><div className="materials-hero"><div><span>MY RESOURCE LIBRARY</span><h2>내가 공유한 자료 {materials.length}개</h2><p>내용과 첨부파일, 운영 상태를 관리해요.</p></div><button onClick={() => go("material-write")}>＋ 새 자료</button></div>{materials.map((material) => <article key={material.id}><header><div><span className={material.is_hidden ? "review-state rejected" : "review-state approved"}>{material.is_hidden ? "게시글 숨김" : "공개 중"}</span><small>{new Date(material.created_at).toLocaleDateString("ko-KR")}</small></div><h3>{material.title}</h3><p>{material.body}</p><select value={material.category_id} onChange={(event) => void changeCategory(material, Number(event.target.value))}>{workCategories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><div className="material-stats"><span>▱ 저장 {material.bookmarks[0]?.count ?? 0}</span><span>⇩ 다운로드 {material.post_attachments.reduce((total, item) => total + item.download_count, 0)}</span></div></header><section>{material.post_attachments.map((attachment) => <div className="managed-file" key={attachment.id}><span>{attachment.kind === "image" ? "🖼" : "📎"}</span><div><strong>{attachment.file_name}</strong><small>{(attachment.size_bytes / 1_048_576).toFixed(1)}MB · 다운로드 {attachment.download_count}회</small>{attachment.is_hidden && <b>관리자 숨김 · {attachment.moderation_reason ?? "사유 확인 중"}</b>}</div><button onClick={() => void removeAttachment(material, attachment)}>삭제</button></div>)}</section><footer><label>＋ 이미지 추가<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void addFile(material, event.target.files?.[0], "image")}/></label><label>{material.post_attachments.some((item) => item.kind === "resource") ? "↻ 문서 교체" : "＋ 문서 추가"}<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.hwp" onChange={(event) => void addFile(material, event.target.files?.[0], "resource")}/></label><button onClick={() => void edit(material)}>내용 수정</button><button className="danger-text" onClick={() => void removeMaterial(material)}>자료 삭제</button></footer></article>)}{materials.length === 0 && <div className="empty"><span>🧸</span><strong>공유한 자료가 아직 없어요</strong><button className="primary" onClick={() => go("material-write")}>첫 자료 공유하기</button></div>}</section>;
}

type SearchJob = { id: number; title: string; description: string; facility_name: string; region: string; created_at: string };
type SearchReview = { id: number; facility_name: string; region: string; body: string; rating: number; created_at: string };

function SearchScreen({ search, setSearch, supabase, openPost, openJob, openReview }: { search: string; setSearch: (value: string) => void; supabase: ReturnType<typeof createClient>; openPost: (post: Post) => void; openJob: (id: number) => void; openReview: (id: number) => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [reviews, setReviews] = useState<SearchReview[]>([]);
  const [type, setType] = useState<"all" | "community" | "materials" | "jobs" | "reviews">("all");
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [fileType, setFileType] = useState("all");
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem("recent-searches") ?? "[]"); } catch { return []; } });

  useEffect(() => {
    const term = search.trim().replace(/[%_,()]/g, " ");
    if (term.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      const pattern = `%${term}%`;
      Promise.all([
        supabase.from("posts").select("id,author_id,title,body,created_at,response_wish,view_count,categories(name),profiles!posts_author_id_fkey(nickname,career_band,teacher_started_year),reactions(count),comments(count),post_attachments(id,storage_path,file_name,mime_type,size_bytes,kind,download_count)").eq("is_hidden", false).or(`title.ilike.${pattern},body.ilike.${pattern}`).order("created_at", { ascending: false }).limit(50),
        supabase.from("jobs").select("id,title,description,facility_name,region,created_at").eq("is_published", true).or(`title.ilike.${pattern},description.ilike.${pattern},facility_name.ilike.${pattern}`).order("created_at", { ascending: false }).limit(30),
        supabase.from("workplace_reviews").select("id,facility_name,region,body,rating,created_at").eq("status", "approved").or(`facility_name.ilike.${pattern},region.ilike.${pattern},body.ilike.${pattern}`).order("created_at", { ascending: false }).limit(30),
      ]).then(([postResult, jobResult, reviewResult]) => {
        if (!active) return;
        const careers: Record<string, string> = { under_1: "1년 미만", "1_3": "1~3년 차", "4_6": "4~6년 차", "7_plus": "7년 차 이상" };
        const wishes: Record<string, string> = { comfort: "공감과 위로 💛", experience: "비슷한 경험 🌿", advice: "현실적인 조언 💡", resources: "자료 추천 📎" };
        setPosts((postResult.data ?? []).map((row) => {
          const category = row.categories as unknown as { name: string } | null; const profile = row.profiles as unknown as { nickname: string; career_band: string | null; teacher_started_year: number | null } | null;
          const reactions = row.reactions as unknown as Array<{ count: number }>; const comments = row.comments as unknown as Array<{ count: number }>; const attachments = row.post_attachments as unknown as Attachment[];
          return { id: row.id, authorId: row.author_id, category: category?.name ?? "선생님 이야기", avatar: "🌱", author: profile?.nickname ?? "익명의 새싹쌤", career: profile?.teacher_started_year ? `${currentYear - profile.teacher_started_year + 1}년 차` : careers[profile?.career_band ?? ""] ?? "경력 미입력", time: new Date(row.created_at).toLocaleDateString("ko-KR"), createdAt: row.created_at, title: row.title, preview: row.body.slice(0, 100), body: row.body, likes: reactions[0]?.count ?? 0, comments: comments[0]?.count ?? 0, views: row.view_count ?? 0, wish: wishes[row.response_wish ?? ""] ?? "이야기를 들어주세요", attachments: attachments ?? [] };
        }));
        setJobs((jobResult.data ?? []) as SearchJob[]); setReviews((reviewResult.data ?? []) as SearchReview[]); setLoading(false);
        setRecent((items) => { const next = [search.trim(), ...items.filter((item) => item !== search.trim())].slice(0, 5); localStorage.setItem("recent-searches", JSON.stringify(next)); return next; });
      });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, supabase]);

  const matchesFile = (post: Post) => fileType === "all" || post.attachments.some((item) => fileType === "image" ? item.kind === "image" : fileType === "pdf" ? item.mime_type === "application/pdf" : fileType === "hwp" ? item.file_name.toLowerCase().endsWith(".hwp") : fileType === "presentation" ? /\.(ppt|pptx)$/i.test(item.file_name) : /\.(doc|docx|xls|xlsx)$/i.test(item.file_name));
  const sortedPosts = [...posts].sort((a, b) => sort === "recent" ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : (b.views + b.likes * 2 + b.comments * 3) - (a.views + a.likes * 2 + a.comments * 3));
  const community = sortedPosts.filter((post) => post.attachments.length === 0);
  const materials = sortedPosts.filter((post) => post.attachments.length > 0 && matchesFile(post));
  const sortedReviews = [...reviews].sort((a, b) => sort === "popular" ? b.rating - a.rating : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const showCommunity = type === "all" || type === "community"; const showMaterials = type === "all" || type === "materials"; const showJobs = type === "all" || type === "jobs"; const showReviews = type === "all" || type === "reviews";
  const total = (showCommunity ? community.length : 0) + (showMaterials ? materials.length : 0) + (showJobs ? jobs.length : 0) + (showReviews ? reviews.length : 0);
  const removeRecent = (item: string) => { const next = recent.filter((value) => value !== item); setRecent(next); localStorage.setItem("recent-searches", JSON.stringify(next)); };

  return <><div className="searchbox">⌕ <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="고민, 자료, 채용, 어린이집을 검색해요"/>{search && <button onClick={() => setSearch("")}>×</button>}</div>{search.trim().length < 2 ? <section className="discovery"><h2>최근 검색어</h2>{recent.map((item) => <button key={item} onClick={() => setSearch(item)}>◷ {item}<span onClick={(event) => { event.stopPropagation(); removeRecent(item); }}>×</span></button>)}{recent.length === 0 && <p>최근 검색어가 없어요.</p>}<h2>추천 검색어</h2><div className="chips">{["평가제 준비", "여름 행사", "연차 사용", "이직 면접", "알림장 문구"].map((item) => <button onClick={() => setSearch(item)} key={item}># {item}</button>)}</div></section> : <><div className="chips search-types">{[["all","전체"],["community","커뮤니티"],["materials","자료실"],["jobs","채용"],["reviews","후기"]].map(([value,label]) => <button className={type === value ? "selected" : ""} onClick={() => setType(value as typeof type)} key={value}>{label}</button>)}</div><div className="search-options"><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recent">최신순</option><option value="popular">인기순</option></select>{(type === "all" || type === "materials") && <select value={fileType} onChange={(event) => setFileType(event.target.value)}><option value="all">모든 파일</option><option value="image">이미지</option><option value="pdf">PDF</option><option value="hwp">한글</option><option value="presentation">PPT</option><option value="document">워드·엑셀</option></select>}</div><div className="result-title"><strong>‘{search.trim()}’ 통합 검색</strong><span>{loading ? "검색 중…" : `${total}건`}</span></div><section className="unified-results">{showCommunity && community.length > 0 && <div><h2>커뮤니티 <small>{community.length}</small></h2>{community.map((post) => <PostRow key={post.id} post={post} onClick={() => openPost(post)}/>)}</div>}{showMaterials && materials.length > 0 && <div><h2>자료실 <small>{materials.length}</small></h2>{materials.map((post) => <button className="search-result-card" onClick={() => openPost(post)} key={post.id}><span>📎 {post.category}</span><strong>{post.title}</strong><p>{post.preview}</p><small>자료 {post.attachments.length}개 · 다운로드 {post.attachments.reduce((sum, item) => sum + item.download_count, 0)}회</small></button>)}</div>}{showJobs && jobs.length > 0 && <div><h2>채용정보 <small>{jobs.length}</small></h2>{jobs.map((job) => <button className="search-result-card" onClick={() => openJob(job.id)} key={job.id}><span>🏡 {job.region}</span><strong>{job.title}</strong><p>{job.facility_name} · {job.description}</p></button>)}</div>}{showReviews && sortedReviews.length > 0 && <div><h2>어린이집 후기 <small>{sortedReviews.length}</small></h2>{sortedReviews.map((review) => <button className="search-result-card" onClick={() => openReview(review.id)} key={review.id}><span>★ {review.rating} · {review.region}</span><strong>{review.facility_name}</strong><p>{review.body}</p></button>)}</div>}{!loading && total === 0 && <div className="empty"><span>🪴</span><strong>검색 결과가 없어요</strong><p>다른 단어로 검색하거나 필터를 변경해 보세요.</p></div>}</section></>}</>;
}

function CareerScreen({ tab, setTab, flash, go, user }: { tab: "jobs" | "reviews"; setTab: (tab: "jobs" | "reviews") => void; flash: (text: string) => void; go: (screen: Screen) => void; user: User | null }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [savedJobIds, setSavedJobIds] = useState<number[]>([]);
  const [region, setRegion] = useState("all");
  const [role, setRole] = useState("all");
  const [employment, setEmployment] = useState("all");
  const [reviews, setReviews] = useState<Array<{ id: number; facility_name: string; region: string; facility_type: string; worked_from: string; worked_until: string | null; peer_relationship: number; workload: number; leave_policy: number; rating: number; body: string }>>([]);
  useEffect(() => {
    if (tab === "reviews") supabase.from("workplace_reviews").select("id,facility_name,region,facility_type,worked_from,worked_until,peer_relationship,workload,leave_policy,rating,body").eq("status", "approved").order("created_at", { ascending: false }).then(({ data }) => setReviews(data ?? []));
    else supabase.from("jobs").select("id,facility_name,region,title,description,job_role,employment_type,apply_url,closes_at,created_at").eq("is_published", true).order("created_at", { ascending: false }).then(({ data }) => setJobs((data ?? []) as JobListing[]));
  }, [supabase, tab]);
  useEffect(() => { if (user) supabase.from("saved_jobs").select("job_id").eq("user_id", user.id).then(({ data }) => setSavedJobIds(data?.map((item) => item.job_id) ?? [])); }, [supabase, user]);
  const toggleSaved = async (job: JobListing) => {
    if (!user) { flash("로그인 후 관심 공고를 저장할 수 있어요"); return go("login"); }
    const saved = savedJobIds.includes(job.id);
    const { error } = saved ? await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", job.id) : await supabase.from("saved_jobs").insert({ user_id: user.id, job_id: job.id });
    if (error) return flash("저장 상태를 변경하지 못했어요");
    setSavedJobIds((ids) => saved ? ids.filter((id) => id !== job.id) : [...ids, job.id]); flash(saved ? "관심 공고에서 삭제했어요" : "관심 공고에 저장했어요 🌱");
  };
  const expired = (job: JobListing) => Boolean(job.closes_at && job.closes_at < new Date().toISOString().slice(0, 10));
  const roleLabels: Record<string, string> = { childcare_teacher: "보육교사", special_education_teacher: "특수교사", kindergarten_teacher: "유치원교사", other: "기타" };
  const employmentLabels: Record<string, string> = { permanent: "정규직", contract: "계약직", part_time: "시간제", substitute: "대체교사" };
  const visibleJobs = jobs.filter((job) => (region === "all" || job.region === region) && (role === "all" || job.job_role === role) && (employment === "all" || job.employment_type === employment));
  if (selectedJob) return <article className="job-detail"><button className="login-link" onClick={() => setSelectedJob(null)}>← 채용공고 목록</button><div className="job-detail-title"><span className="avatar">🏡</span><div><small>{selectedJob.region}</small><h2>{selectedJob.facility_name}</h2></div><button onClick={() => void toggleSaved(selectedJob)} aria-label="관심 공고 저장">{savedJobIds.includes(selectedJob.id) ? "▣" : "▱"}</button></div><span className={`job-status ${expired(selectedJob) ? "closed" : ""}`}>{expired(selectedJob) ? "마감" : "채용 중"}</span><h1>{selectedJob.title}</h1><div className="job-facts"><span><small>직군</small>{roleLabels[selectedJob.job_role] ?? selectedJob.job_role}</span><span><small>고용형태</small>{employmentLabels[selectedJob.employment_type] ?? selectedJob.employment_type}</span><span><small>마감일</small>{selectedJob.closes_at ?? "상시채용"}</span></div><section><h3>공고 내용</h3><p>{selectedJob.description}</p></section>{selectedJob.apply_url ? <a className={`job-apply ${expired(selectedJob) ? "disabled" : ""}`} href={expired(selectedJob) ? undefined : selectedJob.apply_url} target="_blank" rel="noopener noreferrer" aria-disabled={expired(selectedJob)}>{expired(selectedJob) ? "마감된 공고예요" : "지원하러 가기 ↗"}</a> : <div className="privacy">📞 <span><strong>지원 링크가 등록되지 않았어요</strong><br/>공고 내용에 안내된 연락 방법을 확인해 주세요.</span></div>}</article>;
  return <><div className="tabs"><button className={tab === "jobs" ? "active" : ""} onClick={() => setTab("jobs")}>채용정보</button><button className={tab === "reviews" ? "active" : ""} onClick={() => setTab("reviews")}>어린이집 후기</button></div><section className="page-hero"><div><h2>{tab === "jobs" ? "나에게 맞는 곳을 찾아봐요" : "근무해 본 선생님의 이야기"}</h2><p>{tab === "jobs" ? "선생님에게 중요한 조건을 비교해요." : "광고가 아닌 실제 경험을 확인해요."}</p></div><span className="small-mascot">{tab === "jobs" ? "🧭" : "🔎"}</span></section>{tab === "jobs" ? <><div className="career-filters"><select aria-label="지역" value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">전체 지역</option>{[...new Set(jobs.map((job) => job.region))].map((item) => <option key={item}>{item}</option>)}</select><select aria-label="직군" value={role} onChange={(event) => setRole(event.target.value)}><option value="all">전체 직군</option>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><select aria-label="고용형태" value={employment} onChange={(event) => setEmployment(event.target.value)}><option value="all">전체 형태</option>{Object.entries(employmentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div><section className="career-list">{visibleJobs.map((job) => <article className={`job ${expired(job) ? "expired" : ""}`} key={job.id} onClick={() => router.push(`/jobs/${job.id}`)}><div><span className="avatar">🏡</span><span><strong>{job.facility_name}</strong><small>{job.region}</small></span><button onClick={(event) => { event.stopPropagation(); void toggleSaved(job); }}>{savedJobIds.includes(job.id) ? "▣" : "▱"}</button></div><h3>{job.title}</h3><p>{job.description}</p><small>{roleLabels[job.job_role]} · {employmentLabels[job.employment_type]} · {expired(job) ? "마감" : `마감 ${job.closes_at ?? "상시"}`}</small></article>)}{visibleJobs.length === 0 && <div className="empty"><span>🪴</span><strong>조건에 맞는 공고가 없어요</strong><p>필터를 변경해 보세요.</p></div>}</section></> : <section className="career-list"><div className="privacy">🛡 인증한 선생님만 후기를 작성할 수 있어요. 작성자 정보는 공개하지 않습니다.</div>{reviews.map((review) => <article className="review" key={review.id} onClick={() => router.push(`/reviews/${review.id}`)}><h3>{review.region} · {review.facility_name} <i>✓ 근무 인증</i><span>★ {review.rating}</span></h3><small>{review.facility_type} · {review.worked_from}~{review.worked_until ?? "현재"}</small><div><b>동료 관계<strong>{review.peer_relationship}/5</strong></b><b>업무 강도<strong>{review.workload}/5</strong></b><b>휴게·연차<strong>{review.leave_policy}/5</strong></b></div><p>{review.body}</p></article>)}{reviews.length === 0 && <div className="empty"><span>🌱</span><strong>승인된 후기가 아직 없어요</strong><p>첫 번째 경험을 기다리고 있어요.</p></div>}</section>}<button className="floating-write" onClick={() => tab === "reviews" ? go("review-write") : router.push("/recruiter")}>✎ {tab === "reviews" ? "후기 쓰기" : "원장님 공고 등록"}</button></>;
}

function ReviewWriteScreen({ user, supabase, go, flash }: { user: User | null; supabase: ReturnType<typeof createClient>; go: (screen: Screen) => void; flash: (text: string) => void }) {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("is_verified").eq("id", user.id).single().then(({ data }) => setVerified(Boolean(data?.is_verified)));
  }, [supabase, user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !verified || saving) return;
    const form = new FormData(event.currentTarget);
    const workedFrom = String(form.get("worked_from"));
    const workedUntil = String(form.get("worked_until"));
    if (workedUntil && workedUntil < workedFrom) return flash("퇴사월은 입사월보다 빠를 수 없어요");
    setSaving(true);
    const { error } = await supabase.from("workplace_reviews").insert({
      author_id: user.id,
      facility_name: form.get("facility_name"),
      region: form.get("region"),
      facility_type: form.get("facility_type"),
      worked_from: `${workedFrom}-01`,
      worked_until: workedUntil ? `${workedUntil}-01` : null,
      peer_relationship: Number(form.get("peer_relationship")),
      workload: Number(form.get("workload")),
      leave_policy: Number(form.get("leave_policy")),
      rating: Number(form.get("rating")),
      body: body.trim(),
    });
    setSaving(false);
    if (error) return flash("후기를 등록하지 못했어요");
    flash("후기가 심사 대기 상태로 등록됐어요 🌱"); go("career");
  };

  if (!user) return <div className="empty"><span>🌱</span><strong>로그인 후 후기를 작성할 수 있어요</strong><button className="primary" onClick={() => go("login")}>로그인하기</button></div>;
  if (verified === null) return <div className="empty"><span>🌱</span><strong>인증 정보를 확인하고 있어요</strong></div>;
  if (!verified) return <div className="empty"><span>🪪</span><strong>인증된 선생님만 후기를 작성할 수 있어요</strong><p>경력증명서를 제출하고 인증을 완료해 주세요.</p><button className="primary" onClick={() => go("verification")}>선생님 인증하기</button></div>;
  const scores = [1, 2, 3, 4, 5];
  return <><section className="page-hero"><div><h2>근무 경험을 들려주세요</h2><p>작성자 정보는 공개되지 않으며, 관리자 확인 후 게시돼요.</p></div><span className="small-mascot">🏡</span></section><form className="write-form review-form" onSubmit={submit}><label>어린이집 이름 *</label><input name="facility_name" required minLength={2} maxLength={100} placeholder="근무했던 어린이집 이름"/><label>지역 *</label><input name="region" required minLength={2} maxLength={100} placeholder="예: 서울 마포구"/><label>시설 유형 *</label><select name="facility_type" required defaultValue=""><option value="" disabled>시설 유형을 선택해 주세요</option><option>국공립</option><option>민간</option><option>가정</option><option>직장</option><option>법인·단체</option><option>기타</option></select><div className="form-columns"><label>입사월 *<input name="worked_from" type="month" required/></label><label>퇴사월<input name="worked_until" type="month"/></label></div><p className="form-help">재직 중이라면 퇴사월은 비워 주세요.</p>{[["동료 관계", "peer_relationship"], ["업무 환경", "workload"], ["휴게·연차", "leave_policy"], ["종합 평점", "rating"]].map(([label, name]) => <label key={name}>{label} *<select name={name} defaultValue="5" required>{scores.map((score) => <option value={score} key={score}>{"★".repeat(score)} ({score}점)</option>)}</select></label>)}<label>상세 후기 *</label><textarea value={body} onChange={(event) => setBody(event.target.value)} required minLength={20} maxLength={1500} placeholder="근무 분위기, 업무량, 휴게와 연차 사용 경험 등을 구체적으로 알려주세요. 개인을 특정할 수 있는 이름은 작성하지 말아 주세요."/><small className="count">{body.length.toLocaleString()} / 1,500</small><div className="privacy">🛡 <span><strong>익명으로 안전하게 등록돼요</strong><br/>관리자 심사 후 다른 선생님들에게 공개됩니다.</span></div><button className="primary" disabled={saving || body.trim().length < 20}>{saving ? "등록 중..." : "후기 등록하기"}</button></form></>;
}

function MyReviewsScreen({ user, supabase, go, flash }: { user: User | null; supabase: ReturnType<typeof createClient>; go: (screen: Screen) => void; flash: (text: string) => void }) {
  const [reviews, setReviews] = useState<MyWorkplaceReview[]>([]);
  const [editing, setEditing] = useState<MyWorkplaceReview | null>(null);
  const [body, setBody] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("workplace_reviews").select("id,facility_name,region,facility_type,worked_from,worked_until,peer_relationship,workload,leave_policy,rating,body,status,rejection_reason,created_at,reviewed_at").eq("author_id", user.id).order("created_at", { ascending: false }).then(({ data }) => { setReviews((data ?? []) as MyWorkplaceReview[]); setReady(true); });
  }, [supabase, user]);

  const startEdit = (review: MyWorkplaceReview) => { setEditing(review); setBody(review.body); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remove = async (review: MyWorkplaceReview) => {
    if (!window.confirm(`${review.facility_name} 후기를 삭제할까요?`)) return;
    const { error } = await supabase.from("workplace_reviews").delete().eq("id", review.id);
    if (error) return flash("후기를 삭제하지 못했어요");
    setReviews((items) => items.filter((item) => item.id !== review.id)); flash("후기를 삭제했어요");
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || saving) return;
    const form = new FormData(event.currentTarget);
    const workedFrom = String(form.get("worked_from"));
    const workedUntil = String(form.get("worked_until"));
    if (workedUntil && workedUntil < workedFrom) return flash("퇴사월은 입사월보다 빠를 수 없어요");
    const values = { facility_name: String(form.get("facility_name")), region: String(form.get("region")), facility_type: String(form.get("facility_type")), worked_from: `${workedFrom}-01`, worked_until: workedUntil ? `${workedUntil}-01` : null, peer_relationship: Number(form.get("peer_relationship")), workload: Number(form.get("workload")), leave_policy: Number(form.get("leave_policy")), rating: Number(form.get("rating")), body: body.trim() };
    setSaving(true);
    const result = editing.status === "rejected"
      ? await supabase.rpc("resubmit_workplace_review", { review_id: editing.id, new_facility_name: values.facility_name, new_region: values.region, new_facility_type: values.facility_type, new_worked_from: values.worked_from, new_worked_until: values.worked_until, new_peer_relationship: values.peer_relationship, new_workload: values.workload, new_leave_policy: values.leave_policy, new_rating: values.rating, new_body: values.body })
      : await supabase.from("workplace_reviews").update(values).eq("id", editing.id);
    setSaving(false);
    if (result.error) return flash("후기를 수정하지 못했어요");
    setReviews((items) => items.map((item) => item.id === editing.id ? { ...item, ...values, status: "pending", rejection_reason: null, reviewed_at: null } : item)); setEditing(null); flash(editing.status === "rejected" ? "수정한 후기를 다시 심사 요청했어요 🌱" : "후기를 수정했어요");
  };

  if (!user) return <div className="empty"><span>🌱</span><strong>로그인 후 작성한 후기를 확인할 수 있어요</strong><button className="primary" onClick={() => go("login")}>로그인하기</button></div>;
  if (!ready) return <div className="empty"><span>🌱</span><strong>작성한 후기를 불러오고 있어요</strong></div>;
  if (editing) { const scores = [1, 2, 3, 4, 5]; return <><div className="verification-reason" style={{ background: editing.status === "rejected" ? undefined : "#eef9f5" }}><strong>{editing.status === "rejected" ? "반려 사유" : "심사 중인 후기를 수정해요"}</strong><p>{editing.rejection_reason ?? "저장한 내용은 현재 심사 건에 바로 반영됩니다."}</p></div><form className="write-form review-form" onSubmit={save}><label>어린이집 이름 *</label><input name="facility_name" defaultValue={editing.facility_name} required minLength={2} maxLength={100}/><label>지역 *</label><input name="region" defaultValue={editing.region} required minLength={2} maxLength={100}/><label>시설 유형 *</label><select name="facility_type" defaultValue={editing.facility_type} required>{["국공립", "민간", "가정", "직장", "법인·단체", "기타"].map((type) => <option key={type}>{type}</option>)}</select><div className="form-columns"><label>입사월 *<input name="worked_from" type="month" defaultValue={editing.worked_from.slice(0, 7)} required/></label><label>퇴사월<input name="worked_until" type="month" defaultValue={editing.worked_until?.slice(0, 7) ?? ""}/></label></div>{[["동료 관계", "peer_relationship", editing.peer_relationship], ["업무 환경", "workload", editing.workload], ["휴게·연차", "leave_policy", editing.leave_policy], ["종합 평점", "rating", editing.rating]].map(([label, name, value]) => <label key={name}>{label} *<select name={String(name)} defaultValue={value} required>{scores.map((score) => <option value={score} key={score}>{"★".repeat(score)} ({score}점)</option>)}</select></label>)}<label>상세 후기 *</label><textarea value={body} onChange={(event) => setBody(event.target.value)} required minLength={20} maxLength={1500}/><small className="count">{body.length.toLocaleString()} / 1,500</small><div className="form-actions"><button type="button" onClick={() => setEditing(null)}>취소</button><button className="primary" disabled={saving || body.trim().length < 20}>{saving ? "저장 중..." : editing.status === "rejected" ? "수정하고 재심사 요청" : "수정 저장"}</button></div></form></>; }
  const labels = { pending: "심사 중", approved: "공개", rejected: "반려" };
  return <section className="managed-reviews"><div className="page-hero"><div><h2>작성한 후기 {reviews.length}개</h2><p>심사 상태를 확인하고 후기를 관리해요.</p></div><span className="small-mascot">📝</span></div>{reviews.map((review) => <article key={review.id}><div><span className={`review-state ${review.status}`}>{labels[review.status]}</span><small>{new Date(review.reviewed_at ?? review.created_at).toLocaleDateString("ko-KR")}</small></div><h3>{review.facility_name}</h3><p>{review.region} · {review.facility_type} · ★ {review.rating}<br/>{review.body}</p>{review.rejection_reason && <div className="review-rejection"><strong>반려 사유</strong> {review.rejection_reason}</div>}<footer>{review.status !== "approved" && <button onClick={() => startEdit(review)}>{review.status === "rejected" ? "수정·재심사" : "수정"}</button>}<button onClick={() => void remove(review)}>삭제</button></footer></article>)}{reviews.length === 0 && <div className="empty"><span>🪴</span><strong>작성한 후기가 아직 없어요</strong><button className="primary" onClick={() => go("review-write")}>후기 작성하기</button></div>}</section>;
}

function SavedJobsScreen({ user, supabase, go, flash }: { user: User | null; supabase: ReturnType<typeof createClient>; go: (screen: Screen) => void; flash: (text: string) => void }) {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!user) return;
    supabase.from("saved_jobs").select("job_id,jobs(id,facility_name,region,title,description,job_role,employment_type,apply_url,closes_at,created_at)").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => { setJobs((data ?? []).map((row) => row.jobs as unknown as JobListing).filter(Boolean)); setReady(true); });
  }, [supabase, user]);
  const remove = async (job: JobListing) => {
    if (!user) return;
    const { error } = await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", job.id);
    if (error) return flash("관심 공고에서 삭제하지 못했어요");
    setJobs((items) => items.filter((item) => item.id !== job.id)); flash("관심 공고에서 삭제했어요");
  };
  if (!user) return <div className="empty"><span>🌱</span><strong>로그인 후 저장한 공고를 확인할 수 있어요</strong><button className="primary" onClick={() => go("login")}>로그인하기</button></div>;
  if (!ready) return <div className="empty"><span>🌱</span><strong>저장한 공고를 불러오고 있어요</strong></div>;
  return <section className="saved-jobs"><div className="page-hero"><div><h2>관심 공고 {jobs.length}개</h2><p>저장해 둔 채용공고를 한곳에서 확인해요.</p></div><span className="small-mascot">🧭</span></div>{jobs.map((job) => { const closed = Boolean(job.closes_at && job.closes_at < new Date().toISOString().slice(0, 10)); return <article key={job.id} className={closed ? "expired" : ""}><div><span className={`job-status ${closed ? "closed" : ""}`}>{closed ? "마감" : "채용 중"}</span><button onClick={() => void remove(job)}>저장 해제</button></div><small>{job.region} · {job.facility_name}</small><h3>{job.title}</h3><p>{job.description}</p>{job.apply_url && !closed && <a href={job.apply_url} target="_blank" rel="noopener noreferrer">지원하러 가기 ↗</a>}</article>; })}{jobs.length === 0 && <div className="empty"><span>🪴</span><strong>저장한 공고가 아직 없어요</strong><button className="primary" onClick={() => go("career")}>채용공고 둘러보기</button></div>}</section>;
}

function BlockedUsersScreen({ user, supabase, go, flash, onUnblocked }: { user: User | null; supabase: ReturnType<typeof createClient>; go: (screen: Screen) => void; flash: (text: string) => void; onUnblocked: (id: string) => void }) {
  const [blocked, setBlocked] = useState<Array<{ id: string; nickname: string }>>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!user) return;
    supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id).order("created_at", { ascending: false }).then(async ({ data }) => {
      const ids = data?.map((item) => item.blocked_id) ?? [];
      if (!ids.length) { setReady(true); return; }
      const { data: profiles } = await supabase.from("profiles").select("id,nickname").in("id", ids);
      const names = new Map(profiles?.map((profile) => [profile.id, profile.nickname]));
      setBlocked(ids.map((id) => ({ id, nickname: names.get(id) ?? "익명의 선생님" }))); setReady(true);
    });
  }, [supabase, user]);
  const unblock = async (id: string) => {
    if (!user || !window.confirm("이 사용자의 차단을 해제할까요?")) return;
    const { error } = await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", id);
    if (error) return flash("차단을 해제하지 못했어요");
    setBlocked((items) => items.filter((item) => item.id !== id)); onUnblocked(id); flash("차단을 해제했어요");
  };
  if (!user) return <div className="empty"><span>🌱</span><strong>로그인 후 차단 목록을 확인할 수 있어요</strong><button className="primary" onClick={() => go("login")}>로그인하기</button></div>;
  if (!ready) return <div className="empty"><span>🌱</span><strong>차단 목록을 불러오고 있어요</strong></div>;
  return <section className="blocked-users"><div className="privacy">🛡 차단한 사용자의 글과 답변은 내 화면에 표시되지 않아요.</div>{blocked.map((item) => <article key={item.id}><span className="avatar">🌱</span><div><strong>{item.nickname}</strong><small>차단된 사용자</small></div><button onClick={() => void unblock(item.id)}>차단 해제</button></article>)}{blocked.length === 0 && <div className="empty"><span>🌿</span><strong>차단한 사용자가 없어요</strong><p>서로 편안한 커뮤니티를 함께 만들어요.</p></div>}</section>;
}

function AccountSettingsScreen({ user, supabase, go, flash }: { user: User | null; supabase: ReturnType<typeof createClient>; go: (screen: Screen) => void; flash: (text: string) => void }) {
  const router = useRouter();
  const [profile, setProfile] = useState({ nickname: "", job_role: "", career_band: "", is_verified: false, teacher_started_year: null as number | null });
  const [preferences, setPreferences] = useState({ replies: true, reactions: true, verification: true, service: true });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("nickname,job_role,career_band,is_verified,teacher_started_year").eq("id", user.id).single(),
      supabase.from("notification_preferences").select("replies,reactions,verification,service").eq("user_id", user.id).maybeSingle(),
    ]).then(([profileResult, preferenceResult]) => { if (profileResult.data) setProfile({ nickname: profileResult.data.nickname, job_role: profileResult.data.job_role ?? "", career_band: profileResult.data.career_band ?? "", is_verified: profileResult.data.is_verified, teacher_started_year: profileResult.data.teacher_started_year }); if (preferenceResult.data) setPreferences(preferenceResult.data); setReady(true); });
  }, [supabase, user]);
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!user || saving) return; setSaving(true);
    const changes = profile.is_verified ? { nickname: profile.nickname } : { nickname: profile.nickname, job_role: profile.job_role, career_band: profile.career_band };
    const { error } = await supabase.from("profiles").update(changes).eq("id", user.id); setSaving(false);
    if (error) return flash("프로필을 저장하지 못했어요"); flash("프로필을 저장했어요 🌱");
  };
  const togglePreference = async (key: keyof typeof preferences) => {
    if (!user) return;
    const next = { ...preferences, [key]: !preferences[key] }; setPreferences(next);
    const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() });
    if (error) { setPreferences(preferences); return flash("알림 설정을 저장하지 못했어요"); }
    flash("알림 설정을 저장했어요");
  };
  const deleteAccount = async () => {
    const confirmation = window.prompt("회원 탈퇴 시 작성한 글, 댓글, 저장 정보가 모두 삭제되며 복구할 수 없어요. 계속하려면 ‘탈퇴합니다’를 입력해 주세요.");
    if (confirmation !== "탈퇴합니다") return;
    const { error } = await supabase.rpc("delete_my_account");
    if (error) return flash("회원 탈퇴를 처리하지 못했어요");
    await supabase.auth.signOut(); window.alert("회원 탈퇴가 완료되었어요."); router.replace("/"); router.refresh();
  };
  if (!user) return <div className="empty"><span>🌱</span><strong>로그인 후 계정 설정을 변경할 수 있어요</strong><button className="primary" onClick={() => go("login")}>로그인하기</button></div>;
  if (!ready) return <div className="empty"><span>🌱</span><strong>계정 설정을 불러오고 있어요</strong></div>;
  const notificationRows: Array<[keyof typeof preferences, string, string]> = [["replies", "새 답변", "내 글에 달린 댓글"], ["reactions", "공감", "내 글에 도착한 공감"], ["verification", "인증 결과", "교사 인증 승인·반려"], ["service", "서비스 소식", "문의 답변·후기 심사 결과"]];
  return <section className="account-settings"><form onSubmit={saveProfile}><h2>프로필</h2><label>익명 닉네임<input value={profile.nickname} onChange={(event) => setProfile({ ...profile, nickname: event.target.value })} required minLength={2} maxLength={20}/></label><label>직군<select value={profile.job_role} onChange={(event) => setProfile({ ...profile, job_role: event.target.value })} required disabled={profile.is_verified}><option value="" disabled>직군 선택</option><option value="childcare_teacher">보육교사</option><option value="special_education_teacher">특수교사</option><option value="kindergarten_teacher">유치원교사</option><option value="other">기타</option></select></label><label>경력<select value={profile.career_band} onChange={(event) => setProfile({ ...profile, career_band: event.target.value })} required disabled={profile.is_verified}><option value="" disabled>경력 선택</option><option value="under_1">1년 미만</option><option value="1_3">1~3년</option><option value="4_6">4~6년</option><option value="7_plus">7년 이상</option></select></label>{profile.is_verified && <div className="privacy">✓ <span><strong>{profile.teacher_started_year ? `${profile.teacher_started_year}년 시작 · 현재 ${currentYear - profile.teacher_started_year + 1}년 차` : "인증된 경력 정보"}</strong><br/>인증된 직군과 경력은 관리자 확인을 통해서만 변경할 수 있어요.</span></div>}<button className="primary" disabled={saving}>{saving ? "저장 중..." : "프로필 저장"}</button></form><div className="settings-group"><h2>알림 설정</h2>{notificationRows.map(([key, title, copy]) => <label className="setting-toggle" key={key}><span><strong>{title}</strong><small>{copy}</small></span><input type="checkbox" checked={preferences[key]} onChange={() => void togglePreference(key)}/><i/></label>)}</div><div className="settings-group legal"><h2>약관 및 정책</h2><details><summary>이용약관</summary><p>선생잎은 보육교사가 안전하게 경험과 정보를 나누는 커뮤니티입니다. 타인의 개인정보, 모욕·괴롭힘, 허위정보, 광고성 게시물은 제한될 수 있으며 반복 위반 시 이용이 정지될 수 있습니다.</p></details><details><summary>개인정보 처리방침</summary><p>로그인 식별정보, 서비스 이용 기록과 선택적으로 제출한 인증서류를 서비스 제공과 안전 관리 목적으로 처리합니다. 인증서류는 본인과 권한 있는 관리자만 확인할 수 있습니다.</p></details></div><div className="settings-group danger-zone"><h2>계정 관리</h2><button onClick={() => supabase.auth.signOut().then(() => window.location.reload())}>로그아웃</button><button onClick={() => void deleteAccount()}>회원 탈퇴</button><p>탈퇴하면 작성한 글과 댓글, 인증 및 저장 정보가 모두 삭제되며 복구할 수 없습니다.</p></div></section>;
}

function AlertsScreen({ user, supabase, go, onUnreadChange }: { user: User | null; supabase: ReturnType<typeof createClient>; go: (screen: Screen) => void; onUnreadChange: (count: number | ((count: number) => number)) => void }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "reply" | "reaction">("all");

  useEffect(() => {
    if (!user) return;
    supabase.from("notifications").select("id,kind,title,body,link,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setAlerts((data ?? []) as Notification[]));
    const channel = supabase.channel(`notification-list-${user.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => setAlerts((items) => [payload.new as Notification, ...items])).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, user]);

  const open = async (alert: Notification) => {
    if (!alert.read_at) {
      const readAt = new Date().toISOString();
      const { error } = await supabase.from("notifications").update({ read_at: readAt }).eq("id", alert.id);
      if (!error) { setAlerts((items) => items.map((item) => item.id === alert.id ? { ...item, read_at: readAt } : item)); onUnreadChange((count) => Math.max(0, count - 1)); }
    }
    if (alert.link?.startsWith("post:")) router.push(`/posts/${Number(alert.link.slice(5))}`);
    else if (alert.link === "inquiries") go("inquiries");
    else if (alert.link === "profile") go("profile");
    else if (alert.link === "my-reviews") go("my-reviews");
    else if (alert.link === "recruiter") router.push("/recruiter");
  };

  const readAll = async () => {
    if (!user) return;
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    if (!error) { setAlerts((items) => items.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() }))); onUnreadChange(0); }
  };

  if (!user) return <div className="empty"><span>🌱</span><strong>로그인하면 알림을 확인할 수 있어요</strong><button className="primary" onClick={() => go("login")}>로그인하기</button></div>;
  const visible = filter === "all" ? alerts : alerts.filter((alert) => alert.kind === filter);
  const icons: Record<string, string> = { reply: "💬", reaction: "🫶", verification: "🌱", system: "📢" };
  return <><div className="alert-actions"><div className="chips"><button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>전체</button><button className={filter === "reply" ? "selected" : ""} onClick={() => setFilter("reply")}>답변</button><button className={filter === "reaction" ? "selected" : ""} onClick={() => setFilter("reaction")}>공감</button></div><div className="alert-menu"><button onClick={() => go("account-settings")}>⚙ 설정</button><button onClick={readAll}>모두 읽음</button></div></div><div className="day">최근 알림</div>{visible.map((alert) => <button key={alert.id} className={`alert-row ${alert.read_at ? "" : "unread"}`} onClick={() => void open(alert)}><span>{icons[alert.kind] ?? "🌱"}</span><span><strong>{alert.title}</strong>{alert.body && <p>{alert.body}</p>}<small>{new Date(alert.created_at).toLocaleString("ko-KR")}</small></span><i/></button>)}{visible.length === 0 && <div className="empty"><span>🪴</span><strong>아직 도착한 알림이 없어요</strong><p>새 답변과 공감 소식을 이곳에서 알려드릴게요.</p></div>}</>;
}

function ProfileScreen({ user, posts, supabase, openPost, go, flash, signOut }: { user: User | null; posts: Post[]; supabase: ReturnType<typeof createClient>; openPost: (post: Post) => void; go: (screen: Screen) => void; flash: (text: string) => void; signOut: () => Promise<unknown> }) {
  const [name, setName] = useState(user?.user_metadata.name ?? user?.user_metadata.full_name ?? "익명의 새싹쌤");
  const [stats, setStats] = useState({ posts: 0, comments: 0, reactions: 0 });
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [verification, setVerification] = useState<{ verified: boolean; status: string | null; startedYear: number | null }>({ verified: false, status: null, startedYear: null });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("author_id", user.id),
      supabase.from("reactions").select("id,posts!inner(author_id)", { count: "exact", head: true }).eq("posts.author_id", user.id),
      supabase.from("bookmarks").select("post_id").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("is_verified,nickname,teacher_started_year").eq("id", user.id).single(),
      supabase.from("teacher_verification_requests").select("status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]).then(([postResult, commentResult, reactionResult, bookmarkResult, profileResult, verificationResult]) => { setStats({ posts: postResult.count ?? 0, comments: commentResult.count ?? 0, reactions: reactionResult.count ?? 0 }); setSavedIds(bookmarkResult.data?.map((item) => item.post_id) ?? []); setName(profileResult.data?.nickname ?? "익명의 새싹쌤"); setVerification({ verified: Boolean(profileResult.data?.is_verified), status: verificationResult.data?.status ?? null, startedYear: profileResult.data?.teacher_started_year ?? null }); });
  }, [supabase, user]);

  const savedPosts = savedIds.map((id) => posts.find((post) => post.id === id)).filter((post): post is Post => Boolean(post));
  const myPosts = user ? posts.filter((post) => post.authorId === user.id) : [];
  const verificationCopy = verification.verified ? ["✓ 인증된 선생님", "인증 배지와 후기 작성 권한이 활성화됐어요.", "확인"] : verification.status === "pending" ? ["인증 심사 중이에요", "관리자가 제출한 서류를 확인하고 있어요.", "진행상황"] : verification.status === "rejected" ? ["인증 서류를 다시 확인해 주세요", "반려 사유를 확인하고 다시 신청할 수 있어요.", "재신청"] : ["선생님 인증은 선택이에요", "인증 배지와 후기 작성 권한을 받을 수 있어요.", "인증하기"];
  return <><section className="profile"><div className="profile-person"><span className="mascot">🌼</span><div><h2>{user ? name : "로그인이 필요해요"}</h2><p>{user ? `선생잎 회원 · ${verification.verified ? `인증 교사 ✓${verification.startedYear ? ` · ${currentYear - verification.startedYear + 1}년 차` : ""}` : "로그인됨"}` : "로그인하면 내 활동을 안전하게 저장해요"}</p></div></div><div className="cert-card"><span>🌱</span><div><strong>{verificationCopy[0]}</strong><p>{verificationCopy[1]}</p></div><button onClick={() => user ? go("verification") : go("login")}>{verificationCopy[2]}</button></div><div className="stats"><button><strong>{stats.posts}</strong>작성한 글</button><button><strong>{stats.comments}</strong>작성한 답변</button><button><strong>{stats.reactions}</strong>받은 공감</button></div></section><section className="menu"><h3>작성한 글 관리 {myPosts.length}</h3>{myPosts.map((post) => <button key={post.id} onClick={() => openPost(post)}>{post.title}<span>수정·삭제 ›</span></button>)}{user && myPosts.length === 0 && <p>작성한 글이 아직 없어요.</p>}</section><section className="menu"><h3>커리어 관리</h3><button onClick={() => user ? go("my-reviews") : go("login")}>작성한 어린이집 후기<span>상태·수정·삭제 ›</span></button><button onClick={() => user ? go("saved-jobs") : go("login")}>저장한 채용공고<span>관심 공고 보기 ›</span></button></section><section className="menu"><h3>저장한 글 {savedPosts.length}</h3>{savedPosts.map((post) => <button key={post.id} onClick={() => openPost(post)}>{post.title}<span>›</span></button>)}{user && savedPosts.length === 0 && <p>저장한 글이 아직 없어요.</p>}</section><section className="menu"><h3>안전 및 개인정보</h3><button onClick={() => user ? go("blocked-users") : go("login")}>차단한 사용자 관리<span>›</span></button><button onClick={() => user ? go("account-settings") : go("login")}>계정 및 알림 설정<span>›</span></button></section><Menu title="고객지원" items={["♧ 공지사항", "? FAQ", "💬 문의하기"]} onSelect={(item) => item.includes("공지사항") ? go("notices") : item.includes("FAQ") ? go("faqs") : go("inquiries")}/>{user ? <button className="login-link" onClick={async () => { await signOut(); flash("로그아웃했어요"); }}>로그아웃</button> : <button className="login-link" onClick={() => go("login")}>로그인하기</button>}</>;
}

function VerificationScreen({ user, supabase, go, flash }: { user: User | null; supabase: ReturnType<typeof createClient>; go: (screen: Screen) => void; flash: (text: string) => void }) {
  const [request, setRequest] = useState<TeacherVerification | null>(null);
  const [currentVerification, setCurrentVerification] = useState<{ active: boolean; reason: string | null }>({ active: false, reason: null });
  const [ready, setReady] = useState(!user);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("teacher_verification_requests").select("id,method,status,rejection_reason,created_at,reviewed_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("profiles").select("is_verified,verification_revoke_reason").eq("id", user.id).single(),
    ]).then(([requestResult, profileResult]) => { setRequest((requestResult.data as TeacherVerification | null) ?? null); setCurrentVerification({ active: Boolean(profileResult.data?.is_verified), reason: profileResult.data?.verification_revoke_reason ?? null }); setReady(true); });
  }, [supabase, user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || submitting) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("document") as File;
    if (!file || file.size > 5242880 || !["image/jpeg", "image/png", "application/pdf"].includes(file.type)) return flash("5MB 이하 JPG, PNG, PDF 파일만 올릴 수 있어요");
    setSubmitting(true);
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("teacher-verifications").upload(path, file);
    if (uploadError) { setSubmitting(false); return flash("서류를 업로드하지 못했어요"); }
    const { error } = await supabase.from("teacher_verification_requests").insert({ user_id: user.id, method: form.get("method"), document_path: path });
    if (error) { await supabase.storage.from("teacher-verifications").remove([path]); setSubmitting(false); return flash(error.message.includes("one_pending_verification") ? "이미 심사 중인 신청이 있어요" : "인증을 신청하지 못했어요"); }
    const { data } = await supabase.from("teacher_verification_requests").select("id,method,status,rejection_reason,created_at,reviewed_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    setRequest((data as TeacherVerification | null) ?? null); setSubmitting(false); flash("인증 신청이 접수됐어요 🌱");
  };

  if (!user) return <div className="empty"><span>🌱</span><strong>로그인 후 인증을 신청할 수 있어요</strong><button className="primary" onClick={() => go("login")}>로그인하기</button></div>;
  if (!ready) return <div className="empty"><span>🌱</span><strong>인증 정보를 확인하고 있어요</strong></div>;
  if (request?.status === "approved" && currentVerification.active) return <section className="verification-status approved"><span>✓</span><h2>인증된 선생님이에요</h2><p>인증 배지가 적용되었고 어린이집 후기를 작성할 수 있어요.</p><button className="primary" onClick={() => go("profile")}>내 정보로 돌아가기</button></section>;
  if (request?.status === "pending") return <section className="verification-status"><span>🌱</span><h2>인증 서류를 확인하고 있어요</h2><p>{request.method === "certificate" ? "보육교사 자격증" : "경력증명서"} · {new Date(request.created_at).toLocaleDateString("ko-KR")} 접수<br/>심사가 끝나면 알림으로 알려드릴게요.</p><button onClick={() => go("profile")}>내 정보로 돌아가기</button></section>;
  return <><section className="page-hero"><div><h2>{request?.status === "rejected" || currentVerification.reason ? "서류를 다시 제출해 주세요" : "현직 선생님임을 인증해요"}</h2><p>인증 정보는 공개되지 않으며 심사 목적으로만 사용해요.</p></div><span className="small-mascot">🪪</span></section>{(request?.rejection_reason || currentVerification.reason) && <div className="verification-reason"><strong>{currentVerification.reason ? "인증 해제 사유" : "반려 사유"}</strong><p>{currentVerification.reason ?? request?.rejection_reason}</p></div>}<form className="write-form verification-form" onSubmit={submit}><label>인증 방법 *</label><select name="method" defaultValue="certificate" required><option value="certificate">보육교사 자격증</option><option value="employment">경력증명서</option></select><label>증빙서류 *</label><input name="document" type="file" accept="image/jpeg,image/png,application/pdf" required/><small>JPG, PNG, PDF · 최대 5MB</small><div className="privacy">🛡 <span><strong>서류는 안전하게 보관돼요</strong><br/>본인과 관리자만 확인할 수 있습니다.</span></div><button className="primary" disabled={submitting}>{submitting ? "제출 중..." : request ? "다시 인증 신청하기" : "인증 신청하기"}</button></form></>;
}

function Menu({ title, items, onSelect }: { title: string; items: string[]; onSelect?: (item: string) => void }) { return <section className="menu"><h3>{title}</h3>{items.map((item) => <button key={item} onClick={() => onSelect?.(item)}>{item}<span>›</span></button>)}</section>; }

function NoticesScreen({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.from("announcements").select("id,title,body,image_path,published_at,created_at").eq("is_published", true).order("published_at", { ascending: false }).then(async ({ data }) => {
      const rows = (data ?? []) as Notice[];
      setNotices(await Promise.all(rows.map(async (notice) => notice.image_path ? { ...notice, image_url: (await supabase.storage.from("announcement-images").createSignedUrl(notice.image_path, 300)).data?.signedUrl } : notice)));
      setReady(true);
    });
  }, [supabase]);
  if (!ready) return <div className="empty"><span>🌱</span><strong>공지사항을 불러오고 있어요</strong></div>;
  if (selected) return <article className="detail"><button className="login-link" onClick={() => setSelected(null)}>← 공지 목록</button><span className="tag">공지</span><h2>{selected.title}</h2><small>{new Date(selected.published_at ?? selected.created_at).toLocaleDateString("ko-KR")}</small>{selected.image_url && <div role="img" aria-label={`${selected.title} 첨부 이미지`} style={{ height: 280, marginTop: 18, borderRadius: 18, background: `center / cover no-repeat url(${selected.image_url})` }}/>}<p className="body-copy" style={{ whiteSpace: "pre-wrap" }}>{selected.body}</p></article>;
  return <section className="menu"><h3>선생잎 소식</h3>{notices.map((notice) => <button key={notice.id} onClick={() => setSelected(notice)}><span><strong>{notice.title}</strong><small style={{ display: "block", marginTop: 5 }}>{new Date(notice.published_at ?? notice.created_at).toLocaleDateString("ko-KR")}</small></span><span>›</span></button>)}{notices.length === 0 && <div className="empty"><span>🌱</span><strong>등록된 공지가 아직 없어요</strong></div>}</section>;
}

function FaqsScreen({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [faqs, setFaqs] = useState<UserFaq[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { supabase.from("faqs").select("id,category,question,answer").eq("is_published", true).order("sort_order").order("created_at").then(({ data }) => { setFaqs((data ?? []) as UserFaq[]); setReady(true); }); }, [supabase]);
  if (!ready) return <div className="empty"><span>🌱</span><strong>FAQ를 불러오고 있어요</strong></div>;
  return <section className="menu"><h3>자주 묻는 질문</h3>{faqs.map((faq) => <div key={faq.id}><button aria-expanded={openId === faq.id} onClick={() => setOpenId(openId === faq.id ? null : faq.id)}><span><small style={{ display: "block", marginBottom: 5, color: "#43836e" }}>{faq.category}</small><strong>Q. {faq.question}</strong></span><span>{openId === faq.id ? "⌃" : "⌄"}</span></button>{openId === faq.id && <p style={{ padding: "14px", borderRadius: 12, background: "#f7f7f3", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>A. {faq.answer}</p>}</div>)}{faqs.length === 0 && <div className="empty"><span>🌱</span><strong>등록된 FAQ가 아직 없어요</strong></div>}</section>;
}

function InquiriesScreen({ user, supabase, go, flash }: { user: User | null; supabase: ReturnType<typeof createClient>; go: (screen: Screen) => void; flash: (text: string) => void }) {
  const [inquiries, setInquiries] = useState<UserInquiry[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => { if (user) supabase.from("inquiries").select("id,title,body,status,answer,answered_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setInquiries((data ?? []) as UserInquiry[])); }, [supabase, user, version]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return go("login");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const { error } = await supabase.from("inquiries").insert({ user_id: user.id, title: form.get("title"), body: form.get("body") });
    if (error) return window.alert(error.message);
    formElement.reset();
    setVersion((value) => value + 1);
    flash("문의가 접수되었어요 🌱");
  };
  if (!user) return <div className="empty"><span>💬</span><strong>로그인 후 문의할 수 있어요</strong><button className="primary" onClick={() => go("login")}>로그인하기</button></div>;
  return <><form className="write-form" onSubmit={submit}><label>문의 제목</label><input name="title" required minLength={2} maxLength={100} placeholder="무엇이 궁금하신가요?"/><label>문의 내용</label><textarea name="body" required minLength={5} maxLength={3000} placeholder="문의 내용을 자세히 적어주세요"/><button className="primary" type="submit">문의 접수</button></form><section className="menu"><h3>내 문의 {inquiries.length}</h3>{inquiries.map((inquiry) => <article key={inquiry.id} style={{ padding: "15px 0", borderBottom: "1px solid #e7ebe7" }}><span className="tag">{inquiry.status === "pending" ? "답변 대기" : "답변 완료"}</span><h3 style={{ margin: "10px 0 6px" }}>{inquiry.title}</h3><p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{inquiry.body}</p>{inquiry.answer && <div className="privacy" style={{ marginTop: 12 }}>💬 <span><strong>선생잎 답변</strong><br/>{inquiry.answer}</span></div>}<small>{new Date(inquiry.answered_at ?? inquiry.created_at).toLocaleString("ko-KR")}</small></article>)}</section></>;
}

function OnboardingScreen({ user, supabase, onComplete }: { user: User; supabase: ReturnType<typeof createClient>; onComplete: () => void }) {
  const [jobRole, setJobRole] = useState<JobRole | null>(null);
  const [careerBand, setCareerBand] = useState<CareerBand | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (!jobRole || !careerBand) return;
    setSaving(true);
    const { error: saveError } = await supabase.from("profiles").update({ job_role: jobRole, career_band: careerBand }).eq("id", user.id);
    if (saveError) { setError("저장하지 못했어요. 잠시 후 다시 시도해 주세요."); setSaving(false); return; }
    onComplete();
  };
  const roles: [JobRole, string][] = [["childcare_teacher", "보육교사"], ["special_education_teacher", "특수교사"], ["kindergarten_teacher", "유치원교사"], ["other", "기타"]];
  const careers: [CareerBand, string][] = [["under_1", "1년 미만"], ["1_3", "1~3년 차"], ["4_6", "4~6년 차"], ["7_plus", "7년 차 이상"]];
  return <section className="onboarding"><span className="progress"><i/><i/></span><h2>선생님을<br/>조금만 알려주세요 🌼</h2><p>직군과 경력 구간만 표시되고 이름과 근무지는 공개되지 않아요.</p><label>직군</label><div className="choice-grid">{roles.map(([value, label]) => <button type="button" className={jobRole === value ? "selected" : ""} onClick={() => setJobRole(value)} key={value}>{label}</button>)}</div><label>경력</label><div className="choice-grid">{careers.map(([value, label]) => <button type="button" className={careerBand === value ? "selected" : ""} onClick={() => setCareerBand(value)} key={value}>{label}</button>)}</div>{error && <p role="alert">{error}</p>}<button className="primary" disabled={!jobRole || !careerBand || saving} onClick={save}>{saving ? "저장 중..." : "바로 시작하기"}</button></section>;
}

function LoginScreen({ supabase, flash }: { supabase: ReturnType<typeof createClient>; flash: (text: string) => void }) {
  const [loading, setLoading] = useState(false);
  const login = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) { setLoading(false); flash("로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요."); }
  };
  return <section className="login"><div><span className="login-mascot">🌱</span><h1>선생<span>잎</span></h1><p>선생님의 마음도 돌봄이 필요하니까<br/>동료들과 편하게 이야기해요</p></div><div><button disabled={loading} onClick={login}>G　{loading ? "Google로 이동 중..." : "Google로 계속하기"}</button><small>계속하면 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</small></div></section>;
}

function BottomNav({ screen, go }: { screen: Screen; go: (screen: Screen) => void }) { return <nav className="bottom-nav"><button className={screen === "home" ? "active" : ""} onClick={() => go("home")}>⌂<span>홈</span></button><button className={["list", "detail", "write"].includes(screen) ? "active" : ""} onClick={() => go("list")}>☵<span>커뮤니티</span></button><button className={["materials", "material-detail", "material-write", "my-materials"].includes(screen) ? "active" : ""} onClick={() => go("materials")}>▤<span>자료실</span></button><button className={screen === "career" ? "active" : ""} onClick={() => go("career")}>▣<span>커리어</span></button><button className={["profile", "notices", "faqs", "inquiries"].includes(screen) ? "active" : ""} onClick={() => go("profile")}>☺<span>내 정보</span></button></nav>; }

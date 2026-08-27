import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = request.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
  const verificationWebhookUrl = Deno.env.get("SLACK_VERIFICATION_WEBHOOK_URL");
  const reviewWebhookUrl = Deno.env.get("SLACK_REVIEW_WEBHOOK_URL");
  if (!authorization || !supabaseUrl || !supabaseKey) return json({ error: "Missing configuration" }, 500);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { postId, verificationRequestId, workplaceReviewId } = await request.json().catch(() => ({ postId: null, verificationRequestId: null, workplaceReviewId: null }));
  if (Number.isSafeInteger(verificationRequestId) && verificationRequestId > 0) {
    if (!verificationWebhookUrl) return json({ error: "Missing SLACK_VERIFICATION_WEBHOOK_URL" }, 500);
    const { data: verification, error } = await supabase
      .from("teacher_verification_requests")
      .select("id,user_id,method,created_at")
      .eq("id", verificationRequestId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .single();
    if (error || !verification) return json({ error: "Verification request not found" }, 404);
    const { data: profile } = await supabase.from("profiles").select("nickname,is_verified").eq("id", user.id).maybeSingle();
    const applicant = `${profile?.is_verified ? "✅" : "🧑‍🏫"} ${profile?.nickname ?? "익명의 새싹쌤"} (${user.email ?? "이메일 없음"})`;
    const slackResponse = await fetch(verificationWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[교사 인증 신청] ${applicant}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: "🪪 새 교사 인증 요청이 도착했어요" } },
          { type: "section", fields: [
            { type: "mrkdwn", text: `*신청자*\n${applicant}` },
            { type: "mrkdwn", text: `*인증 방법*\n${verification.method === "employment" ? "경력증명서" : "보육교사 자격증"}` },
            { type: "mrkdwn", text: `*신청 번호*\n#${verification.id}` },
            { type: "mrkdwn", text: `*접수 시각*\n${new Date(verification.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}` },
          ] },
          { type: "context", elements: [{ type: "mrkdwn", text: "민감한 증빙서류는 Slack에 첨부하지 않습니다. 관리자 인증 심사 화면에서 확인해 주세요." }] },
        ],
      }),
    });
    if (!slackResponse.ok) return json({ error: await slackResponse.text() }, 502);
    return json({ ok: true });
  }
  if (Number.isSafeInteger(workplaceReviewId) && workplaceReviewId > 0) {
    if (!reviewWebhookUrl) return json({ error: "Missing SLACK_REVIEW_WEBHOOK_URL" }, 500);
    const { data: review, error } = await supabase
      .from("workplace_reviews")
      .select("id,author_id,created_at")
      .eq("id", workplaceReviewId)
      .eq("author_id", user.id)
      .eq("status", "pending")
      .single();
    if (error || !review) return json({ error: "Workplace review not found" }, 404);
    const slackResponse = await fetch(reviewWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[새 어린이집 후기] 심사 대기 #${review.id}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: "🏡 새 어린이집 후기가 등록됐어요" } },
          { type: "section", fields: [
            { type: "mrkdwn", text: `*심사 번호*\n#${review.id}` },
            { type: "mrkdwn", text: `*등록 시각*\n${new Date(review.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}` },
          ] },
          { type: "context", elements: [{ type: "mrkdwn", text: "후기 상세 내용과 작성자 정보는 관리자 심사 화면에서 확인해 주세요." }] },
        ],
      }),
    });
    if (!slackResponse.ok) return json({ error: await slackResponse.text() }, 502);
    return json({ ok: true });
  }
  if (!webhookUrl) return json({ error: "Missing SLACK_WEBHOOK_URL" }, 500);
  if (!Number.isSafeInteger(postId) || postId <= 0) return json({ error: "Invalid postId" }, 400);

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id,author_id,category_id,title,body")
    .eq("id", postId)
    .eq("author_id", user.id)
    .is("deleted_at", null)
    .single();
  if (postError || !post) return json({ error: "Post not found" }, 404);

  const [{ data: profile }, { data: category }, { data: attachments }] = await Promise.all([
    supabase.from("profiles").select("nickname,is_verified").eq("id", user.id).maybeSingle(),
    supabase.from("categories").select("name").eq("id", post.category_id).maybeSingle(),
    supabase.from("post_attachments").select("storage_path,file_name,kind").eq("post_id", post.id).eq("is_hidden", false),
  ]);

  const linkedAttachments = await Promise.all((attachments ?? []).slice(0, 6).map(async (attachment) => {
    const { data } = await supabase.storage.from("post-attachments").createSignedUrl(attachment.storage_path, 60 * 60 * 24 * 7);
    return { ...attachment, url: data?.signedUrl };
  }));
  const images = linkedAttachments.filter((attachment) => attachment.kind === "image" && attachment.url).slice(0, 5);
  const files = linkedAttachments.filter((attachment) => attachment.kind !== "image" && attachment.url);
  const author = `${profile?.is_verified ? "✅" : "🚫"} ${profile?.nickname ?? "익명의 새싹쌤"} (${user.email ?? "이메일 없음"})`;
  const body = post.body.length > 2800 ? `${post.body.slice(0, 2800)}…` : post.body;
  const blocks: Record<string, unknown>[] = [
    { type: "header", text: { type: "plain_text", text: "🌱 새 콘텐츠가 등록됐어요" } },
    { type: "section", fields: [
      { type: "mrkdwn", text: `*제목*\n${post.title}` },
      { type: "mrkdwn", text: `*글쓴이*\n${author}` },
      { type: "mrkdwn", text: `*카테고리*\n${category?.name ?? "미분류"}` },
    ] },
    { type: "section", text: { type: "mrkdwn", text: `*내용*\n${body}` } },
    ...images.map((image) => ({
      type: "image",
      image_url: image.url,
      alt_text: image.file_name,
      title: { type: "plain_text", text: image.file_name.slice(0, 200) },
    })),
  ];
  if (files.length) blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: `*첨부파일*\n${files.map((file) => `<${file.url}|📎 ${file.file_name}>`).join("\n")}` },
  });

  const slackResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `[새 콘텐츠] ${post.title} - ${author}`, blocks }),
  });
  if (!slackResponse.ok) return json({ error: await slackResponse.text() }, 502);
  return json({ ok: true });
});

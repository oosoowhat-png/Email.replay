import { createServiceRoleClient } from "@/lib/supabase/server";

interface PastReply {
  readonly ai_draft: string;
  readonly sent_body: string | null;
  readonly subject: string;
  readonly star_rating: number | null;
  readonly text_feedback: string | null;
}

export async function fetchReplyHistory(
  userId: string,
  limit: number = 10
): Promise<ReadonlyArray<PastReply>> {
  const supabase = await createServiceRoleClient();

  const { data, error } = await supabase
    .from("replies")
    .select(`
      ai_draft,
      sent_body,
      emails!inner(subject),
      feedback(star_rating, text_feedback)
    `)
    .eq("user_id", userId)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching reply history:", error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const emails = row.emails as { subject: string } | null;
    const feedbackArr = row.feedback as
      | ReadonlyArray<{ star_rating: number; text_feedback: string | null }>
      | null;
    const feedback = feedbackArr?.[0] ?? null;

    return {
      ai_draft: row.ai_draft as string,
      sent_body: row.sent_body as string | null,
      subject: emails?.subject ?? "",
      star_rating: feedback?.star_rating ?? null,
      text_feedback: feedback?.text_feedback ?? null,
    };
  });
}

export function formatHistoryForPrompt(
  history: ReadonlyArray<PastReply>
): string {
  if (history.length === 0) return "";

  const sections: string[] = [];

  // Good examples: high-rated replies (4-5 stars)
  const goodReplies = history.filter(
    (r) => r.star_rating !== null && r.star_rating >= 4
  );
  if (goodReplies.length > 0) {
    const examples = goodReplies.slice(0, 3).map((r, i) => {
      const version = r.sent_body ?? r.ai_draft;
      return `Example ${i + 1} (${r.star_rating}/5 stars, subject: "${r.subject}"):\n${version}`;
    });
    sections.push(
      `EXAMPLES OF WELL-RECEIVED REPLIES (rated 4-5 stars by the user):\n${examples.join("\n\n")}`
    );
  }

  // Improvement signals: low-rated replies with feedback
  const lowRated = history.filter(
    (r) => r.star_rating !== null && r.star_rating <= 3 && r.text_feedback
  );
  if (lowRated.length > 0) {
    const warnings = lowRated.slice(0, 3).map((r, i) => {
      return `Issue ${i + 1} (${r.star_rating}/5 stars, subject: "${r.subject}"):\nFeedback: ${r.text_feedback}`;
    });
    sections.push(
      `USER FEEDBACK ON PAST REPLIES (avoid these issues):\n${warnings.join("\n\n")}`
    );
  }

  // Edit patterns: where the user changed the AI draft before sending
  const editedReplies = history.filter(
    (r) => r.sent_body !== null && r.sent_body !== r.ai_draft
  );
  if (editedReplies.length > 0) {
    const edits = editedReplies.slice(0, 3).map((r, i) => {
      return `Edit ${i + 1} (subject: "${r.subject}"):\nAI drafted: ${truncate(r.ai_draft, 200)}\nUser sent instead: ${truncate(r.sent_body!, 200)}`;
    });
    sections.push(
      `USER EDIT PATTERNS (the user modified these AI drafts before sending — learn from their preferred style):\n${edits.join("\n\n")}`
    );
  }

  if (sections.length === 0) return "";

  return `\nPAST REPLY HISTORY AND FEEDBACK:\n${sections.join("\n\n---\n\n")}`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

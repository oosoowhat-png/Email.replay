import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { replyId, starRating, textFeedback } = body as {
      replyId: string;
      starRating: number;
      textFeedback?: string;
    };

    if (!replyId || !starRating || starRating < 1 || starRating > 5) {
      return NextResponse.json(
        { error: "replyId and starRating (1-5) are required" },
        { status: 400 }
      );
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await serviceClient.from("feedback").insert({
      reply_id: replyId,
      user_id: session.user.id,
      star_rating: starRating,
      text_feedback: textFeedback ?? null,
    }).select("id").single();

    if (error) {
      console.error("Error storing feedback:", error);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }

    return NextResponse.json({ success: true, feedbackId: data.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save feedback";
    console.error("Feedback error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

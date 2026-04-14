import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateReply } from "@/lib/ai";

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
    const { emailBody, emailSubject } = body as {
      emailBody: string;
      emailSubject?: string;
    };

    if (!emailBody) {
      return NextResponse.json(
        { error: "emailBody is required" },
        { status: 400 }
      );
    }

    const result = await generateReply(
      emailBody,
      emailSubject ?? "",
      session.user.id
    );

    return NextResponse.json({
      draft: result.draft,
      coursesUsed: result.coursesUsed,
      fullContext: result.fullContext,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate reply";
    console.error("Generate reply error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

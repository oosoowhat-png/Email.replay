import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchInboxEmails } from "@/lib/gmail";

export async function GET() {
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

  const providerToken = session.provider_token;
  if (!providerToken) {
    return NextResponse.json(
      { error: "No Google access token. Please re-login." },
      { status: 401 }
    );
  }

  try {
    const emails = await fetchInboxEmails(providerToken, 20);
    return NextResponse.json({ emails });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch emails";
    console.error("Gmail fetch error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

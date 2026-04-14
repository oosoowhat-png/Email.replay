import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendGmailReply } from "@/lib/gmail-send";

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

  const providerToken = session.provider_token;
  if (!providerToken) {
    return NextResponse.json(
      { error: "No Google access token. Please re-login." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const {
      gmailMessageId,
      threadId,
      fromEmail,
      fromName,
      subject,
      emailBody,
      aiDraft,
      sentBody,
    } = body as {
      gmailMessageId: string;
      threadId: string;
      fromEmail: string;
      fromName: string;
      subject: string;
      emailBody: string;
      aiDraft: string;
      sentBody: string;
    };

    if (!sentBody || !gmailMessageId) {
      return NextResponse.json(
        { error: "sentBody and gmailMessageId are required" },
        { status: 400 }
      );
    }

    // Send via Gmail
    const { sentMessageId } = await sendGmailReply(
      providerToken,
      fromEmail,
      subject,
      sentBody,
      threadId
    );

    // Store in Supabase using service role (bypasses RLS for insert)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert the email reference
    const { data: emailRecord, error: emailError } = await serviceClient
      .from("emails")
      .upsert(
        {
          user_id: session.user.id,
          gmail_message_id: gmailMessageId,
          thread_id: threadId,
          from_email: fromEmail,
          from_name: fromName ?? "",
          subject: subject ?? "",
          body: emailBody ?? "",
          received_at: new Date().toISOString(),
        },
        { onConflict: "gmail_message_id" }
      )
      .select("id")
      .single();

    if (emailError) {
      console.error("Error storing email:", emailError);
      // Email was sent successfully, so don't fail the request
      return NextResponse.json({
        success: true,
        sentMessageId,
        warning: "Email sent but failed to store in database",
      });
    }

    // Store the reply
    const { data: replyRecord, error: replyError } = await serviceClient
      .from("replies")
      .insert({
        email_id: emailRecord.id,
        user_id: session.user.id,
        ai_draft: aiDraft,
        sent_body: sentBody,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (replyError) {
      console.error("Error storing reply:", replyError);
    }

    return NextResponse.json({
      success: true,
      sentMessageId,
      emailId: emailRecord.id,
      replyId: replyRecord?.id ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send reply";
    console.error("Send reply error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

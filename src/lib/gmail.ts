import { google } from "googleapis";
import type { GmailEmail } from "@/lib/types";

function createOAuth2Client(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractHeader(
  headers: ReadonlyArray<{ name?: string | null; value?: string | null }>,
  name: string
): string {
  const header = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return header?.value ?? "";
}

function parseFromHeader(from: string): {
  readonly name: string;
  readonly email: string;
} {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, "").trim(), email: match[2] };
  }
  return { name: "", email: from };
}

function extractBody(payload: {
  readonly mimeType?: string | null;
  readonly body?: { data?: string | null } | null;
  readonly parts?: ReadonlyArray<{
    mimeType?: string | null;
    body?: { data?: string | null } | null;
    parts?: ReadonlyArray<{
      mimeType?: string | null;
      body?: { data?: string | null } | null;
    }>;
  }>;
}): string {
  // Direct body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart - prefer text/plain, fallback to text/html
  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return decodeBase64Url(textPart.body.data);
    }

    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return decodeBase64Url(htmlPart.body.data);
    }

    // Nested multipart (e.g., multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      if (part.parts) {
        const nestedText = part.parts.find(
          (p) => p.mimeType === "text/plain"
        );
        if (nestedText?.body?.data) {
          return decodeBase64Url(nestedText.body.data);
        }
        const nestedHtml = part.parts.find(
          (p) => p.mimeType === "text/html"
        );
        if (nestedHtml?.body?.data) {
          return decodeBase64Url(nestedHtml.body.data);
        }
      }
    }
  }

  return "";
}

export async function fetchInboxEmails(
  accessToken: string,
  maxResults: number = 20
): Promise<ReadonlyArray<GmailEmail>> {
  const auth = createOAuth2Client(accessToken);
  const gmail = google.gmail({ version: "v1", auth });

  // Fetch message IDs from primary inbox
  const listResponse = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    labelIds: ["INBOX"],
    q: "category:primary",
  });

  const messageIds = listResponse.data.messages ?? [];
  if (messageIds.length === 0) return [];

  // Fetch full message details in parallel
  const messages = await Promise.all(
    messageIds.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });
      return detail.data;
    })
  );

  return messages.map((msg) => {
    const headers = msg.payload?.headers ?? [];
    const from = extractHeader(headers, "From");
    const parsed = parseFromHeader(from);

    return {
      gmail_message_id: msg.id ?? "",
      thread_id: msg.threadId ?? "",
      from_email: parsed.email,
      from_name: parsed.name,
      subject: extractHeader(headers, "Subject"),
      body: extractBody(msg.payload ?? {}),
      snippet: msg.snippet ?? "",
      received_at: new Date(
        parseInt(msg.internalDate ?? "0")
      ).toISOString(),
    };
  });
}

export async function fetchEmailById(
  accessToken: string,
  messageId: string
): Promise<GmailEmail | null> {
  const auth = createOAuth2Client(accessToken);
  const gmail = google.gmail({ version: "v1", auth });

  try {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const msg = detail.data;
    const headers = msg.payload?.headers ?? [];
    const from = extractHeader(headers, "From");
    const parsed = parseFromHeader(from);

    return {
      gmail_message_id: msg.id ?? "",
      thread_id: msg.threadId ?? "",
      from_email: parsed.email,
      from_name: parsed.name,
      subject: extractHeader(headers, "Subject"),
      body: extractBody(msg.payload ?? {}),
      snippet: msg.snippet ?? "",
      received_at: new Date(
        parseInt(msg.internalDate ?? "0")
      ).toISOString(),
    };
  } catch {
    return null;
  }
}

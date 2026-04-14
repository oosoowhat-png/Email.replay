import { google } from "googleapis";

function createOAuth2Client(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}

function buildRawEmail(
  to: string,
  subject: string,
  body: string,
  threadId: string,
  messageId?: string
): string {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject.startsWith("Re:") ? subject : `Re: ${subject}`}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
  ];

  if (messageId) {
    headers.push(`In-Reply-To: ${messageId}`);
    headers.push(`References: ${messageId}`);
  }

  const rawEmail = `${headers.join("\r\n")}\r\n\r\n${body}`;
  return Buffer.from(rawEmail)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmailReply(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  threadId: string,
  messageId?: string
): Promise<{ readonly sentMessageId: string }> {
  const auth = createOAuth2Client(accessToken);
  const gmail = google.gmail({ version: "v1", auth });

  const raw = buildRawEmail(to, subject, body, threadId, messageId);

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId,
    },
  });

  return { sentMessageId: response.data.id ?? "" };
}

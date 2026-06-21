import { google } from "googleapis";

export interface GmailMessage {
  id: string
  body: string
  from: string
  subject: string
  receivedAt: string
}

export async function fetchEmailsFromSender(
  accessToken: string,
  refreshToken: string,
  senderEmail: string,
  daysBack: number = 1
): Promise<GmailMessage[]> {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );

  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth });

  const query = `from:${senderEmail} after:${daysDaysAgo(daysBack)}`;

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 50,
  });

  const messageIds = listRes.data.messages ?? [];
  if (messageIds.length === 0) return [];

  const messages: GmailMessage[] = [];

  for (const msg of messageIds.slice(0, 20)) {
    if (!msg.id) continue;

    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "full",
    });

    const headers = detail.data.payload?.headers ?? [];
    const from = headers.find((h) => h.name === "From")?.value ?? "";
    const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
    const dateHeader = headers.find((h) => h.name === "Date")?.value ?? "";

    const body = extractBody(detail.data.payload);

    messages.push({
      id: msg.id,
      body,
      from,
      subject,
      receivedAt: dateHeader,
    });
  }

  return messages;
}

function daysDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

function extractBody(
  payload: unknown
): string {
  const parts: string[] = [];

  function walk(node: any): void {
    if (node.mimeType === "text/plain" && node.body?.data) {
      const decoded = Buffer.from(node.body.data, "base64url").toString("utf-8");
      parts.push(decoded);
    }
    if (node.parts) {
      for (const part of node.parts) walk(part);
    }
  }

  walk(payload);
  return parts.join("\n");
}

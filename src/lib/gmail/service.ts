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

function extractBody(payload: unknown): string {
  let plain = "";
  let html = "";

  function walk(node: any): void {
    if (node.mimeType === "text/plain" && node.body?.data) {
      plain += decodeBase64(node.body.data) + "\n";
    }
    if (node.mimeType === "text/html" && node.body?.data) {
      html += decodeBase64(node.body.data) + "\n";
    }
    if (node.parts) {
      for (const part of node.parts) walk(part);
    }
  }

  walk(payload);

  const text = plain.trim() || htmlToText(html);
  return text.trim();
}

function decodeBase64(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&oacute;/gi, "ó")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/\s+/g, " ")
    .trim();
}

import { google } from "googleapis";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    redirect("/dashboard/config?error=google_auth_denied");
  }

  if (!code || !state) {
    redirect("/dashboard/config?error=missing_params");
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("gmail_oauth_state")?.value;

  if (!savedState || savedState !== state) {
    redirect("/dashboard/config?error=state_mismatch");
  }

  cookieStore.delete("gmail_oauth_state");

  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );

  let tokens;
  let email: string;

  try {
    const tokenRes = await oauth2.getToken(code);
    tokens = tokenRes.tokens;
    oauth2.setCredentials(tokens);

    const gmail = google.gmail({ version: "v1", auth: oauth2 });
    const profile = await gmail.users.getProfile({ userId: "me" });
    email = profile.data.emailAddress ?? "unknown@google.com";
  } catch {
    redirect("/dashboard/config?error=google_callback_failed");
  }

  if (!tokens.access_token || !tokens.refresh_token) {
    redirect("/dashboard/config?error=no_tokens");
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=session_expired");
  }

  const { error: upsertError } = await supabase.from("email_configs").upsert(
    {
      user_id: user.id,
      email_address: email,
      provider: "gmail",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
      is_active: true,
    },
    { onConflict: "user_id, provider" }
  );

  if (upsertError) {
    redirect("/dashboard/config?error=save_failed");
  }

  redirect("/dashboard/config?success=google_connected");
}

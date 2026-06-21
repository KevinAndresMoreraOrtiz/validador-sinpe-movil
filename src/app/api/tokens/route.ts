import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateApiToken, hashToken } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { name } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }

  const rawToken = generateApiToken();
  const hashed = hashToken(rawToken);

  await supabase.from("api_tokens").insert({
    user_id: user.id,
    name,
    token: hashed,
    is_active: true,
  });

  return NextResponse.json({ token: rawToken });
}

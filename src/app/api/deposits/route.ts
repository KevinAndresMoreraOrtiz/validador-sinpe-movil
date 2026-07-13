import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sinpemovil } from "@/lib/supabase/sinpemovil";
import { hashToken } from "@/lib/utils";
import { syncAndListDeposits } from "@/lib/deposits/sync";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json(
        { success: false, data: [], error: "Token requerido" },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const hashed = hashToken(token);
    const db = sinpemovil(supabase);

    const { data: tokenRecord, error: tokenError } = await db
      .from("api_tokens")
      .select("id, user_id, is_active")
      .eq("token", hashed)
      .single();

    if (tokenError || !tokenRecord || !tokenRecord.is_active) {
      return NextResponse.json(
        { success: false, data: [], error: "Token inválido o inactivo" },
        { status: 401 }
      );
    }

    await db
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    const daysBack = Number(request.nextUrl.searchParams.get("days") ?? "1");
    const result = await syncAndListDeposits(
      supabase,
      tokenRecord.user_id,
      daysBack
    );

    const status = result.success
      ? 200
      : result.error?.includes("Token")
        ? 401
        : result.error?.includes("No hay")
          ? 404
          : 200;

    return NextResponse.json(result, {
      status: result.success ? 200 : status,
    });
  } catch (error) {
    console.error("Error fetching deposits:", error);
    return NextResponse.json(
      { success: false, data: [], error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

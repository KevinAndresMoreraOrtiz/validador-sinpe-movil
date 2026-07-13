import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAndListDeposits } from "@/lib/deposits/sync";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, data: [], error: "No autorizado" },
        { status: 401 }
      );
    }

    const daysBack = Number(request.nextUrl.searchParams.get("days") ?? "1");
    // Admin client: sync escribe depósitos y actualiza last_fetched_at
    const admin = createAdminClient();
    const result = await syncAndListDeposits(admin, user.id, daysBack);

    return NextResponse.json(result, {
      status: result.success ? 200 : result.error?.includes("No hay") ? 404 : 200,
    });
  } catch (error) {
    console.error("Error fetching dashboard deposits:", error);
    return NextResponse.json(
      { success: false, data: [], error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

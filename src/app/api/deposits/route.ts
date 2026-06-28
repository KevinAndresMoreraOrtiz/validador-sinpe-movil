import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sinpemovil } from "@/lib/supabase/sinpemovil";
import { fetchEmailsFromSender } from "@/lib/gmail/service";
import { getParser } from "@/lib/parsers/registry";
import { hashToken } from "@/lib/utils";

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

    const daysBack = Number(request.nextUrl.searchParams.get("days") ?? "7");
    const safeDays = Number.isFinite(daysBack) && daysBack > 0 ? Math.min(daysBack, 30) : 7;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (safeDays - 1));
    cutoffDate.setHours(0, 0, 0, 0);

    const { data: parsers, error: parsersError } = await db
      .from("parsers")
      .select("*")
      .eq("user_id", tokenRecord.user_id)
      .eq("is_active", true);

    if (parsersError || !parsers?.length) {
      return NextResponse.json(
        { success: false, data: [], error: "No hay parsers configurados" },
        { status: 404 }
      );
    }

    const { data: emailConfig, error: configError } = await db
      .from("email_configs")
      .select("*")
      .eq("user_id", tokenRecord.user_id)
      .eq("is_active", true)
      .single();

    if (configError || !emailConfig) {
      return NextResponse.json(
        {
          success: false,
          data: [],
          error: "No hay configuración de correo activa",
        },
        { status: 404 }
      );
    }

    const parserIds = parsers.map((p) => p.id);

    for (const parserConfig of parsers) {
      const emailParser = getParser(parserConfig.parser_type);
      if (!emailParser) continue;

      const emails = await fetchEmailsFromSender(
        emailConfig.access_token,
        emailConfig.refresh_token,
        parserConfig.sender_email,
        safeDays
      );

      for (const email of emails) {
        if (!emailParser.canParse(email.body)) continue;

        const parsed = emailParser.parse(email.body);

        if (parsed.date && new Date(parsed.date) < cutoffDate) continue;

        const { data: existing } = await db
          .from("parsed_deposits")
          .select("id")
          .eq("reference_number", parsed.reference_number)
          .single();

        if (!existing) {
          await db.from("parsed_deposits").insert({
            parser_id: parserConfig.id,
            reference_number: parsed.reference_number,
            origin_number: parsed.origin_number,
            origin_name: parsed.origin_name,
            destination_number: parsed.destination_number,
            destination_name: parsed.destination_name,
            amount: parsed.amount,
            currency: parsed.currency,
            concept: parsed.concept,
            date: parsed.date,
            raw_email_text: parsed.raw_email_text,
            email_message_id: email.id,
          });
        }
      }
    }

    await db
      .from("email_configs")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("id", emailConfig.id);

    const { data: dbDeposits, error: queryError } = await db
      .from("parsed_deposits")
      .select("reference_number, origin_number, origin_name, destination_number, destination_name, amount, currency, concept, date, raw_email_text")
      .in("parser_id", parserIds)
      .gte("date", cutoffDate.toISOString())
      .order("date", { ascending: false });

    if (queryError) {
      console.error("Error querying parsed_deposits:", queryError);
      return NextResponse.json(
        { success: false, data: [], error: `Error al consultar depósitos: ${queryError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: dbDeposits ?? [],
    });
  } catch (error) {
    console.error("Error fetching deposits:", error);
    return NextResponse.json(
      { success: false, data: [], error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

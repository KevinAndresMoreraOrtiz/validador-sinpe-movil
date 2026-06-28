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

    const lastFetched = emailConfig.last_fetched_at
      ? new Date(emailConfig.last_fetched_at)
      : null;
    const sinceDate = lastFetched && lastFetched > cutoffDate ? lastFetched : cutoffDate;

    const newDeposits: any[] = [];

    for (const parserConfig of parsers) {
      const emailParser = getParser(parserConfig.parser_type);
      if (!emailParser) continue;

      const emails = await fetchEmailsFromSender(
        emailConfig.access_token,
        emailConfig.refresh_token,
        parserConfig.sender_email,
        safeDays,
        sinceDate
      );

      for (const email of emails) {
        if (!emailParser.canParse(email.body)) continue;

        const parsed = emailParser.parse(email.body);

        if (parsed.date && new Date(parsed.date) < cutoffDate) continue;

        const { data: existing, error: dupError } = await db
          .from("parsed_deposits")
          .select("id")
          .eq("reference_number", parsed.reference_number)
          .maybeSingle();

        if (dupError) {
          console.error("Error checking duplicate:", dupError, parsed.reference_number);
        }

        if (!existing && !dupError) {
          const { error: insertError } = await db.from("parsed_deposits").insert({
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

          if (insertError) {
            console.error("Error inserting deposit:", insertError, parsed.reference_number);
          }
        }

        newDeposits.push(parsed);
      }
    }

    if (newDeposits.length > 0) {
      await db
        .from("email_configs")
        .update({ last_fetched_at: new Date().toISOString() })
        .eq("id", emailConfig.id);

      console.log(`[deposits] gmail_hit=${newDeposits.length}, since=${sinceDate.toISOString()}`);

      return NextResponse.json({
        success: true,
        data: newDeposits,
      });
    }

    console.log(`[deposits] gmail_miss, checking DB, since=${sinceDate.toISOString()}, cutoff=${cutoffDate.toISOString()}`);

    const { data: dbDeposits, error: dbError } = await db
      .from("parsed_deposits")
      .select("reference_number, origin_number, origin_name, destination_number, destination_name, amount, currency, concept, date, raw_email_text")
      .in("parser_id", parserIds)
      .or(`date.is.null,date.gte.${cutoffDate.toISOString()}`)
      .order("date", { ascending: false, nullsFirst: false });

    if (dbError) {
      console.error("[deposits] DB query error:", dbError);
    }

    console.log(`[deposits] db_hit=${dbDeposits?.length ?? 0}`);

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

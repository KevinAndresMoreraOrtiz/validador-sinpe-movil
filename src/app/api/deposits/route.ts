import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sinpemovil } from "@/lib/supabase/sinpemovil";
import { fetchEmailsFromSender } from "@/lib/gmail/service";
import { findParser } from "@/lib/parsers/registry";
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

    const { data: parsers, error: parsersError } = await db
      .from("parsers")
      .select("*")
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

    const allDeposits: any[] = [];

    for (const parser of parsers) {
      const emails = await fetchEmailsFromSender(
        emailConfig.access_token,
        emailConfig.refresh_token,
        parser.sender_email
      );

      for (const email of emails) {
        const matcher = findParser(email.body);
        if (!matcher) continue;

        const parsed = matcher.parse(email.body);

        const { data: existing } = await db
          .from("parsed_deposits")
          .select("id")
          .eq("reference_number", parsed.reference_number)
          .single();

        if (!existing) {
          await db.from("parsed_deposits").insert({
            parser_id: parser.id,
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

        allDeposits.push(parsed);
      }
    }

    return NextResponse.json({
      success: true,
      data: allDeposits,
    });
  } catch (error) {
    console.error("Error fetching deposits:", error);
    return NextResponse.json(
      { success: false, data: [], error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

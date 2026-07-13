import type { SupabaseClient } from "@supabase/supabase-js";
import { sinpemovil } from "@/lib/supabase/sinpemovil";
import { fetchEmailsFromSender } from "@/lib/gmail/service";
import { getParser } from "@/lib/parsers/registry";
import { startOfCalendarDayCR } from "@/lib/utils";
import type { ParsedDeposit } from "@/types";

export interface SyncDepositsResult {
  success: boolean;
  data: ParsedDeposit[];
  error?: string;
  warning?: string;
}

export async function syncAndListDeposits(
  supabase: SupabaseClient,
  userId: string,
  daysBack: number = 1
): Promise<SyncDepositsResult> {
  const safeDays =
    Number.isFinite(daysBack) && daysBack > 0 ? Math.min(daysBack, 30) : 1;
  const cutoffDate = startOfCalendarDayCR(safeDays);
  const db = sinpemovil(supabase);

  const { data: parsers, error: parsersError } = await db
    .from("parsers")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (parsersError || !parsers?.length) {
    return {
      success: false,
      data: [],
      error: "No hay parsers configurados",
    };
  }

  const { data: emailConfig, error: configError } = await db
    .from("email_configs")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (configError || !emailConfig) {
    return {
      success: false,
      data: [],
      error: "No hay configuración de correo activa",
    };
  }

  const parserIds = parsers.map((p) => p.id);

  const { data: lastDeposit } = await db
    .from("parsed_deposits")
    .select("date")
    .in("parser_id", parserIds)
    .not("date", "is", null)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastDepositDate = lastDeposit?.date ? new Date(lastDeposit.date) : null;
  const sinceDate =
    lastDepositDate && lastDepositDate > cutoffDate
      ? lastDepositDate
      : cutoffDate;

  let gmailError: string | null = null;

  try {
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
          console.error(
            "Error checking duplicate:",
            dupError,
            parsed.reference_number
          );
          continue;
        }

        if (existing) continue;

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
          console.error(
            "Error inserting deposit:",
            insertError,
            parsed.reference_number
          );
        }
      }
    }

    await db
      .from("email_configs")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("id", emailConfig.id);
  } catch (err) {
    gmailError =
      err instanceof Error ? err.message : "Error consultando Gmail";
    console.error("Error syncing Gmail:", err);
  }

  const { data: dbDeposits, error: dbError } = await db
    .from("parsed_deposits")
    .select(
      "reference_number, origin_number, origin_name, destination_number, destination_name, amount, currency, concept, date, raw_email_text"
    )
    .in("parser_id", parserIds)
    .gte("date", cutoffDate.toISOString())
    .order("date", { ascending: false });

  if (dbError) {
    console.error("[deposits] DB query error:", dbError);
  }

  return {
    success: true,
    data: (dbDeposits as ParsedDeposit[]) ?? [],
    ...(gmailError ? { warning: `Sync Gmail falló: ${gmailError}` } : {}),
  };
}

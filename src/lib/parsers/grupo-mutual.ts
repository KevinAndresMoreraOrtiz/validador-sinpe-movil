import type { EmailParser } from "./types";
import type { ParsedDeposit } from "@/types";

export class GrupoMutualParser implements EmailParser {
  type = "grupo_mutual";

  canParse(body: string): boolean {
    const text = body
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

    return (
      text.includes("grupo mutual") &&
      text.includes("sinpe movil mutual") &&
      text.includes("transferencia")
    );
  }

  parse(body: string): ParsedDeposit {
    const originMatch = body.match(
      /el origen de la transferencia es (\d+)\s*a nombre de\s*([^.\n]+)/i
    );
    const destinationMatch = body.match(
      /el destino de la transferencia es\s*([^\s]+)\s*a nombre de\s*([^.\n]+)/i
    );
    const conceptMatch = body.match(/por concepto de\s*"([^"]*)"/i);
    const amountMatch = body.match(
      /un monto de\s*([\d,.]+)\s*(colones|dólares|dolares)/i
    );
    const dateMatch = body.match(
      /La transferencia se realizó el día\s*(\d{2}\/\d{2}\/\d{4}\s*\d{2}:\d{2}:\d{2}\s*(?:AM|PM)?)/i
    );
    const referenceMatch = body.match(
      /El número de referencia es\s*(\d+)/
    );

    const amountRaw = amountMatch?.[1]?.replace(/,/g, "") ?? null;
    const dateRaw = dateMatch?.[1] ?? null;

    const parsedDate = dateRaw ? this.parseDate(dateRaw) : null;

    return {
      reference_number: referenceMatch?.[1] ?? "unknown",
      origin_number: originMatch?.[1] ?? null,
      origin_name: originMatch?.[2]?.trim() ?? null,
      destination_number: destinationMatch?.[1] ?? null,
      destination_name: destinationMatch?.[2]?.trim() ?? null,
      amount: amountRaw ? Number.parseFloat(amountRaw) : null,
      currency: amountMatch?.[2]
        ? amountMatch[2].toLowerCase() === "dólares" ||
          amountMatch[2].toLowerCase() === "dolares"
          ? "USD"
          : "CRC"
        : "CRC",
      concept: conceptMatch?.[1] ?? null,
      date: parsedDate,
      raw_email_text: body,
    };
  }

  private parseDate(dateStr: string): string | null {
    const months: Record<string, string> = {
      "01": "01", "02": "02", "03": "03", "04": "04",
      "05": "05", "06": "06", "07": "07", "08": "08",
      "09": "09", "10": "10", "11": "11", "12": "12",
    };

    // Format: DD/MM/YYYY HH:MM:SS AM/PM
    const parts = dateStr.match(
      /(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}:\d{2}:\d{2}(?:\s*[AP]M)?)/i
    );
    if (!parts) return null;

    const [, day, month, year, time] = parts;
    if (!months[month]) return null;

    return `${year}-${month}-${day}T${this.normalizeTime(time)}`;
  }

  private normalizeTime(time: string): string {
    const trimmed = time.trim().toUpperCase();
    const match = trimmed.match(
      /^(\d{2}):(\d{2}):(\d{2})(?:\s*(AM|PM))?$/
    );
    if (!match) return trimmed;

    let [, hours, minutes, seconds, period] = match;
    let h = Number.parseInt(hours);

    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;

    return `${String(h).padStart(2, "0")}:${minutes}:${seconds}`;
  }
}

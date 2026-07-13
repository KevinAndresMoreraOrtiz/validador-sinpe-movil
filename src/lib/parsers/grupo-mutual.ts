import type { EmailParser, ParseContext } from "./types";
import type { ParsedDeposit } from "@/types";
import { CR_OFFSET_MS } from "@/lib/utils";

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

  parse(body: string, context?: ParseContext): ParsedDeposit {
    const originMatch = body.match(
      /el origen de la transferencia es\s*(\d+)\s*a nombre de\s*(.+?)\s*y el destino de la transferencia/i
    );
    const destinationMatch = body.match(
      /el destino de la transferencia es\s*(\S+)\s*a nombre de\s*(.+?)\.\s*La transferencia/i
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
    const reference = referenceMatch?.[1] ?? "unknown";

    const parsedDate = dateRaw ? this.parseDate(dateRaw) : null;

    return {
      reference_number: reference,
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
      concept: conceptMatch?.[1]?.trim() || null,
      // Fuente principal: día+hora del cuerpo. Recibo y llegada del correo
      // solo confirman si Mutual puso mal el día (nunca la llegada sola).
      date: this.reconcileDepositDate(
        parsedDate,
        reference,
        context?.receivedAt
      ),
      raw_email_text: body,
    };
  }

  /**
   * Por defecto se usa día y hora del cuerpo.
   * Solo se corrige el día si el recibo YYYYMMDD discrepa y la llegada
   * del correo lo confirma (mismo día que el recibo). Así un depósito
   * de ayer cuyo correo llega hoy se queda en ayer.
   */
  private reconcileDepositDate(
    dateIso: string | null,
    reference: string,
    receivedAt?: string | Date | null
  ): string | null {
    if (!dateIso) return dateIso;

    const bodyYmd = this.ymdFromIsoLocal(dateIso);
    if (!bodyYmd) return dateIso;

    const refYmd = this.ymdFromReference(reference);
    const receivedYmd = this.ymdFromReceivedAt(receivedAt);

    // Corrección solo con evidencia cruzada: recibo ≠ cuerpo y
    // llegada del correo coincide con el recibo.
    if (
      refYmd &&
      receivedYmd &&
      refYmd !== bodyYmd &&
      refYmd === receivedYmd
    ) {
      return this.withYmd(dateIso, refYmd);
    }

    return dateIso;
  }

  private ymdFromReference(reference: string): string | null {
    if (reference.length < 8) return null;
    const refYmd = reference.slice(0, 8);
    if (!/^\d{8}$/.test(refYmd)) return null;

    const monthNum = Number(refYmd.slice(4, 6));
    const dayNum = Number(refYmd.slice(6, 8));
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      return null;
    }
    return refYmd;
  }

  private ymdFromReceivedAt(
    receivedAt?: string | Date | null
  ): string | null {
    if (!receivedAt) return null;
    const d = receivedAt instanceof Date ? receivedAt : new Date(receivedAt);
    if (Number.isNaN(d.getTime())) return null;

    // Día calendario en Costa Rica (UTC-6).
    const cr = new Date(d.getTime() - CR_OFFSET_MS);
    const y = cr.getUTCFullYear();
    const m = String(cr.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cr.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  /** YYYYMMDD desde ISO con offset explícito (…-06:00) o Z. */
  private ymdFromIsoLocal(dateIso: string): string | null {
    const m = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return `${m[1]}${m[2]}${m[3]}`;
  }

  private withYmd(dateIso: string, ymd: string): string {
    const year = ymd.slice(0, 4);
    const month = ymd.slice(4, 6);
    const day = ymd.slice(6, 8);
    const timePart = dateIso.includes("T")
      ? dateIso.slice(11)
      : "00:00:00-06:00";
    return `${year}-${month}-${day}T${timePart}`;
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

    // Hora del correo es hora local CR (UTC-6). Sin offset, Postgres/JS
    // lo tratan como UTC y el filtro del día calendario falla.
    return `${year}-${month}-${day}T${this.normalizeTime(time)}-06:00`;
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

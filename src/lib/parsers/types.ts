import type { ParsedDeposit } from "@/types";

export interface ParseContext {
  /** Fecha/hora en que llegó el correo (Gmail internalDate / Date). */
  receivedAt?: string | Date | null;
}

export interface EmailParser {
  type: string
  canParse(body: string): boolean
  parse(body: string, context?: ParseContext): ParsedDeposit
}

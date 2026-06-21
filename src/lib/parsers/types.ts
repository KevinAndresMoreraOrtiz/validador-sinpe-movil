import type { ParsedDeposit } from "@/types";

export interface EmailParser {
  type: string
  canParse(body: string): boolean
  parse(body: string): ParsedDeposit
}

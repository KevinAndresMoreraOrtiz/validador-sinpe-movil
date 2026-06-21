import type { EmailParser } from "./types";
import { GrupoMutualParser } from "./grupo-mutual";

const parsers: Map<string, EmailParser> = new Map();

export function registerParser(parser: EmailParser): void {
  parsers.set(parser.type, parser);
}

export function getParser(type: string): EmailParser | undefined {
  return parsers.get(type);
}

export function getAllParsers(): EmailParser[] {
  return Array.from(parsers.values());
}

export function findParser(body: string): EmailParser | undefined {
  for (const parser of parsers.values()) {
    if (parser.canParse(body)) return parser;
  }
  return undefined;
}

registerParser(new GrupoMutualParser());

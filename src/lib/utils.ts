import { createHash, randomBytes } from "node:crypto";

/** Offset de America/Costa_Rica (UTC-6, sin DST). */
export const CR_OFFSET_MS = 6 * 60 * 60 * 1000;

export function generateApiToken(): string {
  return `smp_${randomBytes(32).toString("hex")}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Medianoche del día calendario en Costa Rica, restando (daysBack - 1) días.
 * daysBack=1 → inicio de hoy CR; daysBack=7 → hace 6 días a las 00:00 CR.
 */
export function startOfCalendarDayCR(daysBack: number = 1): Date {
  const safeDays =
    Number.isFinite(daysBack) && daysBack > 0 ? Math.min(daysBack, 30) : 1;
  const crNow = new Date(Date.now() - CR_OFFSET_MS);
  const start = new Date(
    Date.UTC(
      crNow.getUTCFullYear(),
      crNow.getUTCMonth(),
      crNow.getUTCDate(),
      6,
      0,
      0,
      0
    )
  );
  start.setUTCDate(start.getUTCDate() - (safeDays - 1));
  return start;
}

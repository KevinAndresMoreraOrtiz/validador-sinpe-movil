"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ParsedDeposit } from "@/types";

const DAY_OPTIONS = [
  { value: 1, label: "Hoy" },
  { value: 7, label: "7 días" },
  { value: 30, label: "30 días" },
] as const;

function formatAmount(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "CRC",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Costa_Rica",
  }).format(new Date(date));
}

export default function DepositsPage() {
  const [days, setDays] = useState(1);
  const [deposits, setDeposits] = useState<ParsedDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const loadDeposits = useCallback(async (selectedDays: number) => {
    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      const res = await fetch(`/api/dashboard/deposits?days=${selectedDays}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setDeposits([]);
        setError(json.error ?? "No se pudieron cargar los depósitos");
        return;
      }

      setDeposits(json.data ?? []);
      if (json.warning) setWarning(json.warning);
    } catch {
      setDeposits([]);
      setError("Error de red al consultar depósitos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeposits(days);
  }, [days, loadDeposits]);

  const totals = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    for (const d of deposits) {
      const cur = d.currency || "CRC";
      byCurrency[cur] = (byCurrency[cur] ?? 0) + (Number(d.amount) || 0);
    }
    return byCurrency;
  }, [deposits]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Depósitos</h2>
          <p className="text-sm text-gray-500">
            Sincroniza Gmail y muestra los depósitos del período (hora Costa Rica).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border bg-white p-1 text-sm">
            {DAY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDays(opt.value)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  days === opt.value
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => loadDeposits(days)}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {warning}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-gray-500">Cantidad</p>
          <p className="text-2xl font-semibold">{deposits.length}</p>
        </div>
        {Object.entries(totals).map(([currency, sum]) => (
          <div
            key={currency}
            className="rounded-xl border bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs text-gray-500">Total {currency}</p>
            <p className="text-2xl font-semibold">
              {formatAmount(sum, currency)}
            </p>
          </div>
        ))}
        {Object.keys(totals).length === 0 && (
          <div className="rounded-xl border bg-white px-4 py-3 shadow-sm sm:col-span-2">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-2xl font-semibold">—</p>
          </div>
        )}
      </div>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Referencia</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-4 py-3 font-medium">Destino</th>
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {loading && deposits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    Cargando depósitos…
                  </td>
                </tr>
              ) : deposits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    No hay depósitos en este período.
                  </td>
                </tr>
              ) : (
                deposits.map((d) => (
                  <tr
                    key={d.reference_number}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatDate(d.date)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {d.reference_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{d.origin_name ?? "—"}</div>
                      <div className="text-xs text-gray-500">
                        {d.origin_number ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {d.destination_name ?? "—"}
                      </div>
                      <div className="max-w-[12rem] truncate text-xs text-gray-500">
                        {d.destination_number ?? ""}
                      </div>
                    </td>
                    <td className="max-w-[10rem] truncate px-4 py-3 text-gray-600">
                      {d.concept || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                      {formatAmount(
                        d.amount != null ? Number(d.amount) : null,
                        d.currency
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

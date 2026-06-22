"use client";

import { createClient } from "@/lib/supabase/client";
import { sinpemovil } from "@/lib/supabase/sinpemovil";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface TokenRow {
  id: string
  name: string
  token: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

export default function TokensPage() {
  const supabase = createClient();
  const router = useRouter();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [newName, setNewName] = useState("");
  const [showToken, setShowToken] = useState<string | null>(null);

  useEffect(() => {
    loadTokens();
  }, []);

  async function loadTokens() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data } = await sinpemovil(supabase)
      .from("api_tokens")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setTokens(data);
  }

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const response = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });

    const result = await response.json();
    if (result.token) {
      setShowToken(result.token);
      setNewName("");
      loadTokens();
    }
  }

  async function toggleToken(id: string, current: boolean) {
    await sinpemovil(supabase)
      .from("api_tokens")
      .update({ is_active: !current })
      .eq("id", id);
    loadTokens();
  }

  async function deleteToken(id: string) {
    await sinpemovil(supabase).from("api_tokens").delete().eq("id", id);
    loadTokens();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Tus tokens API</h2>

        {tokens.length === 0 && (
          <p className="mb-4 text-sm text-gray-500">
            No has creado ningún token aún.
          </p>
        )}

        <ul className="mb-6 space-y-2">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
            >
              <div>
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-xs text-gray-400">
                  {t.is_active ? "Activo" : "Inactivo"}
                  {t.last_used_at && ` · Último uso: ${new Date(t.last_used_at).toLocaleDateString()}`}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleToken(t.id, t.is_active)}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    t.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {t.is_active ? "Activo" : "Inactivo"}
                </button>
                <button
                  onClick={() => deleteToken(t.id)}
                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={createToken} className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del token (ej: Producción)"
            required
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Crear token
          </button>
        </form>

        {showToken && (
          <div className="mt-4 rounded-lg border-2 border-yellow-400 bg-yellow-50 p-4">
            <p className="mb-2 text-sm font-medium text-yellow-800">
              Token creado. Cópialo ahora, no se mostrará de nuevo.
            </p>
            <pre className="overflow-x-auto rounded bg-yellow-100 p-3 text-xs font-mono">
              {showToken}
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(showToken);
              }}
              className="mt-2 rounded bg-yellow-600 px-3 py-1 text-xs font-medium text-white"
            >
              Copiar
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

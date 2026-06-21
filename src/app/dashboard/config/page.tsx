"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface ParserRow {
  id: string
  name: string
  sender_email: string
  parser_type: string
  is_active: boolean
}

interface EmailConfigRow {
  id: string
  email_address: string
  is_active: boolean
  token_expires_at: string | null
}

export default function ConfigPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [emailConfig, setEmailConfig] = useState<EmailConfigRow | null>(null);
  const [parsers, setParsers] = useState<ParserRow[]>([]);
  const [newName, setNewName] = useState("");
  const [newSender, setNewSender] = useState("");
  const [newType, setNewType] = useState("grupo_mutual");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get("error");
    const success = searchParams.get("success");
    if (error === "google_auth_denied") setMessage("Autorización cancelada.");
    else if (error === "state_mismatch") setMessage("Error de seguridad. Intenta de nuevo.");
    else if (error === "no_tokens") setMessage("No se obtuvieron tokens de Google.");
    else if (error === "save_failed") setMessage("Error al guardar en la base de datos.");
    else if (error === "session_expired") setMessage("Sesión expirada. Inicia sesión de nuevo.");
    else if (error === "google_callback_failed") setMessage("Error al conectar con Google. Intenta de nuevo.");
    else if (success === "google_connected") setMessage("¡Cuenta de Gmail conectada exitosamente!");
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: emailData } = await supabase
      .from("email_configs")
      .select("*")
      .single();

    if (emailData) setEmailConfig(emailData);

    const { data: parsersData } = await supabase
      .from("parsers")
      .select("*")
      .order("created_at");

    if (parsersData) setParsers(parsersData);
  }

  async function disconnectGoogle() {
    if (!emailConfig) return;
    await supabase.from("email_configs").delete().eq("id", emailConfig.id);
    setEmailConfig(null);
    setMessage("Cuenta de Gmail desconectada.");
  }

  async function addParser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("parsers").insert({
      user_id: user.id,
      name: newName,
      sender_email: newSender,
      parser_type: newType,
      is_active: true,
    });

    setNewName("");
    setNewSender("");
    setSaving(false);
    loadData();
  }

  async function toggleParser(id: string, current: boolean) {
    await supabase
      .from("parsers")
      .update({ is_active: !current })
      .eq("id", id);
    loadData();
  }

  async function deleteParser(id: string) {
    await supabase.from("parsers").delete().eq("id", id);
    loadData();
  }

  return (
    <div className="space-y-8">
      {message && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {message}
          <button
            onClick={() => setMessage(null)}
            className="ml-2 font-medium"
          >
            ✕
          </button>
        </div>
      )}

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          Acceso a Gmail
        </h2>

        {emailConfig ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-medium text-green-800">
                  Conectado como {emailConfig.email_address}
                </p>
                <p className="text-xs text-green-600">
                  {emailConfig.token_expires_at
                    ? `Token expira: ${new Date(emailConfig.token_expires_at).toLocaleString()}`
                    : "Tokens configurados"}
                </p>
              </div>
            </div>
            <button
              onClick={disconnectGoogle}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Desconectar cuenta
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Conectá una cuenta de Gmail para que el sistema pueda leer los
              correos de depósitos.
            </p>
            <a
              href="/api/auth/google"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Conectar con Google
            </a>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          Entidades / Bancos configurados
        </h2>

        {parsers.length === 0 && (
          <p className="mb-4 text-sm text-gray-500">
            No hay entidades configuradas. Agrega la primera.
          </p>
        )}

        <ul className="mb-6 space-y-2">
          {parsers.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
            >
              <div>
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 text-gray-500">{p.sender_email}</span>
                <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs">
                  {p.parser_type}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleParser(p.id, p.is_active)}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    p.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {p.is_active ? "Activo" : "Inactivo"}
                </button>
                <button
                  onClick={() => deleteParser(p.id)}
                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={addParser} className="flex flex-wrap gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del banco"
            required
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={newSender}
            onChange={(e) => setNewSender(e.target.value)}
            placeholder="correo@banco.com"
            required
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="grupo_mutual">Grupo Mutual</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Agregar
          </button>
        </form>
      </section>
    </div>
  );
}

"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
}

export default function ConfigPage() {
  const supabase = createClient();
  const router = useRouter();

  const [emailConfig, setEmailConfig] = useState<EmailConfigRow | null>(null);
  const [emailAddress, setEmailAddress] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  const [parsers, setParsers] = useState<ParserRow[]>([]);
  const [newName, setNewName] = useState("");
  const [newSender, setNewSender] = useState("");
  const [newType, setNewType] = useState("grupo_mutual");
  const [saving, setSaving] = useState(false);

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

    if (emailData) {
      setEmailConfig(emailData);
      setEmailAddress(emailData.email_address);
      setAccessToken(emailData.access_token ?? "");
      setRefreshToken(emailData.refresh_token ?? "");
    }

    const { data: parsersData } = await supabase
      .from("parsers")
      .select("*")
      .order("created_at");

    if (parsersData) setParsers(parsersData);
  }

  async function saveEmailConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      email_address: emailAddress,
      provider: "gmail",
      access_token: accessToken,
      refresh_token: refreshToken,
      is_active: true,
    };

    if (emailConfig) {
      await supabase
        .from("email_configs")
        .update(payload)
        .eq("id", emailConfig.id);
    } else {
      await supabase.from("email_configs").insert(payload);
    }

    setSaving(false);
    loadData();
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
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          Configuración de acceso a Gmail
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          Ingresa las credenciales OAuth de Gmail para poder leer los correos.
          Necesitas un proyecto en Google Cloud Console con la API de Gmail
          habilitada.
        </p>

        <form onSubmit={saveEmailConfig} className="space-y-3">
          <label className="block text-sm font-medium">
            Correo a monitorear
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="tucorreo@gmail.com"
            />
          </label>
          <label className="block text-sm font-medium">
            Access Token
            <input
              type="text"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block text-sm font-medium">
            Refresh Token
            <input
              type="text"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </form>
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

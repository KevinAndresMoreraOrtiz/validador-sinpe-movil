import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Link
        href="/dashboard/deposits"
        className="rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
      >
        <h2 className="mb-2 text-lg font-semibold">Depósitos</h2>
        <p className="text-sm text-gray-600">
          Consulta y sincroniza los depósitos SINPE del día en una tabla.
        </p>
      </Link>

      <Link
        href="/dashboard/config"
        className="rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
      >
        <h2 className="mb-2 text-lg font-semibold">Configuración de Correo</h2>
        <p className="text-sm text-gray-600">
          Conecta tu cuenta de Gmail y configura los remitentes de los bancos.
        </p>
      </Link>

      <Link
        href="/dashboard/tokens"
        className="rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
      >
        <h2 className="mb-2 text-lg font-semibold">Tokens API</h2>
        <p className="text-sm text-gray-600">
          Administra los tokens para consumir el endpoint de depósitos.
        </p>
      </Link>
    </div>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Validador SINPE Móvil",
  description: "Configuración y validación de depósitos SINPE Móvil",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 min-h-screen">{children}</body>
    </html>
  );
}

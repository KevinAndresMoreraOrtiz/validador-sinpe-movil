# Validador SINPE Móvil — API Postman

Colección y entornos para probar la API del validador de depósitos SINPE Móvil.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `validador-sinpe-movil.postman_collection.json` | Colección con endpoints y ejemplos |
| `validador-sinpe-movil.postman_environment.json` | Entorno producción (Vercel) |
| `validador-sinpe-movil-local.postman_environment.json` | Entorno desarrollo local |

## Importar en Postman

1. Abre Postman → **Import**
2. Arrastra los 3 archivos JSON o selecciónalos
3. Activa el entorno **Producción** o **Local**
4. Edita la variable `api_token` con tu token real

## Obtener un token API

1. Inicia sesión en el dashboard: `https://validador-sinpe-movil.vercel.app/login`
2. Ve a **Tokens** (`/dashboard/tokens`)
3. Crea un token con un nombre descriptivo
4. Copia el valor `smp_...` (solo se muestra una vez)
5. Pégalo en la variable `api_token` del entorno Postman

## Endpoints

### `GET /api/deposits`

Endpoint principal. Consulta depósitos parseados desde Gmail.

```
GET {{base_url}}/api/deposits?token={{api_token}}&days=1
```

Parámetro opcional `days` (default servidor: 7, máximo: 30):

| Valor | Uso |
|-------|-----|
| `1` | Solo hoy |
| `7` | Última semana |
| `30` | Último mes |

**Requisitos previos:**
- Gmail conectado en `/dashboard/config`
- Al menos un banco/remitente activo
- Token API válido

**Respuesta exitosa:**

```json
{
  "success": true,
  "data": [
    {
      "reference_number": "987654321",
      "origin_number": "60123456",
      "origin_name": "María González",
      "destination_number": "CR05012345678901234567",
      "destination_name": "Empresa Ejemplo S.A.",
      "amount": 25000,
      "currency": "CRC",
      "concept": "Factura 001",
      "date": "2026-06-21T10:15:30",
      "raw_email_text": "..."
    }
  ]
}
```

**Códigos de error:**

| HTTP | error | Causa |
|------|-------|-------|
| 401 | Token requerido | Falta `?token=` |
| 401 | Token inválido o inactivo | Token incorrecto o desactivado |
| 404 | No hay parsers configurados | Sin bancos en config |
| 404 | No hay configuración de correo activa | Gmail no conectado |
| 500 | Error interno del servidor | Fallo Gmail/Supabase |

### `POST /api/tokens`

Crea un token API (requiere sesión de dashboard).

```
POST {{base_url}}/api/tokens
Content-Type: application/json

{ "name": "Mi integración" }
```

**Respuesta:** `{ "token": "smp_..." }`

> Recomendado crear tokens desde la UI del dashboard en lugar de Postman.

## Modelo ParsedDeposit

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `reference_number` | string | Número de referencia SINPE |
| `origin_number` | string \| null | Teléfono/cuenta origen |
| `origin_name` | string \| null | Nombre del originador |
| `destination_number` | string \| null | Cuenta destino (IBAN) |
| `destination_name` | string \| null | Nombre del destinatario |
| `amount` | number \| null | Monto de la transferencia |
| `currency` | string | `CRC` o `USD` |
| `concept` | string \| null | Concepto de pago |
| `date` | string \| null | ISO 8601 (`YYYY-MM-DDTHH:mm:ss`) |
| `raw_email_text` | string | Texto completo del correo |

## Parsers disponibles

| `parser_type` | Banco | Patrón de detección |
|---------------|-------|---------------------|
| `grupo_mutual` | Grupo Mutual | "Sinpe Móvil Mutual" + "transferencia" |

Configura el remitente (`sender_email`) del banco en `/dashboard/config`.

## OAuth (no Postman)

Los endpoints `/api/auth/google` y callbacks son flujos de navegador. Configura Gmail desde el dashboard.

## Variables de entorno del servidor

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=https://validador-sinpe-movil.vercel.app
```

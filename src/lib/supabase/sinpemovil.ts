import type { SupabaseClient } from "@supabase/supabase-js";

export const SINPEMOVIL_SCHEMA = "sinpemovil";

export function sinpemovil(client: SupabaseClient) {
  return client.schema(SINPEMOVIL_SCHEMA);
}

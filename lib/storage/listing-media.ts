import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const BUCKET = "listing-evidence";

function supabaseAdmin(): SupabaseClient | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type StoredUpload = {
  storagePath: string | null;
  publicUrl: string;
  contentBytes: Buffer | null;
};

/**
 * Prefer Supabase Storage when configured; otherwise keep bytes for DB staging
 * and serve via /api/properties/evidence/[id]/file.
 */
export async function storeEvidenceBytes(input: {
  userId: string;
  kind: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<StoredUpload> {
  const safeName = input.fileName.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const path = `${input.userId}/${input.kind}/${randomUUID()}-${safeName}`;
  const client = supabaseAdmin();

  if (client) {
    const { error } = await client.storage.from(BUCKET).upload(path, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (!error) {
      const { data } = client.storage.from(BUCKET).getPublicUrl(path);
      return {
        storagePath: path,
        publicUrl: data.publicUrl,
        contentBytes: null,
      };
    }
    console.warn("[storeEvidenceBytes] Supabase upload failed:", error.message);
  }

  return {
    storagePath: null,
    publicUrl: "", // filled after EvidenceUpload row id is known
    contentBytes: input.bytes,
  };
}

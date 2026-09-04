import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "blogcard";

/** 같은 경로에 upsert 하므로 캐시 무효화를 위해 쿼리스트링을 붙여 돌려준다. */
export async function uploadImage(
  supabase: SupabaseClient,
  path: string,
  data: Buffer | Blob,
  contentType = "image/png",
): Promise<string> {
  const body = data instanceof Blob ? data : new Blob([new Uint8Array(data)], { type: contentType });
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`이미지 저장 실패: ${error.message}`);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${pub.publicUrl}?v=${Date.now()}`;
}

export function errorJson(e: unknown, fallbackStatus = 500) {
  const message = e instanceof Error ? e.message : String(e);
  const status = message === "UNAUTHORIZED" ? 401 : fallbackStatus;
  return Response.json(
    { error: status === 401 ? "로그인이 필요합니다." : message },
    { status },
  );
}

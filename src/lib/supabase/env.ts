export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.");
  return url;
}

/** 새 프로젝트의 publishable key 와 기존 anon key 를 모두 허용 */
export function supabaseKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key)
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (또는 ANON_KEY) 환경변수가 없습니다.");
  return key;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

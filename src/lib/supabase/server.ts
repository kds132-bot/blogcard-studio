import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "./env";

/** 서버 컴포넌트 / 라우트 핸들러용 클라이언트 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서 호출된 경우: proxy 가 세션 갱신을 담당하므로 무시해도 된다.
        }
      },
    },
  });
}

/** 로그인 필수 라우트에서 사용 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return { supabase, user };
}

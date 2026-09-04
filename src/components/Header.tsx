import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import SignOutButton from "./SignOutButton";

export default async function Header() {
  let email: string | null = null;
  if (hasSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      email = user?.email ?? null;
    } catch {
      email = null;
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-fuchsia-500 text-[13px] font-black text-ink-950">
            B
          </span>
          <span className="text-sm font-bold tracking-tight text-slate-100">블로그 카드 스튜디오</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1.5 text-sm">
          {email ? (
            <>
              <Link href="/projects" className="btn btn-quiet">
                내 기록
              </Link>
              <Link href="/new" className="btn btn-primary !px-3.5 !py-2 !text-xs">
                새로 만들기
              </Link>
              <span className="ml-1 hidden max-w-[170px] truncate text-xs text-slate-500 sm:inline">
                {email}
              </span>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className="btn btn-primary !px-3.5 !py-2 !text-xs">
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

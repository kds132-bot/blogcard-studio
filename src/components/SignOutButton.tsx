"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-quiet"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await createClient().auth.signOut();
          router.push("/");
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      로그아웃
    </button>
  );
}

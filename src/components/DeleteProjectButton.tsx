"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteProjectButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="btn btn-quiet !text-slate-500" onClick={() => setConfirming(true)}>
        삭제
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        className="btn btn-quiet !text-rose-300"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await fetch(`/api/projects/${id}`, { method: "DELETE" });
            router.refresh();
          } finally {
            setBusy(false);
            setConfirming(false);
          }
        }}
      >
        {busy ? "삭제 중…" : "정말 삭제"}
      </button>
      <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>
        취소
      </button>
    </span>
  );
}

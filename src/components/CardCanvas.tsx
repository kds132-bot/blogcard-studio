"use client";

import { useEffect, useRef, useState } from "react";
import { ensureFonts, renderCard } from "@/lib/render";
import type { SizePreset } from "@/lib/sizes";
import type { Card, CardDesign } from "@/lib/types";

interface Props {
  card: Card;
  design: CardDesign;
  size: SizePreset;
  index: number;
  total: number;
  brandName: string;
  /** 미리보기 렌더 배율 */
  scale?: number;
  className?: string;
}

export default function CardCanvas({
  card,
  design,
  size,
  index,
  total,
  brandName,
  scale = 0.5,
  className,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = ref.current;
    if (!canvas) return;

    (async () => {
      try {
        await ensureFonts(design, `${card.title}\n${card.body}\n${brandName}`);
        if (cancelled) return;
        await renderCard(canvas, { card, design, size, index, total, brandName, scale });
        if (!cancelled) setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [card, design, size, index, total, brandName, scale]);

  return (
    <div className={className}>
      <canvas
        ref={ref}
        className="h-auto w-full rounded-[inherit]"
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
      />
      {failed && (
        <p className="mt-1 text-[11px] text-rose-300">미리보기를 그리지 못했습니다.</p>
      )}
    </div>
  );
}

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_DESIGN,
  EMPTY_PERSONA,
  newCardId,
  type Card,
  type CardDesign,
  type Persona,
  type Project,
} from "./types";

/** 한 Supabase 프로젝트에 다른 앱이 있어도 겹치지 않도록 전용 테이블을 쓴다. */
export const TABLE = "card_projects";

export function normalizeProject(row: Record<string, unknown>): Project {
  const cards = Array.isArray(row.cards) ? (row.cards as Card[]) : [];
  return {
    ...(row as unknown as Project),
    persona: { ...EMPTY_PERSONA, ...((row.persona as Persona) ?? {}) },
    design: { ...DEFAULT_DESIGN, ...((row.design as Partial<CardDesign>) ?? {}) },
    cards: cards.map((c) => ({
      id: c.id || newCardId(),
      title: c.title ?? "",
      body: c.body ?? "",
      imagePrompt: c.imagePrompt ?? "",
      imageUrl: c.imageUrl ?? null,
      design: c.design ?? {},
    })),
  };
}

export async function loadProject(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<Project> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`프로젝트를 불러오지 못했습니다: ${error.message}`);
  if (!data) throw new Error("프로젝트를 찾을 수 없습니다.");
  return normalizeProject(data);
}

export async function saveProject(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  patch: Record<string, unknown>,
): Promise<Project> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(`저장에 실패했습니다: ${error.message}`);
  return normalizeProject(data);
}

/**
 * 클라이언트가 보낸 카드 배열을 서버 상태 위에 안전하게 병합한다.
 * 자동저장과 이미지 생성이 겹칠 때 방금 만든 imageUrl 이 날아가는 것을 막는다.
 * - imageUrl 이 undefined/null 이면 "모른다"로 보고 서버 값을 유지
 * - imageUrl 이 빈 문자열이면 "지워달라"는 뜻으로 해석
 */
export function mergeCards(existing: Card[], incoming: Card[]): Card[] {
  const prevById = new Map(existing.map((c) => [c.id, c]));
  return incoming.map((c) => {
    const prev = prevById.get(c.id);
    let imageUrl: string | null;
    if (c.imageUrl === "") imageUrl = null;
    else if (typeof c.imageUrl === "string") imageUrl = c.imageUrl;
    else imageUrl = prev?.imageUrl ?? null;
    return {
      id: c.id || newCardId(),
      title: typeof c.title === "string" ? c.title : (prev?.title ?? ""),
      body: typeof c.body === "string" ? c.body : (prev?.body ?? ""),
      imagePrompt: typeof c.imagePrompt === "string" ? c.imagePrompt : (prev?.imagePrompt ?? ""),
      imageUrl,
      design: c.design && typeof c.design === "object" ? c.design : (prev?.design ?? {}),
    };
  });
}

export function clampCardCount(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 6;
  return Math.min(12, Math.max(2, v));
}

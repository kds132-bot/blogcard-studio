"use client";

import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CardCanvas from "./CardCanvas";
import DesignPanel from "./DesignPanel";
import { getSize } from "@/lib/sizes";
import { canvasToBlob, downloadBlob, ensureFonts, renderCard } from "@/lib/render";
import {
  ART_STYLES,
  newCardId,
  resolveDesign,
  type Card,
  type CardDesign,
  type Project,
} from "@/lib/types";

type Tab = "content" | "design" | "character";
type SaveState = "idle" | "saving" | "saved" | "error";

export default function Editor({
  initialProject,
  autostart,
}: {
  initialProject: Project;
  autostart: boolean;
}) {
  const [project, setProject] = useState<Project>(initialProject);
  const projectRef = useRef<Project>(initialProject);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<Tab>("content");
  const [perCardDesign, setPerCardDesign] = useState(false);

  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [cardError, setCardError] = useState<Record<string, string>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const batchRef = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const size = useMemo(() => getSize(project.size_key), [project.size_key]);
  const total = project.cards.length;
  const card: Card | undefined = project.cards[selected];
  const design = useMemo(
    () => resolveDesign(project.design, card?.design),
    [project.design, card?.design],
  );

  /** 항상 최신 상태를 ref 에 흘려보내 비동기 작업이 낡은 값을 쓰지 않게 한다. */
  const apply = useCallback((updater: (p: Project) => Project, markDirty = true) => {
    setProject((prev) => {
      const next = updater(prev);
      projectRef.current = next;
      return next;
    });
    if (markDirty) dirtyRef.current = true;
  }, []);

  /** 서버가 돌려준 최신 프로젝트로 교체 (이미지 URL 등) */
  const adopt = useCallback((p: Project) => {
    projectRef.current = p;
    setProject(p);
  }, []);

  const saveNow = useCallback(async () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setSaveState("saving");
    const p = projectRef.current;
    try {
      const res = await fetch(`/api/projects/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: p.title,
          persona: p.persona,
          design: p.design,
          cards: p.cards,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setSaveState("saved");
    } catch {
      dirtyRef.current = true;
      setSaveState("error");
    }
  }, []);

  // 자동 저장 (편집이 멈추고 1.2초 뒤)
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveNow(), 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [project, saveNow]);

  // 창을 닫기 전 마지막 저장 시도
  useEffect(() => {
    const onLeave = () => {
      if (dirtyRef.current) void saveNow();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [saveNow]);

  const generateOne = useCallback(
    async (cardId: string): Promise<boolean> => {
      const target = projectRef.current.cards.find((c) => c.id === cardId);
      if (!target) return false;
      if (!target.imagePrompt.trim()) {
        setCardError((e) => ({ ...e, [cardId]: "이미지 프롬프트를 먼저 입력해 주세요." }));
        return false;
      }
      setRunning((r) => ({ ...r, [cardId]: true }));
      setCardError((e) => {
        const { [cardId]: _drop, ...rest } = e;
        void _drop;
        return rest;
      });
      try {
        await saveNow();
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: projectRef.current.id,
            cardId,
            prompt: target.imagePrompt,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "이미지 생성 실패");
        // 서버가 준 imageUrl 만 반영하고 편집 중인 텍스트는 건드리지 않는다.
        apply(
          (p) => ({
            ...p,
            cards: p.cards.map((c) => (c.id === cardId ? { ...c, imageUrl: data.imageUrl } : c)),
          }),
          false,
        );
        return true;
      } catch (err) {
        setCardError((e) => ({
          ...e,
          [cardId]: err instanceof Error ? err.message : "이미지 생성 실패",
        }));
        return false;
      } finally {
        setRunning((r) => {
          const { [cardId]: _drop, ...rest } = r;
          void _drop;
          return rest;
        });
      }
    },
    [apply, saveNow],
  );

  const generateBatch = useCallback(
    async (mode: "missing" | "all") => {
      if (batchRef.current) return;
      batchRef.current = true;
      setBatchRunning(true);
      setNotice(null);
      try {
        await saveNow();
        const ids = projectRef.current.cards
          .filter((c) => (mode === "all" ? true : !c.imageUrl))
          .map((c) => c.id);
        let failed = 0;
        for (const id of ids) {
          if (!batchRef.current) break;
          const ok = await generateOne(id);
          if (!ok) failed += 1;
        }
        setNotice(
          failed === 0
            ? "이미지 생성이 끝났습니다."
            : `${failed}장은 실패했습니다. 카드에서 다시 시도해 주세요.`,
        );
      } finally {
        batchRef.current = false;
        setBatchRunning(false);
      }
    },
    [generateOne, saveNow],
  );

  // 새로 만든 직후 이미지 자동 생성
  const startedRef = useRef(false);
  useEffect(() => {
    if (!autostart || startedRef.current) return;
    if (project.cards.length === 0) return;
    if (project.cards.every((c) => c.imageUrl)) return;
    startedRef.current = true;
    void generateBatch("missing");
  }, [autostart, project.cards, generateBatch]);

  // ---- 카드 편집 ----
  const updateCard = (id: string, patch: Partial<Card>) =>
    apply((p) => ({ ...p, cards: p.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= project.cards.length) return;
    apply((p) => {
      const cards = [...p.cards];
      [cards[index], cards[to]] = [cards[to], cards[index]];
      return { ...p, cards };
    });
    setSelected(to);
  };

  const removeCard = (index: number) => {
    if (project.cards.length <= 1) return;
    apply((p) => ({ ...p, cards: p.cards.filter((_, i) => i !== index) }));
    setSelected((s) => Math.max(0, Math.min(s, project.cards.length - 2)));
  };

  const addCard = () => {
    const fresh: Card = {
      id: newCardId(),
      title: "새 카드",
      body: "",
      imagePrompt: "",
      imageUrl: null,
      design: {},
    };
    apply((p) => ({ ...p, cards: [...p.cards, fresh] }));
    setSelected(project.cards.length);
    setTab("content");
  };

  const changeDesign = (patch: Partial<CardDesign>) => {
    if (perCardDesign && card) {
      updateCard(card.id, { design: { ...card.design, ...patch } });
    } else {
      apply((p) => ({ ...p, design: { ...p.design, ...patch } }));
    }
  };

  // ---- 내보내기 ----
  const renderBlob = useCallback(
    async (index: number): Promise<Blob> => {
      const p = projectRef.current;
      const c = p.cards[index];
      const d = resolveDesign(p.design, c.design);
      await ensureFonts(d, `${c.title}\n${c.body}\n${p.persona.brandName}`);
      const canvas = document.createElement("canvas");
      await renderCard(canvas, {
        card: c,
        design: d,
        size: getSize(p.size_key),
        index,
        total: p.cards.length,
        brandName: p.persona.brandName,
        scale: 1,
      });
      return canvasToBlob(canvas);
    },
    [],
  );

  const fileBase = useMemo(
    () => (project.title || "cardnews").replace(/[\\/:*?"<>|]/g, "").trim() || "cardnews",
    [project.title],
  );

  async function exportOne() {
    setExporting("one");
    try {
      const blob = await renderBlob(selected);
      downloadBlob(blob, `${fileBase}-${String(selected + 1).padStart(2, "0")}.png`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "PNG 저장 실패");
    } finally {
      setExporting(null);
    }
  }

  async function exportAll() {
    setExporting("all");
    try {
      const zip = new JSZip();
      for (let i = 0; i < projectRef.current.cards.length; i += 1) {
        const blob = await renderBlob(i);
        zip.file(`${fileBase}-${String(i + 1).padStart(2, "0")}.png`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      downloadBlob(out, `${fileBase}.zip`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "ZIP 저장 실패");
    } finally {
      setExporting(null);
    }
  }

  const doneCount = project.cards.filter((c) => c.imageUrl).length;

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-16 sm:px-6">
      {/* 상단 바 */}
      <div className="sticky top-14 z-30 -mx-4 mb-6 border-b border-white/[0.07] bg-ink-950/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="min-w-[180px] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-white outline-none transition hover:border-white/10 focus:border-brand-500/60"
            value={project.title}
            onChange={(e) => apply((p) => ({ ...p, title: e.target.value }))}
            aria-label="카드뉴스 제목"
          />
          <span className="chip">
            {size.ratio} · {size.width}×{size.height}
          </span>
          <span className="chip">
            이미지 {doneCount}/{total}
          </span>
          <span className="text-[11px] text-slate-500">
            {saveState === "saving"
              ? "저장 중…"
              : saveState === "saved"
                ? "저장됨"
                : saveState === "error"
                  ? "저장 실패 · 다시 시도합니다"
                  : ""}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost !px-3 !py-2 !text-xs"
              onClick={() => generateBatch(doneCount === total ? "all" : "missing")}
              disabled={batchRunning}
            >
              {batchRunning
                ? "생성 중…"
                : doneCount === total
                  ? "전체 이미지 다시 생성"
                  : "남은 이미지 생성"}
            </button>
            <button
              type="button"
              className="btn btn-ghost !px-3 !py-2 !text-xs"
              onClick={exportOne}
              disabled={Boolean(exporting)}
            >
              {exporting === "one" ? "저장 중…" : "이 카드 PNG"}
            </button>
            <button
              type="button"
              className="btn btn-primary !px-3 !py-2 !text-xs"
              onClick={exportAll}
              disabled={Boolean(exporting)}
            >
              {exporting === "all" ? "압축 중…" : "전체 PNG (ZIP)"}
            </button>
          </div>
        </div>
        {notice && <p className="mt-2 text-xs text-slate-400">{notice}</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)_340px]">
        {/* 카드 목록 */}
        <aside className="order-2 lg:order-1">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300">카드 {total}장</h3>
            <button type="button" className="btn btn-quiet" onClick={addCard}>
              + 추가
            </button>
          </div>
          <ol className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            {project.cards.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`relative block w-full overflow-hidden rounded-xl border text-left transition ${
                    i === selected
                      ? "border-brand-500/80 ring-2 ring-brand-500/25"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <CardCanvas
                    card={c}
                    design={resolveDesign(project.design, c.design)}
                    size={size}
                    index={i}
                    total={total}
                    brandName={project.persona.brandName}
                    scale={0.18}
                  />
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  {running[c.id] && (
                    <span className="absolute inset-0 grid place-items-center bg-black/60 text-[10px] font-semibold text-white">
                      생성 중…
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        {/* 미리보기 */}
        <section className="order-1 lg:order-2">
          {card ? (
            <div className="surface p-4">
              <div className="mx-auto max-w-[520px]">
                <CardCanvas
                  card={card}
                  design={design}
                  size={size}
                  index={selected}
                  total={total}
                  brandName={project.persona.brandName}
                  scale={0.5}
                  className="overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/50"
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button type="button" className="btn btn-quiet" onClick={() => move(selected, -1)} disabled={selected === 0}>
                  ← 앞으로
                </button>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => move(selected, 1)}
                  disabled={selected === total - 1}
                >
                  뒤로 →
                </button>
                <button
                  type="button"
                  className="btn btn-quiet !text-rose-300"
                  onClick={() => removeCard(selected)}
                  disabled={total <= 1}
                >
                  카드 삭제
                </button>
              </div>
              {cardError[card.id] && (
                <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-200">
                  {cardError[card.id]}
                </p>
              )}
            </div>
          ) : (
            <div className="surface grid h-64 place-items-center text-sm text-slate-500">
              카드가 없습니다.
            </div>
          )}
        </section>

        {/* 편집 패널 */}
        <aside className="order-3">
          <div className="surface sticky top-32 max-h-[calc(100vh-9.5rem)] overflow-y-auto p-4">
            <div className="mb-4 grid grid-cols-3 gap-1.5">
              {(
                [
                  ["content", "내용"],
                  ["design", "디자인"],
                  ["character", "캐릭터"],
                ] as [Tab, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={`seg ${tab === k ? "seg-on" : "seg-off"}`}
                  onClick={() => setTab(k)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "content" && card && (
              <ContentPanel
                card={card}
                running={Boolean(running[card.id])}
                projectId={project.id}
                onChange={(patch) => updateCard(card.id, patch)}
                onGenerate={() => generateOne(card.id)}
                onUploaded={(url) =>
                  apply(
                    (p) => ({
                      ...p,
                      cards: p.cards.map((c) => (c.id === card.id ? { ...c, imageUrl: url } : c)),
                    }),
                    false,
                  )
                }
              />
            )}

            {tab === "design" && card && (
              <DesignPanel
                value={design}
                onChange={changeDesign}
                perCard={perCardDesign}
                onPerCardChange={setPerCardDesign}
                hasOverride={Object.keys(card.design ?? {}).length > 0}
                onClearOverride={() => updateCard(card.id, { design: {} })}
              />
            )}

            {tab === "character" && (
              <CharacterPanel project={project} onProject={adopt} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------- 내용 패널 ------------------------- */

function ContentPanel({
  card,
  running,
  projectId,
  onChange,
  onGenerate,
  onUploaded,
}: {
  card: Card;
  running: boolean;
  projectId: string;
  onChange: (patch: Partial<Card>) => void;
  onGenerate: () => void;
  onUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("cardId", card.id);
      fd.set("file", file);
      const res = await fetch("/api/card-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      onUploaded(data.imageUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="label">카드 제목</span>
        <textarea
          className="field min-h-16 resize-y"
          value={card.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="한 줄 헤드라인"
        />
      </div>
      <div>
        <span className="label">본문</span>
        <textarea
          className="field min-h-28 resize-y leading-relaxed"
          value={card.body}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder="2~3문장"
        />
        <p className="hint">줄바꿈은 그대로 카드에 반영됩니다.</p>
      </div>

      <div className="border-t border-white/10 pt-4">
        <span className="label">이미지 프롬프트 (영어)</span>
        <textarea
          className="field min-h-28 resize-y font-mono text-[11px] leading-relaxed"
          value={card.imagePrompt}
          onChange={(e) => onChange({ imagePrompt: e.target.value })}
          placeholder="A cozy kitchen counter with a pour-over dripper, morning light…"
        />
        <p className="hint">이미지에는 글자가 들어가지 않습니다. 한글 텍스트는 웹에서 합성됩니다.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary !px-3 !py-2 !text-xs" onClick={onGenerate} disabled={running}>
            {running ? "생성 중…" : card.imageUrl ? "이미지 다시 생성" : "이미지 생성"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn btn-ghost !px-3 !py-2 !text-xs"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "올리는 중…" : "직접 올리기"}
          </button>
          {card.imageUrl && (
            <button
              type="button"
              className="btn btn-quiet !text-rose-300"
              onClick={() => onChange({ imageUrl: "" })}
            >
              이미지 비우기
            </button>
          )}
        </div>
        {error && <p className="hint !text-rose-300">{error}</p>}
      </div>
    </div>
  );
}

/* ------------------------- 캐릭터 패널 ------------------------- */

function CharacterPanel({
  project,
  onProject,
}: {
  project: Project;
  onProject: (p: Project) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styleLabel = ART_STYLES.find((s) => s.value === project.art_style)?.label ?? project.art_style;

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("projectId", project.id);
      fd.set("file", file);
      const res = await fetch("/api/character", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "캐릭터 시트 생성 실패");
      onProject(data.project);
    } catch (e) {
      setError(e instanceof Error ? e.message : "캐릭터 시트 생성 실패");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/character", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "해제 실패");
      onProject(data.project);
    } catch (e) {
      setError(e instanceof Error ? e.message : "해제 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <span className="chip">{styleLabel}</span>
        <span className="chip">품질 {project.quality}</span>
      </div>

      {project.use_character && project.character_sheet_url ? (
        <>
          <div>
            <span className="label">캐릭터 시트</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.character_sheet_url}
              alt="캐릭터 시트"
              className="w-full rounded-xl border border-white/10 bg-black/30"
            />
            <p className="hint">
              모든 카드 이미지가 이 시트의 얼굴·의상·그림체를 기준으로 생성됩니다.
            </p>
          </div>
          {project.character_description && (
            <details className="rounded-xl border border-white/10 bg-black/20 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                고정된 캐릭터 설명 보기
              </summary>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                {project.character_description}
              </p>
            </details>
          )}
        </>
      ) : (
        <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-slate-400">
          아직 캐릭터를 쓰지 않습니다. 사진이나 캐릭터 이미지를 올리면 먼저 캐릭터 시트를 만들고, 이후
          생성하는 카드마다 같은 인물이 등장합니다.
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary !px-3 !py-2 !text-xs"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {busy ? "만드는 중…" : project.use_character ? "다른 이미지로 다시 만들기" : "이미지 올려 캐릭터 만들기"}
        </button>
        {project.use_character && (
          <button type="button" className="btn btn-ghost !px-3 !py-2 !text-xs" onClick={disable} disabled={busy}>
            사용 안 함
          </button>
        )}
      </div>
      {busy && <p className="hint">캐릭터 시트 생성은 1분 이상 걸릴 수 있습니다.</p>}
      {error && <p className="hint !text-rose-300">{error}</p>}
      {project.use_character && (
        <p className="hint">
          캐릭터를 바꾼 뒤에는 상단의 “전체 이미지 다시 생성”으로 카드들을 새로 만들어야 통일됩니다.
        </p>
      )}
    </div>
  );
}

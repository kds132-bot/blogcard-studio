"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ART_STYLES, EMPTY_PERSONA, QUALITY_OPTIONS, type ArtStyle, type Persona, type Quality, type SizeKey } from "@/lib/types";
import { SIZE_PRESETS } from "@/lib/sizes";

const SAMPLE = `요즘 원두를 직접 갈아 마시는 분들이 부쩍 늘었습니다. 그런데 같은 원두인데도 집에서 내리면 유독 쓰거나 밍밍한 경우가 많습니다. 대부분 원인은 분쇄도와 물 온도, 그리고 뜸 들이는 시간 세 가지에 있습니다.

첫째, 분쇄도입니다. 핸드드립에서는 굵은 설탕 정도가 기준입니다. 너무 곱게 갈면 물이 천천히 빠지면서 과다 추출이 일어나 쓴맛이 강해집니다.

둘째, 물 온도입니다. 90~93도가 무난합니다. 끓자마자 부으면 탄 맛이 올라오니 30초 정도 식힌 뒤 사용하세요.

셋째, 뜸입니다. 원두 무게의 두 배 정도 물을 부어 30초 기다리면 가스가 빠지면서 추출이 고르게 됩니다.

세 가지만 지켜도 집에서 내린 커피 맛이 확 달라집니다. 오늘 아침부터 한 가지씩 바꿔 보세요.`;

const steps = ["프로젝트 생성", "캐릭터 시트 생성", "카드 카피 기획"] as const;

export default function CreateForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [persona, setPersona] = useState<Persona>({
    ...EMPTY_PERSONA,
    tone: "친근하고 신뢰감 있는 존댓말",
  });
  const [blogText, setBlogText] = useState("");
  const [cardCount, setCardCount] = useState(6);
  const [sizeKey, setSizeKey] = useState<SizeKey>("portrait");
  const [artStyle, setArtStyle] = useState<ArtStyle>("flat");
  const [quality, setQuality] = useState<Quality>("medium");
  const [useCharacter, setUseCharacter] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [busyStep, setBusyStep] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof Persona) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPersona((p) => ({ ...p, [k]: e.target.value }));

  function pickFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
    if (f) setUseCharacter(true);
  }

  async function jsonFetch(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
    return data;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (blogText.trim().length < 30) {
      setError("블로그 글을 30자 이상 입력해 주세요.");
      return;
    }
    if (useCharacter && !file) {
      setError("캐릭터를 사용하려면 사진이나 캐릭터 이미지를 올려 주세요.");
      return;
    }

    try {
      setBusyStep(0);
      const { project } = await jsonFetch("/api/projects", {
        persona,
        blogText,
        cardCount,
        sizeKey,
        artStyle,
        quality,
        useCharacter: useCharacter && Boolean(file),
      });

      if (useCharacter && file) {
        setBusyStep(1);
        const fd = new FormData();
        fd.set("projectId", project.id);
        fd.set("file", file);
        const res = await fetch("/api/character", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "캐릭터 시트 생성에 실패했습니다.");
      }

      setBusyStep(2);
      await jsonFetch("/api/plan", { projectId: project.id });

      router.push(`/projects/${project.id}?autostart=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "실패했습니다.");
      setBusyStep(-1);
    }
  }

  const busy = busyStep >= 0;

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      {/* 1. 페르소나 */}
      <section className="surface p-6">
        <SectionTitle n="01" title="브랜드 페르소나" desc="카피의 말투와 이미지 분위기를 결정합니다." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="브랜드/채널 이름" hint="카드 하단에 표기됩니다.">
            <input className="field" value={persona.brandName} onChange={set("brandName")} placeholder="예: 하루 한 잔" />
          </Field>
          <Field label="타깃 독자">
            <input className="field" value={persona.audience} onChange={set("audience")} placeholder="예: 홈카페 초보 20~30대" />
          </Field>
          <Field label="브랜드 소개" hint="무엇을 하는 곳인지 한두 문장으로.">
            <input className="field" value={persona.description} onChange={set("description")} placeholder="예: 집에서 커피를 더 맛있게 내리는 법을 알려주는 채널" />
          </Field>
          <Field label="말투 / 톤">
            <input className="field" value={persona.tone} onChange={set("tone")} placeholder="예: 다정하고 담백한 존댓말" />
          </Field>
        </div>
      </section>

      {/* 2. 블로그 원문 */}
      <section className="surface p-6">
        <SectionTitle n="02" title="블로그 글" desc="원문을 그대로 붙여넣으세요. 내용에 없는 사실은 만들지 않습니다." />
        <textarea
          className="field min-h-56 resize-y leading-relaxed"
          value={blogText}
          onChange={(e) => setBlogText(e.target.value)}
          placeholder="블로그 글 전문을 붙여넣어 주세요."
        />
        <div className="mt-2 flex items-center justify-between">
          <button type="button" className="btn btn-quiet" onClick={() => setBlogText(SAMPLE)}>
            예시 글 넣어보기
          </button>
          <span className="text-xs text-slate-500">{blogText.length.toLocaleString()}자</span>
        </div>
      </section>

      {/* 3. 캐릭터 */}
      <section className="surface p-6">
        <SectionTitle
          n="03"
          title="내 사진 / 캐릭터 사용"
          desc="사용하면 먼저 캐릭터 시트를 만들고, 모든 카드가 같은 얼굴·의상·그림체를 따릅니다."
        />
        <div className="flex flex-wrap items-start gap-5">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-brand-500)]"
              checked={useCharacter}
              onChange={(e) => {
                setUseCharacter(e.target.checked);
                if (!e.target.checked) pickFile(null);
              }}
            />
            카드에 내 캐릭터를 등장시키기
          </label>

          {useCharacter && (
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="업로드한 캐릭터 미리보기" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-[11px] text-slate-500">미리보기</div>
                )}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
                <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                  {file ? "다른 이미지 선택" : "이미지 올리기"}
                </button>
                <p className="hint max-w-xs">
                  얼굴과 상반신이 잘 보이는 정면 사진일수록 결과가 안정적입니다. PNG·JPG·WEBP, 최대 8MB.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. 출력 설정 */}
      <section className="surface p-6">
        <SectionTitle n="04" title="카드 수와 이미지 설정" desc="나중에 편집기에서도 카드를 더하거나 뺄 수 있습니다." />

        <div className="space-y-6">
          <div>
            <span className="label">카드 개수 · {cardCount}장</span>
            <input
              type="range"
              min={2}
              max={12}
              value={cardCount}
              onChange={(e) => setCardCount(Number(e.target.value))}
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-600">
              <span>2</span>
              <span>12</span>
            </div>
          </div>

          <div>
            <span className="label">이미지 크기</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {SIZE_PRESETS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSizeKey(s.key)}
                  className={`seg text-left ${sizeKey === s.key ? "seg-on" : "seg-off"}`}
                >
                  <span className="block font-bold">{s.ratio}</span>
                  <span className="block text-[10px] opacity-70">
                    {s.width}×{s.height}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">그림체</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ART_STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setArtStyle(s.value)}
                  className={`seg ${artStyle === s.value ? "seg-on" : "seg-off"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">이미지 품질</span>
            <div className="grid grid-cols-3 gap-2">
              {QUALITY_OPTIONS.map((q) => (
                <button
                  key={q.value}
                  type="button"
                  onClick={() => setQuality(q.value)}
                  className={`seg text-left ${quality === q.value ? "seg-on" : "seg-off"}`}
                >
                  <span className="block font-bold">{q.label}</span>
                  <span className="block text-[10px] opacity-70">{q.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "만드는 중…" : "카드뉴스 만들기"}
        </button>
        <span className="text-xs text-slate-500">
          이미지 생성은 다음 화면에서 자동으로 이어집니다.
        </span>
      </div>

      {busy && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/85 backdrop-blur-sm">
          <div className="surface w-[min(92vw,420px)] p-6">
            <h3 className="text-sm font-bold text-white">준비하고 있습니다</h3>
            <ul className="mt-4 space-y-3">
              {steps.map((s, i) => {
                const skip = i === 1 && !(useCharacter && file);
                const state = skip ? "skip" : i < busyStep ? "done" : i === busyStep ? "doing" : "todo";
                return (
                  <li key={s} className="flex items-center gap-3 text-sm">
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${
                        state === "done"
                          ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300"
                          : state === "doing"
                            ? "border-brand-400/60 bg-brand-400/15 text-brand-400"
                            : "border-white/15 text-slate-600"
                      }`}
                    >
                      {state === "done" ? "✓" : state === "skip" ? "–" : i + 1}
                    </span>
                    <span className={state === "todo" || state === "skip" ? "text-slate-500" : "text-slate-100"}>
                      {s}
                      {state === "skip" && " (건너뜀)"}
                    </span>
                    {state === "doing" && (
                      <span className="ml-auto text-[11px] text-slate-500">진행 중…</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 text-[11px] leading-relaxed text-slate-500">
              캐릭터 시트 생성은 1분 이상 걸릴 수 있습니다. 창을 닫지 말고 기다려 주세요.
            </p>
          </div>
        </div>
      )}
    </form>
  );
}

function SectionTitle({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] font-black text-brand-400">{n}</div>
      <h2 className="mt-1 text-base font-bold text-white">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{desc}</p>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

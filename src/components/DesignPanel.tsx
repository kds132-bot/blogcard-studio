"use client";

import { FONT_OPTIONS, LAYOUT_OPTIONS, type CardDesign } from "@/lib/types";

interface Props {
  /** 편집 중인 실제 값 (프로젝트 기본값 + 카드 오버라이드가 합쳐진 결과) */
  value: CardDesign;
  onChange: (patch: Partial<CardDesign>) => void;
  /** 카드 단위 편집 여부 */
  perCard: boolean;
  onPerCardChange: (v: boolean) => void;
  hasOverride: boolean;
  onClearOverride: () => void;
}

export default function DesignPanel({
  value,
  onChange,
  perCard,
  onPerCardChange,
  hasOverride,
  onClearOverride,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`seg ${!perCard ? "seg-on" : "seg-off"}`}
            onClick={() => onPerCardChange(false)}
          >
            모든 카드
          </button>
          <button
            type="button"
            className={`seg ${perCard ? "seg-on" : "seg-off"}`}
            onClick={() => onPerCardChange(true)}
          >
            이 카드만
          </button>
        </div>
        <p className="hint">
          {perCard
            ? "이 카드에만 적용되는 예외 설정입니다."
            : "전체 카드에 적용되는 기본 디자인입니다."}
        </p>
        {perCard && hasOverride && (
          <button type="button" className="btn btn-quiet mt-2 !px-0" onClick={onClearOverride}>
            이 카드의 예외 설정 초기화
          </button>
        )}
      </div>

      <Group title="레이아웃">
        <div className="grid grid-cols-1 gap-2">
          {LAYOUT_OPTIONS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => onChange({ layout: l.value })}
              className={`seg text-left ${value.layout === l.value ? "seg-on" : "seg-off"}`}
            >
              <span className="block font-bold">{l.label}</span>
              <span className="block text-[10px] opacity-70">{l.hint}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="글꼴">
        <select
          className="field"
          value={value.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value} className="bg-ink-900">
              {f.label}
            </option>
          ))}
        </select>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`seg ${value.align === "left" ? "seg-on" : "seg-off"}`}
            onClick={() => onChange({ align: "left" })}
          >
            왼쪽 정렬
          </button>
          <button
            type="button"
            className={`seg ${value.align === "center" ? "seg-on" : "seg-off"}`}
            onClick={() => onChange({ align: "center" })}
          >
            가운데 정렬
          </button>
        </div>
      </Group>

      <Group title="크기와 여백">
        <Slider label="제목 크기" min={36} max={140} value={value.titleSize} onChange={(v) => onChange({ titleSize: v })} />
        <Slider label="본문 크기" min={20} max={72} value={value.bodySize} onChange={(v) => onChange({ bodySize: v })} />
        <Slider label="줄 간격" min={1.1} max={2} step={0.05} value={value.lineHeight} onChange={(v) => onChange({ lineHeight: v })} suffix="배" />
        <Slider label="바깥 여백" min={32} max={160} value={value.padding} onChange={(v) => onChange({ padding: v })} />
      </Group>

      <Group title="색상">
        <div className="grid grid-cols-2 gap-3">
          <Color label="글자색" value={value.textColor} onChange={(v) => onChange({ textColor: v })} />
          <Color label="포인트색" value={value.accentColor} onChange={(v) => onChange({ accentColor: v })} />
          <Color label="음영색" value={value.overlayColor} onChange={(v) => onChange({ overlayColor: v })} />
          {value.layout === "split" && (
            <Color label="패널색" value={value.panelColor} onChange={(v) => onChange({ panelColor: v })} />
          )}
        </div>
        <div className="mt-3">
          <Slider
            label="음영 세기"
            min={0}
            max={1}
            step={0.02}
            value={value.overlayStrength}
            onChange={(v) => onChange({ overlayStrength: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      </Group>

      <Group title="표시 요소">
        <Toggle label="포인트 바" checked={value.showAccentBar} onChange={(v) => onChange({ showAccentBar: v })} />
        <Toggle label="브랜드 이름" checked={value.showBrand} onChange={(v) => onChange({ showBrand: v })} />
        <Toggle label="페이지 번호" checked={value.showPageNumber} onChange={(v) => onChange({ showPageNumber: v })} />
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2.5 text-xs font-bold tracking-wide text-slate-300">{title}</h4>
      {children}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  suffix = "",
  format,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  format?: (v: number) => string;
}) {
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="font-medium text-slate-400">{label}</span>
        <span className="text-slate-500">{format ? format(value) : `${value}${suffix}`}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-medium text-slate-400">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mb-2 flex cursor-pointer items-center justify-between text-xs text-slate-300">
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--color-brand-500)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

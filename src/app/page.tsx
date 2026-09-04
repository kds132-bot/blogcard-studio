import Link from "next/link";
import { ART_STYLES } from "@/lib/types";
import { SIZE_PRESETS } from "@/lib/sizes";

const STEPS = [
  {
    n: "01",
    title: "페르소나와 블로그 글 입력",
    desc: "브랜드 말투·타깃을 정하고 블로그 원문을 붙여넣습니다. 글에 실제로 있는 내용만 카드로 옮깁니다.",
  },
  {
    n: "02",
    title: "캐릭터 시트 고정 (선택)",
    desc: "내 사진이나 캐릭터를 올리면 먼저 캐릭터 시트를 만들고, 모든 카드가 그 얼굴·의상·그림체를 따릅니다.",
  },
  {
    n: "03",
    title: "글자 없는 이미지 생성",
    desc: "gpt-image-2 가 텍스트가 전혀 없는 이미지를 만듭니다. 깨진 한글이 생길 여지를 아예 없앱니다.",
  },
  {
    n: "04",
    title: "웹에서 한글 합성 · PNG 저장",
    desc: "제목과 본문은 브라우저 캔버스에서 실제 한글 폰트로 얹습니다. 낱장 또는 전체 ZIP으로 내려받으세요.",
  },
];

const FEATURES = [
  ["카드별 편집", "제목·본문·이미지 프롬프트를 각각 고치고, 순서를 바꾸고, 카드를 더하거나 뺄 수 있습니다."],
  ["디자인 조절", "레이아웃 5종, 한글 폰트 7종, 색상·크기·여백·정렬을 전체 또는 카드 단위로 지정합니다."],
  ["일관된 캐릭터", "캐릭터 시트와 앞서 만든 카드를 레퍼런스로 물려 얼굴·의상·그림체를 유지합니다."],
  ["직접 올린 이미지", "AI 대신 내가 준비한 사진을 특정 카드에 넣어도 텍스트 합성은 똑같이 동작합니다."],
  ["생성 기록 저장", "로그인하면 모든 프로젝트가 저장되어 언제든 이어서 편집할 수 있습니다."],
  ["선명한 내보내기", "1080px 이상 원본 해상도로 렌더링해 인스타·블로그 어디에 올려도 글자가 또렷합니다."],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
      <section className="grid items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div>
          <span className="chip">gpt-image-2 · 한글 정밀 합성</span>
          <h1 className="mt-5 text-4xl font-black leading-[1.15] tracking-tight text-white sm:text-5xl">
            블로그 글 하나로
            <br />
            <span className="bg-gradient-to-r from-brand-400 via-sky-300 to-fuchsia-400 bg-clip-text text-transparent">
              브랜드 톤이 살아있는 카드뉴스
            </span>
            를.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-400">
            페르소나와 블로그 원문을 넣으면 카드별 카피와 이미지를 만들어 줍니다. 이미지에는 글자를 넣지
            않고, 정확한 한글은 웹에서 직접 얹기 때문에 글자가 깨지지 않습니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/new" className="btn btn-primary">
              카드뉴스 만들기
            </Link>
            <Link href="/projects" className="btn btn-ghost">
              내 기록 보기
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-1.5">
            {SIZE_PRESETS.map((s) => (
              <span key={s.key} className="chip">
                {s.ratio}
              </span>
            ))}
            {ART_STYLES.slice(0, 5).map((s) => (
              <span key={s.value} className="chip">
                {s.label}
              </span>
            ))}
          </div>
        </div>

        <HeroPreview />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="surface p-5">
            <div className="text-xs font-black text-brand-400">{s.n}</div>
            <h3 className="mt-2 text-sm font-bold text-white">{s.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{s.desc}</p>
          </div>
        ))}
      </section>

      <section className="mt-20">
        <h2 className="text-2xl font-bold tracking-tight text-white">편집까지 끝내고 내보냅니다</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, d]) => (
            <div key={t} className="surface p-5">
              <h3 className="text-sm font-bold text-white">{t}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface mt-20 flex flex-col items-center gap-4 px-6 py-14 text-center">
        <h2 className="text-2xl font-bold text-white">지금 블로그 글을 붙여넣어 보세요</h2>
        <p className="max-w-lg text-sm text-slate-400">
          로그인하면 만든 카드뉴스가 기록으로 남아 언제든 다시 편집할 수 있습니다.
        </p>
        <Link href="/new" className="btn btn-primary mt-2">
          시작하기
        </Link>
      </section>
    </main>
  );
}

/** 결과물의 형태를 보여주는 정적 목업 (실제 렌더러와 같은 레이아웃 규칙) */
function HeroPreview() {
  const cards = [
    { t: "블로그 글이\n카드가 됩니다", b: "원문을 붙여넣으면 핵심만 골라 카드로 나눕니다.", n: 1 },
    { t: "얼굴은 그대로", b: "캐릭터 시트로 모든 카드의 인물을 고정합니다.", n: 2 },
    { t: "한글은 정확하게", b: "이미지에는 글자 없이, 텍스트는 웹에서 합성합니다.", n: 3 },
  ];
  return (
    <div className="relative mx-auto grid w-full max-w-md grid-cols-3 gap-3">
      {cards.map((c, i) => (
        <div
          key={c.n}
          className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50"
          style={{
            transform: `translateY(${i === 1 ? -18 : 0}px) rotate(${(i - 1) * 2.5}deg)`,
            background:
              i === 0
                ? "linear-gradient(150deg,#1e3a8a,#0b1220)"
                : i === 1
                  ? "linear-gradient(150deg,#7c3aed,#130b20)"
                  : "linear-gradient(150deg,#0f766e,#07141a)",
          }}
        >
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
            <div className="mb-1.5 h-[3px] w-6 rounded-full bg-brand-400" />
            <div className="whitespace-pre-line text-[11px] font-extrabold leading-tight text-white">
              {c.t}
            </div>
            <div className="mt-1 line-clamp-2 text-[9px] leading-snug text-white/70">{c.b}</div>
            <div className="mt-2 text-right text-[8px] text-white/50">{c.n} / 3</div>
          </div>
        </div>
      ))}
    </div>
  );
}

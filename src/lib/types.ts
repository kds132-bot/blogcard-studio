/** 블로그 카드 스튜디오 - 공용 도메인 타입 */

export type SizeKey = "square" | "portrait" | "story" | "landscape" | "blog";

export type ArtStyle =
  | "flat"
  | "3d"
  | "watercolor"
  | "photo"
  | "anime"
  | "crayon"
  | "lineart"
  | "isometric";

export type Quality = "low" | "medium" | "high";

/** 카드 위에 한글 텍스트를 얹는 방식 */
export type Layout = "bottom" | "top" | "center" | "split" | "band";

export interface Persona {
  brandName: string;
  description: string;
  tone: string;
  audience: string;
}

export const EMPTY_PERSONA: Persona = {
  brandName: "",
  description: "",
  tone: "",
  audience: "",
};

export interface CardDesign {
  layout: Layout;
  fontFamily: string;
  titleSize: number; // 내보내기 해상도 기준 px
  bodySize: number;
  lineHeight: number; // 배수
  textColor: string;
  accentColor: string;
  overlayColor: string;
  overlayStrength: number; // 0~1
  align: "left" | "center";
  padding: number;
  showAccentBar: boolean;
  showPageNumber: boolean;
  showBrand: boolean;
  panelColor: string; // split 레이아웃 하단 패널 색
}

export const DEFAULT_DESIGN: CardDesign = {
  layout: "bottom",
  fontFamily: "Noto Sans KR",
  titleSize: 76,
  bodySize: 38,
  lineHeight: 1.4,
  textColor: "#ffffff",
  accentColor: "#3b82f6",
  overlayColor: "#000000",
  overlayStrength: 0.62,
  align: "left",
  padding: 76,
  showAccentBar: true,
  showPageNumber: true,
  showBrand: true,
  panelColor: "#101828",
};

export interface Card {
  id: string;
  title: string;
  body: string;
  imagePrompt: string;
  imageUrl: string | null;
  /** 카드별 디자인 오버라이드 (비어 있으면 프로젝트 디자인을 그대로 사용) */
  design: Partial<CardDesign>;
}

export type ProjectStatus = "draft" | "planned" | "generating" | "done";

export interface Project {
  id: string;
  user_id: string;
  title: string;
  persona: Persona;
  blog_text: string;
  card_count: number;
  size_key: SizeKey;
  art_style: ArtStyle;
  quality: Quality;
  use_character: boolean;
  character_source_url: string | null;
  character_sheet_url: string | null;
  character_description: string | null;
  design: CardDesign;
  cards: Card[];
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export const LAYOUT_OPTIONS: { value: Layout; label: string; hint: string }[] = [
  { value: "bottom", label: "하단 그라데이션", hint: "이미지 아래쪽에 텍스트" },
  { value: "top", label: "상단 그라데이션", hint: "이미지 위쪽에 텍스트" },
  { value: "center", label: "가운데 정렬", hint: "전체를 어둡게 깔고 중앙 배치" },
  { value: "split", label: "분할 패널", hint: "위는 이미지, 아래는 단색 패널" },
  { value: "band", label: "반투명 밴드", hint: "텍스트 뒤에 카드형 박스" },
];

export const FONT_OPTIONS = [
  { value: "Noto Sans KR", label: "노토 산스 (기본 고딕)" },
  { value: "Black Han Sans", label: "검은고딕 (굵은 헤드라인)" },
  { value: "Do Hyeon", label: "도현 (캐주얼)" },
  { value: "Jua", label: "주아 (귀여움)" },
  { value: "Gowun Dodum", label: "고운돋움 (부드러움)" },
  { value: "Nanum Myeongjo", label: "나눔명조 (세리프)" },
  { value: "Gaegu", label: "개구 (손글씨)" },
];

export const ART_STYLES: { value: ArtStyle; label: string; prompt: string }[] = [
  {
    value: "flat",
    label: "플랫 일러스트",
    prompt:
      "clean modern flat vector illustration, bold simple shapes, minimal shading, generous negative space, soft contemporary palette",
  },
  {
    value: "3d",
    label: "3D 렌더",
    prompt:
      "cute 3D rendered illustration, soft studio lighting, clay-like matte materials, rounded forms, subtle depth of field",
  },
  {
    value: "watercolor",
    label: "수채화",
    prompt:
      "hand-painted watercolor illustration, soft pigment washes, visible paper texture, gentle muted colors, loose edges",
  },
  {
    value: "photo",
    label: "실사 사진",
    prompt:
      "photorealistic editorial photograph, natural window light, shallow depth of field, true-to-life colors, high detail",
  },
  {
    value: "anime",
    label: "애니메이션",
    prompt:
      "Japanese anime style illustration, clean confident line art, cel shading, vibrant saturated colors, expressive faces",
  },
  {
    value: "crayon",
    label: "크레용/파스텔",
    prompt:
      "children's book crayon and pastel illustration, warm grainy texture, hand-drawn imperfect strokes, cozy palette",
  },
  {
    value: "lineart",
    label: "라인 드로잉",
    prompt:
      "minimal single-color line drawing on a plain light background, elegant thin continuous lines, lots of white space",
  },
  {
    value: "isometric",
    label: "아이소메트릭",
    prompt:
      "isometric 3/4 top-down illustration, precise geometry, soft ambient occlusion, tidy modern color palette",
  },
];

export function artStylePrompt(style: ArtStyle): string {
  return ART_STYLES.find((s) => s.value === style)?.prompt ?? ART_STYLES[0].prompt;
}

export const QUALITY_OPTIONS: { value: Quality; label: string; hint: string }[] = [
  { value: "low", label: "빠름", hint: "초안 확인용 · 가장 저렴" },
  { value: "medium", label: "표준", hint: "대부분의 경우 권장" },
  { value: "high", label: "고품질", hint: "느리고 비용이 큼" },
];

/** 카드별 디자인 오버라이드를 프로젝트 기본 디자인 위에 병합 */
export function resolveDesign(base: CardDesign, override?: Partial<CardDesign>): CardDesign {
  return { ...DEFAULT_DESIGN, ...base, ...(override ?? {}) };
}

export function newCardId(): string {
  return `c_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

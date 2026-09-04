/**
 * 카드 렌더러 (브라우저 전용).
 * 이미지 모델은 글자를 못 그리기 때문에 "글자 없는 이미지"만 만들고,
 * 정확한 한글은 여기 캔버스에서 직접 합성한다.
 */
import type { Card, CardDesign } from "./types";
import type { SizePreset } from "./sizes";

/** 폰트별 제목/본문 웨이트 (가변 웨이트가 없는 폰트는 400만 존재) */
const FONT_WEIGHTS: Record<string, { title: number; body: number }> = {
  "Noto Sans KR": { title: 800, body: 400 },
  "Nanum Myeongjo": { title: 800, body: 400 },
};
function weightsFor(family: string) {
  return FONT_WEIGHTS[family] ?? { title: 400, body: 400 };
}

export function fontSpec(weight: number, sizePx: number, family: string): string {
  return `${weight} ${sizePx}px "${family}", "Noto Sans KR", sans-serif`;
}

const imageCache = new Map<string, HTMLImageElement>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached?.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = url;
  });
}

/** 캔버스에 그리기 전에 실제 글리프가 준비되도록 보장 */
export async function ensureFonts(design: CardDesign, text: string): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const w = weightsFor(design.fontFamily);
  const sample = text.slice(0, 400) || "가";
  await Promise.all([
    document.fonts.load(`${w.title} 80px "${design.fontFamily}"`, sample).catch(() => {}),
    document.fonts.load(`${w.body} 40px "${design.fontFamily}"`, sample).catch(() => {}),
    document.fonts.load(`600 30px "Noto Sans KR"`, "0123456789 /").catch(() => {}),
  ]);
  await document.fonts.ready;
}

/**
 * 한국어 줄바꿈: 우선 공백 단위로 끊고, 한 덩어리가 폭을 넘으면 글자 단위로 쪼갠다.
 * 명시적 \n 은 그대로 유지한다.
 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/(\s+)/)) {
      if (word === "") continue;
      const candidate = line + word;
      if (ctx.measureText(candidate).width <= maxWidth || line === "") {
        if (ctx.measureText(candidate).width <= maxWidth) {
          line = candidate;
          continue;
        }
        // 한 단어(또는 공백 없는 긴 한글 덩어리)가 통째로 넘칠 때 → 글자 단위 분해
        let chunk = "";
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk !== "") {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      } else {
        lines.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

interface Block {
  titleLines: string[];
  bodyLines: string[];
  titleSize: number;
  bodySize: number;
  height: number;
}

const GAP_RATIO = 0.55; // 제목-본문 사이 여백 (본문 크기 대비)

function layoutBlock(
  ctx: CanvasRenderingContext2D,
  design: CardDesign,
  title: string,
  body: string,
  maxWidth: number,
  maxHeight: number,
): Block {
  const w = weightsFor(design.fontFamily);
  for (let scale = 1; scale >= 0.5; scale -= 0.05) {
    const titleSize = Math.round(design.titleSize * scale);
    const bodySize = Math.round(design.bodySize * scale);

    ctx.font = fontSpec(w.title, titleSize, design.fontFamily);
    const titleLines = title.trim() ? wrapText(ctx, title.trim(), maxWidth) : [];

    ctx.font = fontSpec(w.body, bodySize, design.fontFamily);
    const bodyLines = body.trim() ? wrapText(ctx, body.trim(), maxWidth) : [];

    const titleH = titleLines.length * titleSize * Math.max(1.15, design.lineHeight - 0.15);
    const bodyH = bodyLines.length * bodySize * design.lineHeight;
    const gap = titleLines.length && bodyLines.length ? bodySize * GAP_RATIO : 0;
    const height = titleH + gap + bodyH;

    if (height <= maxHeight || scale <= 0.5) {
      return { titleLines, bodyLines, titleSize, bodySize, height };
    }
  }
  // 도달하지 않음
  return { titleLines: [], bodyLines: [], titleSize: design.titleSize, bodySize: design.bodySize, height: 0 };
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface RenderOptions {
  card: Card;
  design: CardDesign;
  size: SizePreset;
  index: number;
  total: number;
  brandName: string;
  /** 미리보기용 축소 배율 (1 = 내보내기 원본 해상도) */
  scale?: number;
}

/** 카드 1장을 캔버스에 그린다. 폰트는 미리 ensureFonts 로 로드해 둘 것. */
export async function renderCard(
  canvas: HTMLCanvasElement,
  opts: RenderOptions,
): Promise<HTMLCanvasElement> {
  const { card, design, size, index, total, brandName } = opts;
  const W = size.width;
  const H = size.height;
  const scale = opts.scale ?? 1;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.");

  // 좌표계는 항상 내보내기 해상도 기준으로 두고, 축소는 변환으로 처리한다.
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "top";

  const isSplit = design.layout === "split";
  const imageH = isSplit ? Math.round(H * 0.62) : H;

  // 1) 배경 이미지
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, W, H);
  if (card.imageUrl) {
    try {
      const img = await loadImage(card.imageUrl);
      drawCover(ctx, img, 0, 0, W, imageH);
    } catch {
      drawPlaceholder(ctx, W, imageH, design);
    }
  } else {
    drawPlaceholder(ctx, W, imageH, design);
  }

  // 2) 가독성 레이어
  const strength = Math.min(1, Math.max(0, design.overlayStrength));
  if (design.layout === "bottom") {
    const g = ctx.createLinearGradient(0, H * 0.3, 0, H);
    g.addColorStop(0, rgba(design.overlayColor, 0));
    g.addColorStop(0.45, rgba(design.overlayColor, strength * 0.55));
    g.addColorStop(1, rgba(design.overlayColor, strength));
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.3, W, H * 0.7);
  } else if (design.layout === "top") {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    g.addColorStop(0, rgba(design.overlayColor, strength));
    g.addColorStop(0.55, rgba(design.overlayColor, strength * 0.55));
    g.addColorStop(1, rgba(design.overlayColor, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.7);
  } else if (design.layout === "center") {
    ctx.fillStyle = rgba(design.overlayColor, strength);
    ctx.fillRect(0, 0, W, H);
  } else if (isSplit) {
    ctx.fillStyle = design.panelColor;
    ctx.fillRect(0, imageH, W, H - imageH);
  }

  // 3) 텍스트 배치 영역
  const pad = design.padding;
  const maxWidth = W - pad * 2;
  const regionTop = isSplit ? imageH + pad * 0.8 : pad;
  const regionBottom = H - pad;
  const reserved = (design.showPageNumber || design.showBrand) && !isSplit ? design.bodySize * 1.6 : 0;
  const maxHeight = regionBottom - regionTop - reserved;

  const block = layoutBlock(ctx, design, card.title, card.body, maxWidth, Math.max(120, maxHeight));

  const barH = Math.round(design.titleSize * 0.11);
  const barGap = Math.round(design.titleSize * 0.42);
  const showBar = design.showAccentBar && block.titleLines.length > 0;
  const blockH = block.height + (showBar ? barH + barGap : 0);

  let top: number;
  if (design.layout === "top") top = regionTop;
  else if (design.layout === "center") top = Math.max(regionTop, (H - blockH) / 2);
  else if (isSplit) top = imageH + (H - imageH - blockH) / 2;
  else top = regionBottom - reserved - blockH;

  const centered = design.align === "center";
  const anchorX = centered ? W / 2 : pad;
  ctx.textAlign = centered ? "center" : "left";

  // 4) 반투명 밴드 (band 레이아웃)
  if (design.layout === "band") {
    const bx = pad - design.bodySize * 0.9;
    const by = top - design.bodySize * 1.0;
    const bw = maxWidth + design.bodySize * 1.8;
    const bh = blockH + design.bodySize * 2.0;
    const r = Math.round(design.bodySize * 0.7);
    ctx.fillStyle = rgba(design.overlayColor, Math.max(0.35, strength));
    ctx.beginPath();
    ctx.roundRect(Math.max(pad / 3, bx), by, Math.min(W - (pad / 3) * 2, bw), bh, r);
    ctx.fill();
  }

  let y = top;

  // 5) 액센트 바
  if (showBar) {
    const barW = Math.round(design.titleSize * 1.15);
    ctx.fillStyle = design.accentColor;
    ctx.beginPath();
    ctx.roundRect(centered ? W / 2 - barW / 2 : pad, y, barW, barH, barH / 2);
    ctx.fill();
    y += barH + barGap;
  }

  // 6) 제목
  const w = weightsFor(design.fontFamily);
  if (block.titleLines.length) {
    ctx.font = fontSpec(w.title, block.titleSize, design.fontFamily);
    ctx.fillStyle = design.textColor;
    const lh = block.titleSize * Math.max(1.15, design.lineHeight - 0.15);
    for (const line of block.titleLines) {
      ctx.fillText(line, anchorX, y + (lh - block.titleSize) / 2);
      y += lh;
    }
  }

  // 7) 본문
  if (block.bodyLines.length) {
    if (block.titleLines.length) y += block.bodySize * GAP_RATIO;
    ctx.font = fontSpec(w.body, block.bodySize, design.fontFamily);
    ctx.fillStyle = rgba(design.textColor, 0.92);
    const lh = block.bodySize * design.lineHeight;
    for (const line of block.bodyLines) {
      ctx.fillText(line, anchorX, y + (lh - block.bodySize) / 2);
      y += lh;
    }
  }

  // 8) 브랜드 / 페이지 번호
  const metaSize = Math.round(Math.max(20, design.bodySize * 0.62));
  ctx.font = fontSpec(600, metaSize, design.fontFamily);
  const metaY = H - pad - metaSize;
  if (design.showBrand && brandName.trim()) {
    ctx.textAlign = "left";
    const dotR = metaSize * 0.28;
    ctx.fillStyle = design.accentColor;
    ctx.beginPath();
    ctx.arc(pad + dotR, metaY + metaSize / 2, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(isSplit ? design.textColor : design.textColor, 0.85);
    ctx.fillText(brandName.trim(), pad + dotR * 2 + metaSize * 0.4, metaY);
  }
  if (design.showPageNumber) {
    ctx.textAlign = "right";
    ctx.fillStyle = rgba(design.textColor, 0.7);
    ctx.fillText(`${index + 1} / ${total}`, W - pad, metaY);
  }

  return canvas;
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, W: number, H: number, design: CardDesign) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, rgba(design.accentColor, 0.35));
  g.addColorStop(1, "rgba(15, 23, 42, 0.95)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, W / 400);
  const step = W / 12;
  for (let x = -H; x < W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + H, 0);
    ctx.stroke();
  }
  ctx.restore();
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG 변환에 실패했습니다."));
    }, "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

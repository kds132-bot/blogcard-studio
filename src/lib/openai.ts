import OpenAI, { toFile } from "openai";
import { artStylePrompt, type ArtStyle, type Persona, type Quality } from "./types";

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-terra";
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

let _client: OpenAI | null = null;
export function openai(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.");
  if (!_client) _client = new OpenAI({ apiKey: key, timeout: 300_000, maxRetries: 1 });
  return _client;
}

/** 이미지 안에는 어떤 글자도 넣지 않는다 (한글은 웹 캔버스에서 합성) */
const NO_TEXT_RULE =
  "CRITICAL: the image must contain absolutely NO text of any kind — no letters, words, numbers, captions, subtitles, speech bubbles, signage, book or screen text, logos, watermarks, or UI chrome. Any surface that would normally carry writing must be left blank. The image has to be 100% text-free.";

export interface PlannedCard {
  title: string;
  body: string;
  imagePrompt: string;
}

export interface Plan {
  title: string;
  accentColor: string;
  cards: PlannedCard[];
}

const MAX_BLOG_CHARS = 14000;

/** 블로그 원문 + 페르소나 -> 카드뉴스 카피 & 영어 이미지 프롬프트 */
export async function planFromBlog(opts: {
  persona: Persona;
  blogText: string;
  count: number;
  artStyle: ArtStyle;
  useCharacter: boolean;
  characterDescription?: string | null;
}): Promise<Plan> {
  const { persona, blogText, count, artStyle, useCharacter, characterDescription } = opts;

  const article = blogText.trim().slice(0, MAX_BLOG_CHARS);
  if (article.length < 30) throw new Error("블로그 글이 너무 짧습니다. 조금 더 입력해 주세요.");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string", description: "카드뉴스 전체 제목 (한국어, 22자 이내)" },
      accentColor: {
        type: "string",
        description: "브랜드와 글의 분위기에 맞는 포인트 색상 HEX (예: #2563eb)",
      },
      cards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", description: "카드 제목 (한국어)" },
            body: { type: "string", description: "카드 본문 (한국어)" },
            imagePrompt: { type: "string", description: "영어 이미지 장면 묘사" },
          },
          required: ["title", "body", "imagePrompt"],
        },
      },
    },
    required: ["title", "accentColor", "cards"],
  } as const;

  const system = `당신은 블로그 글을 SNS 카드뉴스로 재구성하는 한국어 카피라이터이자 아트디렉터입니다.
주어진 블로그 원문을 읽고 핵심을 뽑아 정확히 ${count}장의 카드를 기획하세요.

[카피 규칙]
- title/body는 반드시 한국어. 브랜드 페르소나의 말투(tone)를 문장마다 유지하세요.
- 1번 카드는 표지입니다. 스크롤을 멈추게 하는 후킹 제목 + 한 문장 부제(body).
- 마지막 카드는 마무리와 행동 유도(CTA)로 끝냅니다.
- 중간 카드는 한 장에 메시지 하나만. 원문에 실제로 있는 내용만 쓰고 사실을 지어내지 마세요.
- title은 18자 이내, body는 2~3문장이며 공백 포함 95자를 넘기지 마세요.
- 이모지와 해시태그는 쓰지 마세요. 본문 줄바꿈이 필요하면 \\n 을 사용하세요.

[이미지 프롬프트 규칙]
- imagePrompt는 영어로, 이미지 생성 모델에게 줄 장면 묘사입니다 (40~70단어).
- 피사체, 행동, 구도, 조명, 색감을 구체적으로 쓰되 카드마다 장면이 달라야 합니다.
- 동시에 전체가 하나의 시리즈로 보이도록 색감과 분위기는 통일하세요.
- 이미지에는 글자가 절대 들어가면 안 되므로, 간판·책·화면·자막·로고처럼 글자가 필요한 소재를 요구하지 마세요.
- 그림체: ${artStylePrompt(artStyle)}
${
  useCharacter
    ? "- 모든 카드에 브랜드의 고정 캐릭터가 등장합니다. imagePrompt에서는 'the character' 가 무엇을 하고 어떤 표정·포즈인지만 쓰세요. 얼굴·머리·의상은 캐릭터 시트로 고정되므로 다시 묘사하지 마세요."
    : "- 사람이 등장한다면 얼굴이 화면을 가득 채우지 않게 하세요."
}`;

  const user = `[브랜드 페르소나]
- 브랜드명: ${persona.brandName || "(미입력)"}
- 소개: ${persona.description || "(미입력)"}
- 말투/톤: ${persona.tone || "친근하고 신뢰감 있는 존댓말"}
- 타깃 독자: ${persona.audience || "(미입력)"}
${characterDescription ? `\n[등장 캐릭터 참고]\n${characterDescription}\n` : ""}
[카드 장수] ${count}장

[블로그 원문]
${article}`;

  const res = await openai().responses.create({
    model: TEXT_MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    text: {
      format: { type: "json_schema", name: "cardnews_plan", strict: true, schema },
    },
  });

  let plan: Plan;
  try {
    plan = JSON.parse(res.output_text) as Plan;
  } catch {
    throw new Error("카드 기획 결과를 해석하지 못했습니다. 다시 시도해 주세요.");
  }
  if (!Array.isArray(plan.cards) || plan.cards.length === 0) {
    throw new Error("카드 기획 결과가 비어 있습니다.");
  }

  plan.cards = plan.cards.slice(0, count);
  while (plan.cards.length < count) {
    const last = plan.cards[plan.cards.length - 1];
    plan.cards.push({
      title: `카드 ${plan.cards.length + 1}`,
      body: "",
      imagePrompt: last?.imagePrompt ?? "a calm minimal desk scene, soft daylight",
    });
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(plan.accentColor || "")) plan.accentColor = "#3b82f6";
  if (!plan.title) plan.title = persona.brandName || "카드뉴스";
  return plan;
}

/** 업로드한 인물/캐릭터를 글로 고정해 두면 매 카드 프롬프트에서 동일성을 다시 못 박을 수 있다 */
export async function describeCharacter(imageDataUrl: string): Promise<string> {
  const res = await openai().responses.create({
    model: TEXT_MODEL,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Describe this person or character for an illustrator who must redraw them consistently across many images. Answer in English, one paragraph, max 85 words. Cover: gender presentation, apparent age, face shape, skin tone, hair (color, length, style), eyes, eyebrows, glasses or accessories, and the exact outfit (each garment and its colors). Ignore and do not mention the background.",
          },
          { type: "input_image", image_url: imageDataUrl, detail: "high" },
        ],
      },
    ],
  });
  return res.output_text.trim();
}

async function fetchAsFile(url: string, name: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`참고 이미지를 불러오지 못했습니다 (${r.status}).`);
  const buf = Buffer.from(await r.arrayBuffer());
  const type = r.headers.get("content-type")?.split(";")[0] || "image/png";
  return toFile(buf, name, { type });
}

function b64OrThrow(b64: string | undefined, what: string): Buffer {
  if (!b64) throw new Error(`${what} 생성에 실패했습니다. 다시 시도해 주세요.`);
  return Buffer.from(b64, "base64");
}

/** 업로드 이미지를 원하는 그림체의 캐릭터 시트(모델 시트)로 변환 */
export async function generateCharacterSheet(opts: {
  source: { buffer: Buffer; type: string; name: string };
  artStyle: ArtStyle;
  description: string;
  quality: Quality;
}): Promise<Buffer> {
  const { source, artStyle, description, quality } = opts;

  const prompt = `Create a professional character reference sheet (model sheet) of the person shown in the reference photo, redrawn in this art style: ${artStylePrompt(
    artStyle,
  )}.
Preserve the likeness faithfully: ${description}
Layout, on a plain flat light-gray background: a full-body front view, a full-body 3/4 view and a full-body side view standing in a neutral relaxed pose, plus a row of four head close-ups showing different expressions (neutral, warm smile, surprised, thinking).
Every view must show the exact same face, hairstyle, body proportions, outfit and colors. Even flat lighting, no cast shadows on the background, no props.
${NO_TEXT_RULE}`;

  const file = await toFile(source.buffer, source.name, { type: source.type });
  const res = await openai().images.edit({
    model: IMAGE_MODEL,
    image: file,
    prompt,
    size: "1536x1024",
    quality,
    output_format: "png",
    background: "opaque",
  });
  return b64OrThrow(res.data?.[0]?.b64_json, "캐릭터 시트");
}

function isBadSizeError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return msg.includes("size") && (msg.includes("invalid") || msg.includes("support") || msg.includes("must be"));
}

/** 카드 1장 이미지. 캐릭터 시트와 직전 카드를 참고 이미지로 물려 동일성/시리즈감을 유지한다. */
export async function generateCardImage(opts: {
  scene: string;
  artStyle: ArtStyle;
  modelSize: string;
  fallbackModelSize: string;
  quality: Quality;
  layout: "bottom" | "top" | "center" | "split" | "band";
  characterSheetUrl?: string | null;
  characterDescription?: string | null;
  styleRefUrl?: string | null;
  accentColor?: string;
}): Promise<Buffer> {
  const {
    scene,
    artStyle,
    modelSize,
    fallbackModelSize,
    quality,
    layout,
    characterSheetUrl,
    characterDescription,
    styleRefUrl,
    accentColor,
  } = opts;

  const keepClear =
    layout === "top"
      ? "the top 45% of the frame"
      : layout === "center"
        ? "the central area of the frame"
        : layout === "split"
          ? "the bottom third of the frame"
          : layout === "band"
            ? "the lower half of the frame"
            : "the bottom 45% of the frame";

  const refs: { url: string; name: string }[] = [];
  const refNotes: string[] = [];
  if (characterSheetUrl) {
    refs.push({ url: characterSheetUrl, name: "character-sheet.png" });
    refNotes.push(
      `Reference image ${refs.length} is the official character sheet for this series. The main subject MUST be this exact character: identical face, skin tone, hairstyle, body proportions, and the same outfit with the same colors as on the sheet. Never redesign, age, restyle or re-dress the character.${
        characterDescription ? ` For reference: ${characterDescription}` : ""
      }`,
    );
  }
  if (styleRefUrl) {
    refs.push({ url: styleRefUrl, name: "style-ref.png" });
    refNotes.push(
      `Reference image ${refs.length} is an earlier card from the same series. Match its rendering technique, line quality, color palette, lighting and level of detail so the new image clearly belongs to the same set — but do not copy its composition or repeat its scene.`,
    );
  }

  const prompt = `Illustration for one card in a Korean social-media card-news series.
Art style: ${artStylePrompt(artStyle)}.${accentColor ? ` Use ${accentColor} as a recurring accent color in the palette.` : ""}
Scene: ${scene}
Composition: leave ${keepClear} visually calm and uncluttered — soft, low-contrast background there with no important detail — because a text overlay is composited on top afterwards. Place the main subject clearly outside that area.
${refNotes.join("\n")}
${NO_TEXT_RULE}`;

  const client = openai();

  const run = async (size: string): Promise<string | undefined> => {
    if (refs.length > 0) {
      const files = await Promise.all(refs.map((r) => fetchAsFile(r.url, r.name)));
      const res = await client.images.edit({
        model: IMAGE_MODEL,
        image: files,
        prompt,
        size: size as never,
        quality,
        output_format: "png",
        background: "opaque",
      });
      return res.data?.[0]?.b64_json;
    }
    const res = await client.images.generate({
      model: IMAGE_MODEL,
      prompt,
      size: size as never,
      quality,
      output_format: "png",
      background: "opaque",
    });
    return res.data?.[0]?.b64_json;
  };

  try {
    return b64OrThrow(await run(modelSize), "이미지");
  } catch (e) {
    // 일부 크기를 모델이 거부하면 안전한 비율로 재시도한다 (렌더러가 어차피 잘라 맞춘다)
    if (modelSize !== fallbackModelSize && isBadSizeError(e)) {
      return b64OrThrow(await run(fallbackModelSize), "이미지");
    }
    throw e;
  }
}

import type { SizeKey } from "./types";

export interface SizePreset {
  key: SizeKey;
  label: string;
  /** PNG 내보내기 해상도 */
  width: number;
  height: number;
  /** gpt-image-2 에 요청할 크기 (16의 배수) */
  modelSize: string;
  /** 위 크기가 거부될 때 사용할 안전한 대체 크기 */
  fallbackModelSize: string;
  ratio: string;
}

export const SIZE_PRESETS: SizePreset[] = [
  {
    key: "square",
    label: "정사각형 1:1",
    width: 1080,
    height: 1080,
    modelSize: "1024x1024",
    fallbackModelSize: "1024x1024",
    ratio: "1:1",
  },
  {
    key: "portrait",
    label: "세로 4:5",
    width: 1080,
    height: 1350,
    modelSize: "1024x1280",
    fallbackModelSize: "1024x1536",
    ratio: "4:5",
  },
  {
    key: "story",
    label: "세로 9:16 (스토리/릴스)",
    width: 1080,
    height: 1920,
    modelSize: "1088x1920",
    fallbackModelSize: "1024x1536",
    ratio: "9:16",
  },
  {
    key: "landscape",
    label: "가로 16:9",
    width: 1920,
    height: 1080,
    modelSize: "1920x1088",
    fallbackModelSize: "1536x1024",
    ratio: "16:9",
  },
  {
    key: "blog",
    label: "블로그 썸네일 1.9:1",
    width: 1200,
    height: 630,
    modelSize: "1216x640",
    fallbackModelSize: "1536x1024",
    ratio: "1.9:1",
  },
];

export function getSize(key: SizeKey): SizePreset {
  return SIZE_PRESETS.find((s) => s.key === key) ?? SIZE_PRESETS[0];
}

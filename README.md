# 블로그 카드 스튜디오

블로그 글과 브랜드 페르소나를 넣으면 **카드뉴스 카피 + 이미지**를 만들어 주는 웹앱입니다.
이미지는 OpenAI **gpt-image-2** 로 생성하고, 한글은 이미지에 그리지 않고 **브라우저 캔버스에서 직접 합성**해
글자가 깨지지 않습니다. 완성된 카드는 PNG(낱장) 또는 ZIP(전체)으로 내려받습니다.

## 핵심 기능

- **페르소나 + 블로그 원문 → 카드 기획**: 말투·타깃을 반영한 한국어 카피와 카드별 영어 이미지 프롬프트를 생성합니다.
- **캐릭터 일관성**: 사진이나 캐릭터를 올리면 먼저 **캐릭터 시트(모델 시트)** 를 만들고,
  이후 모든 카드가 그 시트를 레퍼런스로 사용해 같은 얼굴·의상·그림체를 유지합니다.
  직전에 만든 카드도 스타일 레퍼런스로 함께 넘겨 시리즈 통일감을 잡습니다.
- **글자 없는 이미지 + 웹 합성**: 프롬프트에서 모든 텍스트를 금지하고, 제목·본문은 캔버스에서 실제 한글 폰트로 그립니다.
- **편집**: 카드별 제목·본문·이미지 프롬프트 수정, 이미지 재생성/직접 업로드, 순서 변경, 추가·삭제.
- **디자인**: 레이아웃 5종, 한글 폰트 7종, 색상·크기·여백·정렬을 전체 또는 카드 단위로 지정.
- **로그인 & 기록**: Supabase 인증과 함께 모든 프로젝트가 저장되어 언제든 이어서 편집할 수 있습니다.

## 기술 구성

| 영역 | 사용 기술 |
| --- | --- |
| 프레임워크 | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| 스타일 | Tailwind CSS v4 |
| 이미지 생성 | OpenAI `gpt-image-2` (`images.generate` / `images.edit`) |
| 카피 생성 | OpenAI Responses API + JSON Schema |
| 인증 / DB / 스토리지 | Supabase (Auth, Postgres + RLS, Storage) |
| 렌더링 | Canvas 2D (한글 합성), JSZip (일괄 내보내기) |

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값을 채우세요
npm run dev
```

### 환경변수

| 이름 | 설명 |
| --- | --- |
| `OPENAI_API_KEY` | 필수. 카피 생성과 이미지 생성에 사용 |
| `OPENAI_TEXT_MODEL` | 선택. 기본 `gpt-5.6-terra` |
| `OPENAI_IMAGE_MODEL` | 선택. 기본 `gpt-image-2` |
| `NEXT_PUBLIC_SUPABASE_URL` | 필수 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 필수 (구버전 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 도 인식) |

### Supabase 준비

1. 대시보드 **SQL Editor** 에서 [`supabase/schema.sql`](supabase/schema.sql) 을 실행합니다.
   `card_projects` 테이블(RLS 적용)과 공개 버킷 `blogcard` 이 만들어집니다.
2. **Authentication → URL Configuration** 에서 Site URL 과 Redirect URL 에
   배포 주소와 `http://localhost:3000` 을 등록합니다.

## 구조

```
src/
  app/
    api/projects        프로젝트 생성 · 조회 · 수정(방어적 병합) · 삭제
    api/plan            블로그 원문 → 카드 카피/프롬프트 기획
    api/character       업로드 이미지 → 캐릭터 설명 + 캐릭터 시트 생성
    api/image           카드 1장 이미지 생성 (캐릭터 시트/스타일 레퍼런스 사용)
    api/card-image      사용자가 직접 올린 이미지를 카드에 배치
    new                 생성 폼
    projects            기록 목록 / 편집기
  components/           CreateForm, Editor, CardCanvas, DesignPanel …
  lib/
    openai.ts           gpt-image-2 · 카피 기획 · 캐릭터 설명
    render.ts           캔버스 한글 합성 (줄바꿈, 자동 축소, 레이아웃)
    project.ts          프로젝트 로드/저장, 카드 방어적 병합
  proxy.ts              Supabase 세션 갱신 + 보호 라우트
```

## 동작 메모

- 이미지 프롬프트에는 텍스트 금지 규칙이 강하게 들어가며, 레이아웃에 따라
  "텍스트가 올라갈 영역은 비워 두라"는 지시가 함께 전달됩니다.
- 자동 저장과 이미지 생성이 겹쳐도 방금 만든 이미지가 사라지지 않도록,
  `PATCH` 는 카드 id 기준으로 병합하고 `imageUrl` 이 비어 오면 서버 값을 유지합니다.
- 모델이 특정 크기를 거부하면 안전한 비율로 자동 재시도하며, 렌더러가 카드 비율에 맞춰 잘라냅니다.

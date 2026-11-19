# Metis UI 디자인 시스템

Metis 데스크탑 앱(React, TypeScript, Tailwind CSS, Radix UI, Vite, Electron)의 화면 디자인 기준과, 그 기준을 앱 저장소에 적용하기 위한 자료입니다.
지금 있는 화면뿐 아니라 앞으로 추가될 화면과 컴포넌트도 같은 규칙을 따르도록 만드는 것이 목적입니다.

## 들어 있는 것

| 경로 | 내용 |
|---|---|
| `docs/design/DESIGN.md` | **단일 기준 문서.** 원칙, 토큰, 상태 규칙, 컴포넌트, 새 컴포넌트·새 화면 규칙, 화면 명세, 구현 지침 |
| `docs/design/metis-final-prototype.html` | 최종 시안. 내려받아 브라우저로 열면 모든 화면을 눌러 볼 수 있습니다 |
| `docs/design/CODEX_PROMPT.md` | 에이전트(Codex)에게 주는 최초 적용 지시서와 이후 작업용 짧은 프롬프트 |
| `docs/design/AGENTS.design.md` | 앱 저장소 루트의 `AGENTS.md`에 넣을 UI 규칙 |
| `docs/design/metis-tokens.css` | 색·크기·모서리 토큰(CSS 변수). 라이트, 다크, Aura |
| `docs/design/assets/` | 로고 이미지 |
| `scripts/design-check.mjs` | 디자인 규칙 자동 검사(의존성 없음, Node 18 이상) |

## 앱 저장소에 적용하는 방법

1. 이 저장소의 `docs/design/` 폴더와 `scripts/design-check.mjs`를 **Metis 앱 저장소의 같은 경로에** 복사합니다. 기존 파일을 덮어쓰지 않습니다.
2. 앱 저장소에서 Codex에 아래 한 줄을 입력합니다.

   ```
   docs/design/CODEX_PROMPT.md를 읽고 그대로 진행해.
   ```

3. 최초 적용이 끝나면 앱 저장소 루트의 `AGENTS.md`가 규칙을 매번 불러옵니다. 이후 새 기능의 화면을 만들 때는 `CODEX_PROMPT.md` 맨 아래의 짧은 프롬프트만 씁니다.

## 규칙을 유지하는 장치

- **약속**: `DESIGN.md` 6장(새 컴포넌트)과 7장(새 화면), 루트 `AGENTS.md`
- **강제**: 토큰(`metis-tokens.css`를 Tailwind에 연결), 공용 컴포넌트, `scripts/design-check.mjs`

```bash
# 처음 한 번: 기존 코드의 위반을 기준선으로 기록
node scripts/design-check.mjs <UI 소스 폴더> --baseline=scripts/design-baseline.json --update-baseline
# 이후: 기준선보다 늘어난 위반만 실패
node scripts/design-check.mjs <UI 소스 폴더> --baseline=scripts/design-baseline.json
```

## 규칙을 바꿀 때

토큰이나 규칙을 바꾸려면 `DESIGN.md`를 먼저 고치고 14장 변경 기록에 날짜, 바꾼 것, 이유를 적습니다. 그 다음에 코드에 반영합니다.

## 알아 둘 것

- 시안의 채팅 목록, 레시피, 모델 목록, 경로는 예시 데이터입니다.
- Aura 테마 값은 임시입니다(`DESIGN.md` 13.2).
- `assets/hct20-preview.png`는 저해상도 미리보기입니다. 앱에는 원본 로고를 씁니다.
- 검사 스크립트는 예시 파일로만 확인했습니다. 실제 코드에 처음 돌리면 잘못 잡는 경우가 있을 수 있고, 그 줄에 `design-check-ignore`와 이유를 적어 예외로 둘 수 있습니다.

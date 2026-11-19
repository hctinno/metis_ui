# Metis UI 디자인 시스템

Metis 데스크탑 앱(React, TypeScript, Tailwind CSS, Radix UI, Vite, Electron)의 화면 디자인 규칙과 보기용 시안, 그리고 이를 앱에 적용하기 위한 지시서입니다. 앱의 소스 코드는 이 저장소에 없습니다.

판: 2차 (2026-11-19). 1차를 독립 검토한 뒤 지적을 반영했습니다. 달라진 점은 `docs/design/DESIGN.md` 14장에 있습니다.

## 들어 있는 것

| 파일 | 내용 | 누가 읽나 |
|---|---|---|
| `docs/design/DESIGN.md` | **규칙.** 토큰, 상태, 컴포넌트, 새 컴포넌트·새 화면을 만드는 법, 접근성, 구현, 검사 | 모두 |
| `docs/design/metis-tokens.css` | 토큰 값의 원본(라이트, 다크) | 개발자, 에이전트 |
| `docs/design/metis-final-prototype.html` | 보기용 시안. 내려받아 브라우저로 엽니다 | 모두 |
| `docs/design/CODEX_PROMPT.md` | 코딩 에이전트에게 주는 단계별 작업 지시서 | 에이전트에게 일을 시키는 사람 |
| `docs/design/AGENTS.design.md` | 앱 저장소의 `AGENTS.md`에 붙여 넣을 상시 규칙 | 에이전트 |
| `docs/design/assets/` | 시안에 쓴 로고 이미지 | |
| `scripts/design-check.mjs` | 흔한 규칙 위반을 잡는 검사(의존성 없음, Node 18 이상) | 개발자, 에이전트 |
| `scripts/design-check.test.mjs` | 검사 스크립트 자체의 검사 | |

## 쓰는 법

1. 시안을 열어 모습을 봅니다. 왼쪽 아래 설정 > 앱 설정에서 테마를 바꿀 수 있습니다.
2. 앱 저장소에 `docs/design/`과 `scripts/`의 파일을 넣습니다.
3. `AGENTS.design.md`의 내용을 앱 저장소의 `AGENTS.md`에 붙입니다.
4. 에이전트에게 `CODEX_PROMPT.md`의 0단계를 시킵니다. 조사 결과를 보고 승인한 뒤 다음 단계로 갑니다.

```bash
node --test scripts/design-check.test.mjs
node scripts/design-check.mjs <UI 소스 폴더> --tokens docs/design/metis-tokens.css
```

## 알아 둘 것

- **규칙은 `DESIGN.md`이고 시안은 그림입니다.** 둘이 다르면 `DESIGN.md`를 따릅니다.
- 시안의 채팅, 프로젝트 경로, 모델 이름, 버전은 모두 꾸며 낸 예시입니다. 실제 앱의 데이터가 아닙니다.
- 시안을 열면 글꼴을 받으려고 Google Fonts에 요청이 나갑니다. 그 밖의 외부 요청은 없습니다.
- 자동 검사는 보조 도구입니다. 통과했다고 규칙을 지킨 것은 아닙니다(`DESIGN.md` 12.1).
- 시안은 Chromium(Chrome, Edge)에서 확인했습니다. 실제 Electron 앱과 Windows의 대비 테마·배율에서는 확인하지 않았습니다.
- 이 저장소에는 아직 라이선스가 없습니다. 로고 이미지를 포함해 사용 조건은 저장소 관리자가 정합니다(`DESIGN.md` 13.2).

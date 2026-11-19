# Metis UI 디자인 시스템

Metis 데스크탑 앱(React, TypeScript, Tailwind CSS, Radix UI, Vite, Electron)의 화면 디자인 규칙과 눌러 볼 수 있는 참고용 시안, 그리고 이를 앱에 적용하기 위한 지시서입니다. 앱의 소스 코드는 이 저장소에 없습니다.

판: 3차 (2026-11-20). 독립 검토를 두 번 거치며 고쳤습니다. 달라진 점은 `docs/design/DESIGN.md` 14장에 있습니다.

## 들어 있는 것

| 파일 | 내용 | 누가 읽나 |
|---|---|---|
| `docs/design/DESIGN.md` | **규칙.** 토큰, 상태, 컴포넌트, 새 컴포넌트·새 화면을 만드는 법, 접근성, 구현, 검사 | 모두 |
| `docs/design/ui/metis-tokens.css` | 토큰 값의 원본(라이트, 다크) | 개발자, 에이전트 |
| `docs/design/ui/metis-components.css` | 컴포넌트 스타일. 기존 컴포넌트에 `mt-` 클래스를 붙여 씁니다 | 개발자, 에이전트 |
| `docs/design/ui/gallery.html` | 컴포넌트 견본. 눌러 보고 마크업을 복사합니다 | 모두 |
| `docs/design/ui/README.md` | React·Radix에 붙이는 예와 클래스 목록 | 개발자 |
| `docs/design/metis-final-prototype.html` | 눌러 볼 수 있는 참고용 시안. 내려받아 브라우저로 열면 메뉴, 창, 설정, 테마 전환이 동작합니다 | 모두 |
| `docs/design/CODEX_PROMPT.md` | 코딩 에이전트에게 주는 단계별 작업 지시서 | 에이전트에게 일을 시키는 사람 |
| `docs/design/AGENTS.design.md` | 앱 저장소의 `AGENTS.md`에 붙여 넣을 상시 규칙 | 에이전트 |
| `docs/design/assets/` | 시안에 쓴 로고 이미지 | |
| `scripts/design-check.mjs` | 흔한 규칙 위반을 잡는 검사(의존성 없음, Node 18 이상) | 개발자, 에이전트 |
| `scripts/design-check.test.mjs` | 검사 스크립트 자체의 검사 | |

## 이미 만든 앱에 적용하는 법

**직접 적용할 때**
1. `docs/design/metis-final-prototype.html`(화면 전체)과 `docs/design/ui/gallery.html`(컴포넌트)을 내려받아 브라우저로 엽니다.
2. `docs/design/ui/`의 CSS 두 개를 앱에 넣고, 루트 요소에 `class="mt-root"`와 `data-theme`을 줍니다.
3. 기존 컴포넌트에 `mt-` 클래스를 붙입니다. 예와 클래스 목록은 `docs/design/ui/README.md`에 있습니다.
4. 화면 배치, 상태, 키보드, 문구는 `docs/design/DESIGN.md`를 따릅니다. 새 컴포넌트는 6장, 새 화면은 7장입니다.

**코딩 에이전트에게 맡길 때**
1. 앱 저장소에 이 저장소의 `docs/design/`과 `scripts/`를 넣습니다.
2. `AGENTS.design.md`의 내용을 앱 저장소의 `AGENTS.md`에 붙입니다.
3. 에이전트에게 `CODEX_PROMPT.md`의 0단계(조사만)를 시킵니다. 결과를 보고 승인한 뒤 다음 단계로 갑니다.

```bash
node --test scripts/design-check.test.mjs
node scripts/design-check.mjs <UI 소스 폴더> --tokens docs/design/ui/metis-tokens.css
```

**모습만 바꾸고 동작은 그대로 둡니다.** 문서가 권하는 동작 변경(승인 전 미리 보기, 작성 중 닫기 보호 등 10개)은 `DESIGN.md` 1장에 따로 모아 두었고, 정한 것만 적용합니다.

## 알아 둘 것

- **규칙은 `DESIGN.md`이고 시안은 눌러 볼 수 있는 참고용입니다.** 둘이 다르면 `DESIGN.md`를 따릅니다. 시안의 CSS는 옮겨 쓰지 않고, 옮겨 쓸 것은 `ui/metis-components.css`입니다.
- 시안의 채팅, 프로젝트 경로, 모델 이름, 버전은 모두 꾸며 낸 예시입니다. 실제 앱의 데이터가 아닙니다.
- 시안을 열면 글꼴을 받으려고 Google Fonts에 요청이 나갑니다. 그 밖의 외부 요청은 없습니다.
- 자동 검사는 보조 도구입니다. 통과했다고 규칙을 지킨 것은 아닙니다(`DESIGN.md` 12.1).
- 시안과 견본은 Chromium(Chrome, Edge)에서 확인했습니다. 실제 Electron 앱과 Windows의 대비 테마·배율, 화면 낭독기에서는 확인하지 않았습니다.
- 채팅이 진행 중인 화면은 실제 앱 화면을 보지 못하고 일반적인 구성으로 그렸습니다. 실제 화면과 다른 부분은 `DESIGN.md` 5.13의 규칙으로 맞춥니다.
- Tailwind 설정 예시는 빈 프로젝트에서 4.3.5와 3.4.19로 빌드해 확인했습니다. `ui/`의 CSS와 함께 실제 앱에 넣어 본 것은 아닙니다.
- 이 저장소에는 아직 라이선스가 없습니다. 로고 이미지를 포함해 사용 조건은 저장소 관리자가 정합니다(`DESIGN.md` 13.2).

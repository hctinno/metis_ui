# Metis 컴포넌트 CSS (참조 구현)

`docs/design/DESIGN.md` 4~5장의 컴포넌트를 CSS로 옮긴 것입니다. 이미 만들어진 React 앱의 컴포넌트에 클래스만 붙여 같은 모습을 낼 수 있습니다.

| 파일 | 내용 |
|---|---|
| `metis-tokens.css` | 색·글자·높이·모서리·층·움직임 토큰(라이트, 다크) |
| `metis-components.css` | `mt-` 클래스로 된 컴포넌트 스타일. 값은 모두 토큰 |
| `gallery.html` | 견본. 브라우저로 열어 눌러 보고, 마크업을 복사합니다 |

## 넣기

```ts
// 앱의 진입 파일(예: src/main.tsx). Tailwind의 CSS보다 먼저 또는 나중 어느 쪽이든 됩니다
import './styles/metis-tokens.css';
import './styles/metis-components.css';
```

```tsx
// 루트 요소에 mt-root와 테마를 줍니다. 테마 설정이 "시스템"이면 light나 dark로 풀어서 넣습니다
<div className="mt-root" data-theme={theme /* 'light' | 'dark' | 'aura' */}>…</div>
```

- 앱에 이미 테마 변수가 있으면 `metis-tokens.css`를 그대로 넣기 전에 `DESIGN.md` 11.2를 봅니다. 이름이 겹치는 변수(`--bg`, `--text` 등)가 있으면 기존 변수의 값을 토큰 값으로 맞추는 쪽이 안전합니다.
- Aura 테마의 색은 이 파일에 없습니다. 앱의 기존 값을 그대로 둡니다. `[data-theme="aura"]`는 새 토큰만 라이트 값을 물려받습니다.
- 글꼴(Inter, Noto Sans KR, Sora, JetBrains Mono)은 앱에 함께 넣어 `@font-face`로 불러옵니다. 견본은 글꼴 파일이 없으면 시스템 글꼴로 보입니다.

## 상태는 속성으로

CSS가 표준 속성과 Radix 속성을 직접 읽습니다. 조건부 클래스를 만들 필요가 없습니다.

| 상태 | 읽는 속성 |
|---|---|
| 켜짐, 선택됨 | `aria-checked`, `aria-selected`, `aria-pressed`, `aria-current="page"`, `data-state="checked" \| "on" \| "active"` |
| 열림 | `aria-expanded="true"`, `data-state="open"` |
| 메뉴 항목 강조 | `data-highlighted`, `:hover`, `:focus-visible` |
| 쓸 수 없음 | `:disabled`, `aria-disabled="true"`, `data-disabled` |
| 잘못된 값 | `aria-invalid="true"` |
| 처리 중 | `data-loading` (`.mt-btn`) |

## Radix에 붙이는 예

저장소가 쓰는 불러오기 방식(`radix-ui` 한 묶음 또는 `@radix-ui/react-*`)에 맞춰 바꿉니다. 아래는 모양을 보여 주는 예이고 이 저장소에서 빌드해 본 코드는 아닙니다.

```tsx
import * as Switch from '@radix-ui/react-switch';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';

// 토글: Radix가 data-state="checked"를 붙인다
<Switch.Root className="mt-switch" aria-label="작업 완료 알림" checked={on} onCheckedChange={setOn}>
  <Switch.Thumb className="mt-switch-thumb" />
</Switch.Root>

// ⋯ 메뉴: Portal로 띄우고, 닫히면 Radix가 포커스를 연 버튼으로 돌려준다
<DropdownMenu.Root>
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <DropdownMenu.Trigger asChild>
        <button className="mt-icon-btn mt-icon-btn--quiet" aria-label={`${chat.title} 메뉴`}><DotsIcon /></button>
      </DropdownMenu.Trigger>
    </Tooltip.Trigger>
    <Tooltip.Portal><Tooltip.Content className="mt-tooltip" sideOffset={8}>더 보기</Tooltip.Content></Tooltip.Portal>
  </Tooltip.Root>
  <DropdownMenu.Portal>
    <DropdownMenu.Content className="mt-menu" align="end" sideOffset={4}>
      <DropdownMenu.Item className="mt-menu-item" onSelect={rename}>이름 바꾸기…</DropdownMenu.Item>
      <DropdownMenu.Item className="mt-menu-item" onSelect={exportChat}>내보내기</DropdownMenu.Item>
      <DropdownMenu.Separator className="mt-menu-sep" />
      <DropdownMenu.Item className="mt-menu-item mt-menu-item--danger" onSelect={askDelete}>삭제</DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

// 입력을 받는 창: 주요 동작 왼쪽, 취소 오른쪽
<Dialog.Root open={open} onOpenChange={onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay className="mt-scrim" />
    <Dialog.Content className="mt-dialog" style={{ position: 'fixed', top: '50%', left: '50%', translate: '-50% -50%' }}>
      <div className="mt-dialog-head">
        <Dialog.Title className="mt-dialog-title">새 프로젝트</Dialog.Title>
        <Dialog.Close asChild><button className="mt-icon-btn" aria-label="닫기"><XIcon /></button></Dialog.Close>
      </div>
      <form className="mt-dialog-body" id="new-project" onSubmit={submit}>
        <div className="mt-field">
          <label className="mt-label" htmlFor="name">프로젝트 이름</label>
          <input className="mt-input" id="name" aria-invalid={!!error} aria-describedby={error ? 'name-err' : undefined} />
          {error && <span className="mt-error" id="name-err" role="alert">{error}</span>}
        </div>
      </form>
      <div className="mt-dialog-foot">
        <button className="mt-btn mt-btn--primary" type="submit" form="new-project">만들기</button>
        <Dialog.Close asChild><button className="mt-btn">취소</button></Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

// 되돌릴 수 없는 동작의 확인: AlertDialog. 열리면 포커스가 Cancel로 간다
<AlertDialog.Root open={asking} onOpenChange={setAsking}>
  <AlertDialog.Portal>
    <AlertDialog.Overlay className="mt-scrim" />
    <AlertDialog.Content className="mt-dialog" style={{ position: 'fixed', top: '50%', left: '50%', translate: '-50% -50%' }}>
      <div className="mt-dialog-head"><AlertDialog.Title className="mt-dialog-title">채팅을 삭제할까요?</AlertDialog.Title></div>
      <AlertDialog.Description className="mt-dialog-body">"{chat.title}" 채팅을 삭제합니다. 이 동작은 되돌릴 수 없습니다.</AlertDialog.Description>
      <div className="mt-dialog-foot">
        <AlertDialog.Action asChild><button className="mt-btn mt-btn--danger" onClick={remove}>삭제</button></AlertDialog.Action>
        <AlertDialog.Cancel asChild><button className="mt-btn">취소</button></AlertDialog.Cancel>
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
```

## 클래스 목록

| 컴포넌트 | 클래스 | DESIGN.md |
|---|---|---|
| 버튼 | `mt-btn` + `--primary` `--danger` `--ghost` `--sm` `--round` | 5.1 |
| 아이콘 버튼 | `mt-icon-btn` + `--sm` `--quiet` | 5.1 |
| 입력 | `mt-field` `mt-label` `mt-input`(+ `--search` `--num`) `mt-help` `mt-error` `mt-input-row` | 5.2, 7.4 |
| 토글, 체크 상자, 라디오 | `mt-switch` + `mt-switch-thumb`, `mt-checkbox`, `mt-radio` | 5.3 |
| 선택 카드, 구간 선택, 드롭다운 | `mt-option`, `mt-seg` + `mt-seg-item`, `mt-select` | 5.3 |
| 메뉴 | `mt-menu` `mt-menu-item`(+ `--danger`) `mt-menu-check` `mt-menu-label` `mt-menu-sep` | 5.4 |
| 카드와 행 | `mt-card`(+ `--hover`) `mt-row` `mt-row-main` `mt-row-title` `mt-row-desc` `mt-row-actions` `mt-empty` | 5.5, 5.14 |
| 사이드바 | `mt-nav-item` `mt-section-title` | 5.6 |
| 태그, 탭 | `mt-tag`(+ `--lg`), `mt-tabs` + `mt-tab` | 5.7, 5.8 |
| 창 | `mt-scrim` `mt-dialog` `mt-dialog-head` `mt-dialog-title` `mt-dialog-body` `mt-dialog-foot` | 5.9 |
| 토스트, 툴팁 | `mt-toast`, `mt-tooltip` | 5.10 |
| 상태 표시 | `mt-status` + `data-status="run \| wait \| done \| off \| error"` | 5.11 |
| 진행 | `mt-runbar`, `mt-progress`, `mt-typing`, `mt-streaming` | 3.8 |
| 입력창 | `mt-composer` `mt-composer-bar` `mt-chip` | 5.12 |
| 대화 | `mt-bubble` `mt-prose` `mt-code` `mt-diff` `mt-step` `mt-tool` `mt-approval` `mt-error-card` `mt-notice` `mt-divider-note` `mt-thinking` | 5.13 |
| 그 밖 | `mt-tree-item` `mt-bulkbar` `mt-display` `mt-heading` `mt-caption` `mt-group-title` `mt-kbd` `mt-mono` `mt-scroll` | 5.13, 5.14 |

## 확인한 것과 못 한 것

- 견본(`gallery.html`)을 Chromium에서 라이트·다크로 열어 글자 대비 4.5:1, 값 컨트롤 경계 3:1, 포커스 링, 글자·간격·모서리 눈금, 고대비(`forced-colors`) 에뮬레이션, 움직임 줄이기를 자동 검사했습니다.
- 실제 React·Radix·Electron 앱에 넣어 본 것은 아닙니다. Radix 부품이 붙이는 인라인 스타일이나 앱의 기존 전역 CSS와 부딪치는 곳이 있을 수 있습니다. 부딪치면 이 CSS를 고치지 말고 `DESIGN.md`의 값을 기준으로 그 컴포넌트만 맞춥니다.

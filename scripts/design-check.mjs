#!/usr/bin/env node
// Metis 디자인 규칙 검사 (docs/design/DESIGN.md 12장). 의존성 없음, Node 18 이상.
//
//   node scripts/design-check.mjs <UI 소스 폴더 또는 파일> [옵션]
//
// 옵션
//   --tokens <파일>          토큰 정의 파일. 이 파일은 색상 값을 쓸 수 있고, 여기에 없는 var(--이름) 사용을 잡는다
//   --token-file <파일>      색상 값을 쓸 수 있는 파일을 더 지정(여러 번 가능). 경로가 정확히 같아야 한다
//   --baseline <파일>        기준선과 비교해 늘어난 위반만 실패로 본다
//   --update-baseline        현재 상태를 기준선으로 기록(--baseline 필요). 위반이 늘면 거부한다
//   --allow-increase         --update-baseline에서 위반이 늘어도 기록(이유를 PR에 적는다)
//   --allow-tw-text          text-sm 같은 Tailwind 기본 크기 이름을 허용(저장소가 눈금 값으로 다시 정의한 경우만)
//   --json                   결과를 JSON으로 출력
//
// 예외: 그 줄 끝이나 바로 윗줄에 이유와 함께 적는다. 이유가 없으면 오류다.
//   color: '#000', // design-check-ignore: 서드파티 위젯에 넘기는 값
//   // design-check-ignore-next-line: 인쇄용 고정 색
//
// 종료 코드: 0 통과, 1 위반 있음, 2 사용법 오류
//
// 이 검사는 정규식으로 흔한 위반을 잡는 보조 도구다. 통과가 곧 규칙 준수는 아니다.
// 상태(올림·누름·포커스), 대비, 키보드 동작은 잡지 못한다. DESIGN.md 12.2의 사람 확인을 함께 한다.

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, basename, extname, sep } from 'node:path';

const SIZES = [11, 12, 13, 15, 17, 22, 26, 48];
const SPACES = [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 48];
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.scss']);
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', 'out', 'release', 'coverage', '.git', '.next', '.vite', '.turbo']);
const TOKEN_BASENAMES = new Set(['metis-tokens.css', 'tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs', 'tailwind.config.mjs']);
const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOR_UTIL = 'bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|decoration|divide|placeholder|caret|accent|shadow|inset-shadow|inset-ring';
const NAMED = 'aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen';
const COLOR_PROP = 'color|background|backgroundColor|background-color|borderColor|border-color|border|borderTop|borderBottom|borderLeft|borderRight|outline|outlineColor|outline-color|fill|stroke|caretColor|caret-color|boxShadow|box-shadow|textDecorationColor|accentColor';

const RULES = [
  { id: 'color-hex', level: 'error', msg: '색상 값을 직접 썼습니다. 토큰(var(--…) 또는 Tailwind 색 이름)을 쓰세요.', tokenFileOk: true,
    find(line, ctx) {
      const out = [];
      const add = (m) => out.push(m);
      if (/mask/i.test(line)) return out;
      if (ctx.css) for (const m of line.matchAll(/(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g)) { if (!/^\s*#[\w-]+\s*[{,]/.test(line)) add(m[0]); }
      if (!ctx.css) {
        for (const m of line.matchAll(/-\[(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4}))(?:\/\d+)?\]/g)) add(m[1]);
        for (const m of line.matchAll(/(['"`])(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4}))\1/g)) {
          const hex = m[2].slice(1);
          const decimalOnly = /^\d+$/.test(hex) && !/^(\d)\1+$/.test(hex) && hex.length <= 4;
          if (/(?:querySelector(?:All)?|closest|matches|getElementById)\(\s*$|(?:href|to|hash|id|htmlFor|target)\s*[=:]\s*\{?\s*$/.test(line.slice(0, m.index))) continue;
          const styleKey = new RegExp('(?:' + COLOR_PROP + ')[\'"]?\\s*[:=]').test(line.slice(0, m.index));
          if (!decimalOnly || styleKey) add(m[2]);
        }
      }
      return out;
    } },
  { id: 'color-named', level: 'error', msg: '색 이름을 직접 썼습니다. 토큰을 쓰세요.', tokenFileOk: true,
    find(line, ctx) {
      const re = ctx.css
        ? new RegExp('(?:^|[;{\\s])(?:' + COLOR_PROP + ')\\s*:\\s*[^;]*?(?<![\\w.-])(' + NAMED + ')(?![\\w.(-])', 'gi')
        : new RegExp('(?:' + COLOR_PROP + ')[\'"]?\\s*[:=]\\s*\\{?\\s*[\'"`][^\'"`]*?(?<![\\w.-])(' + NAMED + ')(?![\\w.(-])[^\'"`]*[\'"`]', 'gi');
      const out = [...line.matchAll(re)].filter((m) => !/var\(--/.test(m[0]) || ctx.css).map((m) => m[1]);
      for (const m of line.matchAll(new RegExp('color-mix\\([^)]*?[,\\s](' + NAMED + ')(?![\\w(-])', 'gi'))) out.push(m[1]);
      if (!ctx.css) for (const m of line.matchAll(new RegExp('-\\[(?:color:)?(' + NAMED + ')\\]', 'gi'))) out.push(m[1]);
      return out;
    } },
  { id: 'tw-palette', level: 'error', msg: 'Tailwind 기본 색을 썼습니다. 토큰에 연결한 색 이름을 쓰세요.',
    find: (line) => [...line.matchAll(new RegExp('(?<![\\w-])!?(?:' + COLOR_UTIL + ')-(?:' + PALETTE + ')-\\d{2,3}(?:\\/\\d+)?!?(?![\\w-])', 'g'))].map((m) => m[0]) },
  { id: 'tw-black-white', level: 'warn', msg: 'white/black을 직접 썼습니다. 테마에서 뒤집히지 않습니다. 토큰 색 이름을 쓰세요.',
    find: (line) => [...line.matchAll(new RegExp('(?<![\\w-])!?(?:' + COLOR_UTIL + ')-(?:white|black)(?:\\/\\d+)?(?![\\w-])', 'g'))].map((m) => m[0]) },
  { id: 'gradient', level: 'error', msg: '그라데이션은 쓰지 않습니다(가장자리를 흐리는 mask는 예외).',
    find: (line) => (/mask/i.test(line) ? [] : [...line.matchAll(/(?:repeating-)?(?:linear|radial|conic)-gradient\(|<(?:linear|radial)Gradient\b|(?<![\w-])bg-(?:gradient-to-[trbl]{1,2}|linear-[\w[(]|radial(?![\w])|conic(?![\w]))/g)].map((m) => m[0])) },
  { id: 'backdrop-blur', level: 'error', msg: '반투명 유리 효과는 쓰지 않습니다.',
    find: (line) => [...line.matchAll(/[bB]ackdrop-?[fF]ilter\s*:\s*(?!\s*['"]?none)[^;,}]+|(?<![\w-])backdrop-blur(?!-none)(?:-[\w[\]().]+)?/g)].map((m) => m[0].trim()) },
  { id: 'font-weight', level: 'error', msg: '굵기는 400, 500, 600, 700만 씁니다.',
    find: (line) => [...line.matchAll(/font-?[wW]eight\s*:\s*['"]?(?:100|200|300|800|900|lighter|bolder)\b|(?<![\w-])font-(?:thin|extralight|light|extrabold|black)(?![\w-])|(?<![\w-])font-\[(?:100|200|300|800|900)\]|(?<![\w-])font\s*:\s*['"`]?\s*(?:italic\s+)?(?:100|200|300|800|900)\s+\d/g)].map((m) => m[0]) },
  { id: 'font-size', level: 'error', msg: '글자 크기는 눈금(' + SIZES.join(', ') + 'px)만 씁니다.',
    find(line) {
      const out = [];
      for (const m of line.matchAll(/font-?[sS]ize\s*:\s*['"]?(-?\d*\.?\d+)(px|rem|em|pt|%)?/g)) {
        if (m[2] === '%') continue;
        const n = Number(m[1]); const unit = m[2] || (/fontSize/.test(m[0]) ? 'px' : '');
        if (unit !== 'px' || !SIZES.includes(n)) out.push(m[0]);
      }
      for (const m of line.matchAll(/(?<![\w-])text-\[(?:length:)?(-?\d*\.?\d+)(px|rem|em)\]/g)) { if (m[2] !== 'px' || !SIZES.includes(Number(m[1]))) out.push(m[0]); }
      return out;
    } },
  { id: 'tw-text-size', level: 'error', msg: 'Tailwind 기본 크기 이름입니다. 눈금 이름(text-caption, text-small, text-body, text-heading, text-subtitle, text-title, text-display)을 쓰세요.', optOut: 'allowTwText',
    find: (line) => [...line.matchAll(/(?<![\w-])text-(?:xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/g)].map((m) => m[0]) },
  { id: 'tw-arbitrary', level: 'error', msg: '임의 값입니다. 모서리·층·그림자는 토큰 이름을 쓰세요.',
    find: (line) => [...line.matchAll(/(?<![\w-])(?:rounded(?:-[trblse]{1,2})?-\[(?!var\()[^\]]+\]|z-\[(?!var\()[^\]]+\]|-?z-\d+(?![\w-])|shadow-\[(?!var\()[^\]]+\])/g)].map((m) => m[0]) },
  { id: 'tw-spacing', level: 'warn', msg: '간격 눈금(' + SPACES.join(', ') + 'px) 밖의 값입니다.',
    find: (line) => [...line.matchAll(/(?<![\w-])-?(?:p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|space-[xy])-(?:\[(-?\d*\.?\d+)px\]|(\d+(?:\.\d+)?)(?![\w.\/-]))/g)].filter((m) => !SPACES.includes(m[1] !== undefined ? Math.abs(Number(m[1])) : Number(m[2]) * 4)).map((m) => m[0]) },
  { id: 'tw-opacity', level: 'warn', msg: '반투명 토큰에 불투명도 수식을 덧붙였습니다. 토큰 값 그대로 쓰세요.',
    find: (line) => [...line.matchAll(/(?<![\w-])(?:bg|text|border|outline|ring)-(?:control(?:-hover|-press)?|well|row-hover|line-control|scrim|danger-soft)\/\d+/g)].map((m) => m[0]) },
  { id: 'tw-shadow', level: 'error', msg: 'Tailwind 기본 그림자입니다. 그림자는 떠 있는 것에만, 토큰 이름(shadow-pop, shadow-modal)으로 씁니다.',
    find: (line) => [...line.matchAll(/(?<![\w-])shadow-(?:2xs|xs|sm|md|lg|xl|2xl|inner)(?![\w-])/g)].map((m) => m[0]) },
  { id: 'tw-height', level: 'warn', msg: '컨트롤 높이 눈금 밖의 값입니다. 높이 토큰(h-control 등)을 쓰세요.',
    find: (line) => [...line.matchAll(/(?<![\w-])(?:min-)?h-\[(\d*\.?\d+)px\]/g)].filter((m) => Number(m[1]) <= 48 && ![16, 22, 24, 26, 28, 30, 34, 44, 48].includes(Number(m[1]))).map((m) => m[0]) },
  { id: 'motion', level: 'warn', msg: '꾸미는 움직임입니다. 움직임은 상태를 알릴 때만 씁니다.',
    find: (line) => [...line.matchAll(/(?<![\w-])animate-(?:bounce|ping|pulse)(?![\w-])|(?<![\w-])(?:group-)?hover:-?(?:translate-[xy]|scale|rotate|skew-[xy])-[\w[\].\/-]+/g)].map((m) => m[0]) },
  { id: 'native-select', level: 'error', msg: '운영체제 기본 셀렉트 대신 드롭다운 컴포넌트를 쓰세요.',
    find: (line) => [...line.matchAll(/<select(?![\w-])/g)].map((m) => m[0]) },
  { id: 'native-dialog', level: 'error', msg: 'alert/confirm/prompt 대신 확인 창 컴포넌트나 토스트를 쓰세요.',
    find(line, ctx) {
      return [...line.matchAll(/(?<![\w.$])(?:window\.|globalThis\.)?(alert|confirm|prompt)\s*\(/g)].filter((m) => !ctx.localNames.has(m[1]) || /window\.|globalThis\./.test(m[0])).map((m) => m[0]);
    } },
  { id: 'outline-none', level: 'warn', msg: '포커스 표시를 없앴습니다. focus-visible 표시가 따로 있는지 확인하세요.',
    find: (line) => (/focus-visible|:focus/.test(line) ? [] : [...line.matchAll(/(?<![\w-:])outline-none(?![\w-])|outline\s*:\s*['"]?(?:none|0)\b/g)].map((m) => m[0])) },
];

// 여러 줄에 걸친 태그: onClick이 달린 div/span 등
function clickOnDiv(text) {
  const out = [];
  const re = /<(div|span|li|p|img|section|article|td|tr)\b/g;
  for (let m; (m = re.exec(text)); ) {
    let i = m.index + m[0].length, depth = 0, quote = '';
    const max = Math.min(text.length, i + 4000);
    for (; i < max; i++) {
      const c = text[i];
      if (quote) { if (c === quote && text[i - 1] !== '\\') quote = ''; continue; }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth <= 0 && text[i - 1] !== '=') break;
    }
    const tag = text.slice(m.index, i);
    if (/\bonClick\s*=/.test(tag) && !/\brole\s*=/.test(tag)) out.push({ index: m.index, text: '<' + m[1] + ' … onClick' });
  }
  return out;
}

// 여러 줄에 걸칠 수 있는 색상 함수
function colorFuncs(text) {
  return [...text.matchAll(/(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*(?!var\()[^)]*\)/gi)].map((m) => ({ index: m.index, text: m[0].replace(/\s+/g, ' ') }));
}

// 아이콘만 든 버튼에 이름이 없는 경우, HTML 요소의 title 속성(운영체제 툴팁)
function tagChecks(text) {
  const out = [];
  for (const m of text.matchAll(/<button\b((?:[^>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*)>\s*<(?:svg|[A-Z]\w*)\b(?:[^>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*(?:\/>|>\s*<\/svg>)\s*<\/button>/g)) {
    if (!/aria-label(?:ledby)?\s*=/.test(m[1])) out.push({ index: m.index, rule: 'icon-button-label', text: '<button> 아이콘만', msg: '아이콘만 있는 버튼에는 aria-label과 툴팁이 필요합니다.' });
  }
  for (const m of text.matchAll(/<(?:button|a|input|div|span|img|li|p|textarea|label)\b(?:[^>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*?\stitle\s*=/g)) out.push({ index: m.index, rule: 'native-title', text: 'title=', msg: 'title 속성(운영체제 툴팁) 대신 툴팁 컴포넌트를 쓰세요.' });
  return out;
}

// 주석을 공백으로 바꾼다(줄 수와 열 위치 유지). 문자열 안의 // 는 건드리지 않는다.
function stripComments(text) {
  let out = '', i = 0, quote = '';
  while (i < text.length) {
    const c = text[i], d = text[i + 1];
    if (quote) { out += c; if (c === '\\') { out += d ?? ''; i += 2; continue; } if (c === quote) quote = ''; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && d === '*') { const end = text.indexOf('*/', i + 2); const stop = end < 0 ? text.length : end + 2; out += text.slice(i, stop).replace(/[^\n]/g, ' '); i = stop; continue; }
    if (c === '/' && d === '/' && text[i - 1] !== ':') { const end = text.indexOf('\n', i); const stop = end < 0 ? text.length : end; out += ' '.repeat(stop - i); i = stop; continue; }
    out += c; i++;
  }
  return out;
}

function fail(msg) { console.error('design-check: ' + msg); process.exit(2); }

function parseArgs(argv) {
  const o = { targets: [], tokenFiles: [], tokens: '', baseline: '', update: false, allowIncrease: false, allowTwText: false, json: false };
  const val = (i, name) => { const a = argv[i]; if (a.includes('=')) return [a.slice(a.indexOf('=') + 1), i]; if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) fail(name + ' 뒤에 값이 필요합니다.'); return [argv[i + 1], i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]; const key = a.split('=')[0];
    if (!a.startsWith('--')) { o.targets.push(a); continue; }
    if (key === '--tokens') [o.tokens, i] = val(i, key);
    else if (key === '--token-file') { let v; [v, i] = val(i, key); o.tokenFiles.push(v); }
    else if (key === '--baseline') [o.baseline, i] = val(i, key);
    else if (key === '--update-baseline') o.update = true;
    else if (key === '--allow-increase') o.allowIncrease = true;
    else if (key === '--allow-tw-text') o.allowTwText = true;
    else if (key === '--json') o.json = true;
    else if (key === '--help' || key === '-h') { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }
    else fail('모르는 옵션입니다: ' + a + ' (--help 참고)');
  }
  if (!o.targets.length) fail('검사할 폴더나 파일을 지정하세요. 예: node scripts/design-check.mjs src');
  if (o.update && !o.baseline) fail('--update-baseline에는 --baseline <파일>이 필요합니다.');
  return o;
}

function walk(p, out) {
  const st = statSync(p);
  if (st.isFile()) { if (EXT.has(extname(p))) out.push(p); return; }
  for (const name of readdirSync(p)) {
    if (SKIP_DIR.has(name) || name.startsWith('.')) continue;
    walk(join(p, name), out);
  }
}

function scan(opts) {
  const files = [];
  for (const t of opts.targets) { if (!existsSync(t)) fail('경로가 없습니다: ' + t); walk(resolve(t), files); }
  const root = opts.targets.length === 1 && statSync(opts.targets[0]).isDirectory() ? resolve(opts.targets[0]) : process.cwd();
  const tokenPaths = new Set([opts.tokens, ...opts.tokenFiles].filter(Boolean).map((p) => resolve(p)));
  for (const p of tokenPaths) if (!existsSync(p)) fail('토큰 파일이 없습니다: ' + p);
  let known = null;
  if (opts.tokens) { known = new Set([...readFileSync(resolve(opts.tokens), 'utf8').matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])); }
  const findings = [];
  let ignoredCount = 0;
  for (const file of files) {
    const rel = relative(root, file).split(sep).join('/');
    const raw = readFileSync(file, 'utf8');
    const rawLines = raw.split('\n');
    const text = stripComments(raw);
    const lines = text.split('\n');
    const isToken = tokenPaths.has(file) || TOKEN_BASENAMES.has(basename(file));
    const ctx = { css: /\.s?css$/.test(file), localNames: new Set() };
    for (const m of text.matchAll(/(?:function\s+|(?:const|let|var)\s+|import\s+(?:\{[^}]*\b)?)(alert|confirm|prompt)\b/g)) ctx.localNames.add(m[1]);
    const localVars = new Set([...text.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const ignored = (n) => {
      const here = rawLines[n].match(/design-check-ignore(?!-next-line)\s*:?\s*(.*)/);
      const prev = n > 0 ? rawLines[n - 1].match(/design-check-ignore-next-line\s*:?\s*(.*)/) : null;
      const hit = here || prev; if (!hit) return null;
      return hit[1].replace(/\*\/|-->|\}\s*$/g, '').trim().length >= 3 ? 'ok' : 'no-reason';
    };
    const push = (n, rule, level, textHit, msg) => {
      const ig = ignored(n);
      if (ig === 'ok') { ignoredCount++; return; }
      if (ig === 'no-reason') { findings.push({ file: rel, line: n + 1, rule: 'ignore-without-reason', level: 'error', text: rawLines[n].trim().slice(0, 80), msg: '예외에는 이유를 적어야 합니다: design-check-ignore: 이유' }); return; }
      findings.push({ file: rel, line: n + 1, rule, level, text: textHit, msg });
    };
    lines.forEach((line, n) => {
      for (const r of RULES) {
        if (r.tokenFileOk && isToken) continue;
        if (r.optOut && opts[r.optOut]) continue;
        for (const hit of r.find(line, ctx)) push(n, r.id, r.level, hit, r.msg);
      }
      if (known && !isToken) for (const m of line.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
        if (m[2] === ',') continue; // 대체 값이 있는 var(--x, 값)은 그 자리에서 정하는 변수다
        if (!known.has(m[1]) && !localVars.has(m[1]) && !/^--(?:tw|radix|color|text|radius|spacing|shadow|font|ease|animate|container|breakpoint|leading|tracking)-/.test(m[1])) push(n, 'unknown-token', 'error', m[1], '토큰 파일에 없는 변수입니다. 토큰을 먼저 추가하세요(DESIGN.md 6.6).');
      }
    });
    const lineOf = (i) => text.slice(0, i).split('\n').length - 1;
    if (!isToken) for (const hit of colorFuncs(text)) push(lineOf(hit.index), 'color-func', 'error', hit.text, '색상 함수를 직접 썼습니다. 토큰을 쓰세요.');
    if (/\.[jt]sx$/.test(file)) for (const hit of tagChecks(text)) push(lineOf(hit.index), hit.rule, 'warn', hit.text, hit.msg);
    if (/\.[jt]sx$/.test(file)) for (const hit of clickOnDiv(text)) push(text.slice(0, hit.index).split('\n').length - 1, 'click-on-div', 'warn', hit.text, '누를 수 있는 것은 button이나 Radix 부품으로 만드세요.');
  }
  return { files, findings, root, ignoredCount };
}

function tally(findings) {
  const t = {};
  for (const f of findings) { if (f.level !== 'error') continue; const k = f.file + '::' + f.rule; t[k] = (t[k] || 0) + 1; }
  return t;
}

const opts = parseArgs(process.argv.slice(2));
const { files, findings, ignoredCount } = scan(opts);
const errors = findings.filter((f) => f.level === 'error');
const warns = findings.filter((f) => f.level === 'warn');
const now = tally(findings);
const total = (t) => Object.values(t).reduce((a, b) => a + b, 0);

if (files.length === 0) fail('검사한 파일이 0개입니다. 경로를 확인하세요: ' + opts.targets.join(', '));

let base = null;
if (opts.baseline && existsSync(opts.baseline)) {
  try { const j = JSON.parse(readFileSync(opts.baseline, 'utf8')); if (!j || typeof j.counts !== 'object') throw new Error('counts 없음'); base = j.counts; }
  catch (e) { fail('기준선 파일을 읽을 수 없습니다(' + opts.baseline + '): ' + e.message + '. 파일을 지우고 --update-baseline으로 다시 기록하세요.'); }
} else if (opts.baseline && !opts.update) fail('기준선 파일이 없습니다: ' + opts.baseline + ' (처음이면 --update-baseline으로 기록)');

if (opts.update) {
  const up = base ? Object.entries(now).filter(([k, n]) => n > (base[k] || 0)) : [];
  if (up.length && !opts.allowIncrease) {
    console.error('design-check: 늘어난 위반이 있어 기준선을 기록하지 않았습니다(' + up.slice(0, 5).map(([k, n]) => k.replace('::', ' ') + ' ' + (base[k] || 0) + '→' + n).join(', ') + (up.length > 5 ? ' 외 ' + (up.length - 5) + '개' : '') + '). 늘어난 위반을 고치세요. 꼭 필요하면 --allow-increase를 쓰고 이유를 PR에 적으세요.');
    process.exit(1);
  }
  writeFileSync(opts.baseline, JSON.stringify({ note: '디자인 검사 기준선. 줄이는 방향으로만 갱신한다.', files: files.length, total: total(now), counts: Object.fromEntries(Object.entries(now).sort()) }, null, 2) + '\n');
  console.log('기준선을 기록했습니다: ' + opts.baseline + ' (파일 ' + files.length + '개, 오류 ' + total(now) + '건' + (base ? ', 이전 ' + total(base) + '건' : '') + ')');
  process.exit(0);
}

let failing = errors, grown = [], shrunk = 0;
if (base) {
  for (const [k, n] of Object.entries(now)) if (n > (base[k] || 0)) grown.push([k, base[k] || 0, n]);
  for (const [k, n] of Object.entries(base)) if ((now[k] || 0) < n) shrunk++;
  const keys = new Set(grown.map((g) => g[0]));
  failing = errors.filter((f) => keys.has(f.file + '::' + f.rule));
}

if (opts.json) {
  console.log(JSON.stringify({ files: files.length, errors: errors.length, warnings: warns.length, ignored: ignoredCount, failing: failing.length, grown, findings }, null, 2));
} else {
  const show = (f) => console.log(`${f.file}:${f.line}  ${f.level === 'error' ? '오류' : '알림'}  ${f.rule}  ${f.text}\n    ${f.msg}`);
  (base ? failing : errors).forEach(show);
  warns.forEach(show);
  console.log('');
  console.log(`파일 ${files.length}개, 오류 ${errors.length}건, 알림 ${warns.length}건, 예외 처리 ${ignoredCount}건` + (base ? `, 기준선 ${total(base)}건 대비 늘어난 항목 ${grown.length}개` : ''));
  if (base && grown.length) grown.forEach(([k, a, b]) => console.log(`  늘어남: ${k.replace('::', '  ')}  ${a} → ${b}`));
  if (base && shrunk && !grown.length) console.log(`줄어든 항목이 ${shrunk}개 있습니다. --update-baseline으로 기준선을 낮추세요.`);
}
process.exit(failing.length ? 1 : 0);

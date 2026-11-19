#!/usr/bin/env node
/**
 * Metis 디자인 규칙 검사 (docs/design/DESIGN.md 12장)
 *
 * 사용:
 *   node scripts/design-check.mjs [검사할 폴더...] [옵션]
 *   node scripts/design-check.mjs src
 *   node scripts/design-check.mjs src --baseline=scripts/design-baseline.json --update-baseline   기존 위반을 기준선으로 기록
 *   node scripts/design-check.mjs src --baseline=scripts/design-baseline.json                     기준선보다 늘어난 위반만 실패
 *
 * 옵션:
 *   --allow=a,b        경로에 이 문자열이 들어간 파일은 색상 값 직접 쓰기를 허용(토큰 정의 파일). 기본: tokens,theme,tailwind.config
 *   --baseline=파일     기준선 파일
 *   --update-baseline  현재 상태를 기준선으로 저장하고 종료(항상 성공)
 *   --json             결과를 JSON으로 출력
 *
 * 한 줄만 예외로 두려면 그 줄에 design-check-ignore 라고 주석을 단다. 이유를 함께 적는다.
 * 의존성 없음. Node 18 이상.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const hit = args.find((a) => a.startsWith('--' + name + '=')); return hit ? hit.slice(name.length + 3) : fallback; };
const flag = (name) => args.includes('--' + name);
const roots = args.filter((a) => !a.startsWith('--'));
if (roots.length === 0) roots.push('src');
const allow = opt('allow', 'tokens,theme,tailwind.config').split(',').map((s) => s.trim()).filter(Boolean);
const baselinePath = opt('baseline', '');
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.html', '.vue', '.svelte']);
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', 'out', '.git', '.vite', 'coverage', '.next']);
const CODE = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.html']);

const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const UTIL = 'bg|text|border|ring|fill|stroke|from|to|via|outline|divide|shadow|decoration|accent|caret|placeholder';
const FONT_PX = new Set([11, 12, 13, 15, 17, 22, 26]);

/** level: error는 실패, warn은 알림만. tokenFileOk: 토큰 정의 파일에서는 허용 */
const RULES = [
  { id: 'color-literal', level: 'error', tokenFileOk: true, why: '색을 직접 썼습니다. 토큰을 쓰세요(DESIGN.md 3.1).',
    test: (line) => /(?<![\w&])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/.test(line.replace(/href=["']#[\w-]*["']|url\(#[\w-]*\)|id=["']#?[\w-]+["']/g, '')) || /\b(?:rgba?|hsla?|oklch|oklab)\(\s*[\d.]/.test(line) },
  { id: 'tw-palette', level: 'error', tokenFileOk: false, why: 'Tailwind 기본 색을 썼습니다. 토큰에 연결된 색 이름을 쓰세요(DESIGN.md 11.2).',
    test: (line) => new RegExp(`(?:^|[\\s"'\`:])(?:${UTIL})-(?:${PALETTE})-(?:50|[1-9]00|950)\\b`).test(line) },
  { id: 'tw-black-white', level: 'warn', tokenFileOk: false, why: 'white/black을 직접 썼습니다. 테마가 바뀌어도 맞는지 확인하세요.',
    test: (line) => new RegExp(`(?:^|[\\s"'\`:])(?:${UTIL})-(?:white|black)\\b`).test(line) },
  { id: 'gradient', level: 'error', tokenFileOk: false, why: '그라데이션은 쓰지 않습니다(DESIGN.md 2장).',
    test: (line) => /(?:linear|radial|conic)-gradient\(|\bbg-gradient-to-|\bbg-(?:linear|radial|conic)\b/.test(line) },
  { id: 'backdrop-blur', level: 'error', tokenFileOk: false, why: '반투명 유리 효과는 쓰지 않습니다(DESIGN.md 2장).',
    test: (line) => /backdrop-filter\s*:|\bbackdrop-blur\b|\bbackdrop-(?:saturate|brightness)/.test(line) },
  { id: 'light-weight', level: 'error', tokenFileOk: false, why: '가는 글자 굵기는 쓰지 않습니다(DESIGN.md 3.3).',
    test: (line) => /\bfont-(?:thin|extralight|light)\b|font-weight\s*:\s*[123]00\b|fontWeight\s*:\s*['"]?[123]00\b/.test(line) },
  { id: 'font-size', level: 'error', tokenFileOk: true, why: '글자 크기 단계 밖의 값입니다. 11, 12, 13, 15, 17, 22, 26px 중에서 고르세요(DESIGN.md 3.3).',
    test: (line) => { const m = [...line.matchAll(/\btext-\[(\d+(?:\.\d+)?)px\]|font-size\s*:\s*(\d+(?:\.\d+)?)px|fontSize\s*:\s*['"]?(\d+(?:\.\d+)?)(?:px)?['"]?/g)]; return m.some((x) => !FONT_PX.has(Number(x[1] ?? x[2] ?? x[3]))); } },
  { id: 'native-select', level: 'error', tokenFileOk: false, codeOnly: true, why: '운영체제 기본 셀렉트 대신 드롭다운 컴포넌트를 쓰세요(DESIGN.md 5.3).',
    test: (line) => /<select[\s>]/.test(line) },
  { id: 'native-dialog', level: 'error', tokenFileOk: false, codeOnly: true, why: 'alert/confirm 대신 확인 창 컴포넌트를 쓰세요(DESIGN.md 7.4).',
    test: (line) => /\b(?:window\.)?(?:alert|confirm)\(\s*['"`]/.test(line) },
  { id: 'click-on-div', level: 'warn', tokenFileOk: false, codeOnly: true, why: 'div/span에 클릭을 달았습니다. button으로 만드세요(DESIGN.md 10장).',
    test: (line) => /<(?:div|span)\b[^>]*\bonClick=/.test(line) },
];

function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { if (!SKIP_DIR.has(name)) walk(p, out); }
    else if (EXT.has(extname(name)) && !/\.(?:min|d)\.(?:js|ts|css)$/.test(name)) out.push(p);
  }
  return out;
}

const files = roots.flatMap((r) => (!existsSync(r) ? [] : statSync(r).isFile() ? [r] : walk(r, [])));
const missing = roots.filter((r) => !existsSync(r));
const findings = [];
for (const file of files) {
  const rel = relative(process.cwd(), file).split(sep).join('/');
  const isTokenFile = allow.some((a) => rel.includes(a));
  const isCode = CODE.has(extname(file));
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes('design-check-ignore')) return;
    for (const rule of RULES) {
      if (rule.tokenFileOk && isTokenFile) continue;
      if (rule.codeOnly && !isCode) continue;
      if (rule.test(line)) findings.push({ file: rel, line: i + 1, rule: rule.id, level: rule.level, why: rule.why, text: line.trim().slice(0, 140) });
    }
  });
}

const key = (f) => f.file + '::' + f.rule;
const counts = {};
for (const f of findings) if (f.level === 'error') counts[key(f)] = (counts[key(f)] || 0) + 1;

if (flag('update-baseline')) {
  if (!baselinePath) { console.error('--baseline=파일 을 함께 지정하세요.'); process.exit(2); }
  writeFileSync(baselinePath, JSON.stringify({ note: '기존 위반 수. 줄이는 것만 허용됩니다. node scripts/design-check.mjs <폴더> --baseline=<이 파일> --update-baseline 로 갱신.', counts }, null, 2) + '\n');
  console.log(`기준선 저장: ${baselinePath} (위반 ${Object.values(counts).reduce((a, b) => a + b, 0)}건, 파일·규칙 ${Object.keys(counts).length}쌍)`);
  process.exit(0);
}

let base = null;
if (baselinePath) {
  if (!existsSync(baselinePath)) { console.error(`기준선 파일이 없습니다: ${baselinePath}. 먼저 --update-baseline 으로 만드세요.`); process.exit(2); }
  base = JSON.parse(readFileSync(baselinePath, 'utf8')).counts || {};
}
const over = new Set(base ? Object.keys(counts).filter((k) => counts[k] > (base[k] || 0)) : Object.keys(counts));
const errors = findings.filter((f) => f.level === 'error' && over.has(key(f)));
const warns = findings.filter((f) => f.level === 'warn');
const summary = { files: files.length, errors: errors.length, warnings: warns.length, baseline: base ? baselinePath : null, missingRoots: missing };

if (flag('json')) {
  console.log(JSON.stringify({ summary, errors, warnings: warns }, null, 2));
} else {
  const show = (list, label) => { for (const f of list) console.log(`${label} ${f.file}:${f.line} [${f.rule}] ${f.why}\n      ${f.text}`); };
  show(errors, '오류');
  show(warns.slice(0, 50), '알림');
  if (warns.length > 50) console.log(`알림 ${warns.length - 50}건 더 있음(--json 으로 전체 확인)`);
  if (base) for (const k of over) console.log(`기준선 초과: ${k} (기준 ${base[k] || 0} → 현재 ${counts[k]})`);
  for (const r of missing) console.log(`주의: 폴더가 없습니다: ${r}`);
  console.log(`\n검사 파일 ${summary.files}개, 오류 ${summary.errors}건, 알림 ${summary.warnings}건${base ? ' (기준선 적용)' : ''}`);
}
if (files.length === 0) { console.error('검사할 파일이 없습니다. 폴더 경로를 확인하세요.'); process.exit(2); }
process.exit(errors.length > 0 ? 1 : 0);

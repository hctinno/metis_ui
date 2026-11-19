// design-check.mjs 자체 검사. 실행: node --test scripts/design-check.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'design-check.mjs');
const run = (args, cwd) => { const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' }); return { code: r.status, out: r.stdout + r.stderr }; };
const make = (files) => { const d = mkdtempSync(join(tmpdir(), 'dc-')); for (const [name, text] of Object.entries(files)) { mkdirSync(dirname(join(d, name)), { recursive: true }); writeFileSync(join(d, name), text); } return d; };
const rules = (dir, extra = []) => { const r = run(['src', '--json', ...extra], dir); const j = JSON.parse(r.out); return { code: r.code, hits: j.findings.map((f) => f.rule + '|' + f.text), ids: j.findings.map((f) => f.rule), j }; };

test('잡아야 하는 것', () => {
  const d = make({ 'src/Bad.tsx': [
    'const a = { color: "#ff0000", background: "red", fontWeight: 300, fontSize: 14, backdropFilter: "blur(8px)" };',
    'const b = <div className="bg-blue-500 text-sm !text-gray-400 border-t-red-500 hover:bg-sky-100/50 rounded-[7px] z-[999] font-light text-[14px] bg-[#123456] backdrop-blur-md bg-gradient-to-r" />;',
    'const c = "rgb(10, 20, 30)"; const s = { boxShadow: "0 0 0 1px rgba(0,0,0,.2)" };',
    'if (confirm(t("delete.confirm"))) { window.alert("x"); }',
    'const el = (',
    '  <select',
    '    value={v}>',
    '  </select>',
    ');',
    'const row = (',
    '  <div',
    '    className="row"',
    '    onClick={() => go()}',
    '  >x</div>',
    ');',
  ].join('\n'), 'src/a.css': '.x{color:#fff;background:linear-gradient(red,blue);font-size:1.2em;font-weight:800;outline:none}\n.y{color: white}\n' });
  const { code, ids, hits } = rules(d);
  assert.equal(code, 1);
  for (const id of ['color-hex', 'color-named', 'color-func', 'font-weight', 'font-size', 'backdrop-blur', 'tw-palette', 'tw-text-size', 'tw-arbitrary', 'gradient', 'native-dialog', 'native-select', 'click-on-div', 'outline-none']) assert.ok(ids.includes(id), id + ' 누락: ' + hits.join(' , '));
  assert.equal(ids.filter((i) => i === 'tw-palette').length, 4, hits.filter((h) => h.startsWith('tw-palette')).join(','));
  assert.equal(ids.filter((i) => i === 'native-dialog').length, 2);
  assert.ok(hits.includes('tw-arbitrary|rounded-[7px]') && hits.includes('tw-arbitrary|z-[999]'));
});

test('잡지 말아야 하는 것', () => {
  const d = make({ 'src/Good.tsx': [
    '// 이슈 #1234 참고, 색은 #fff 가 아니라 토큰으로',
    'const issue = "#1234"; const anchor = "#section"; const url = "https://example.com/a#b";',
    'const a = <button className="bg-control hover:bg-control-hover text-body text-ink rounded-control z-[var(--z-menu)] shadow-pop backdrop-blur-none text-[13px] font-medium" />;',
    'const s = { color: "var(--text)", background: "rgb(var(--x) / .5)", fontSize: 13, fontWeight: 600, maskImage: "linear-gradient(to bottom, black, transparent)" };',
    'const api = { confirm: () => 1 }; api.confirm(); dialog.alert("x");',
    'const b = <div role="button" tabIndex={0} onClick={go} />;',
    'const c = <button className="outline-none focus-visible:outline-2" />;',
    'const logo = { background: "url(hct-gold.png)" };',
  ].join('\n'), 'src/metis-tokens.css': ':root{--bg:#F5F5F6;--pop:0 0 0 1px rgba(0,0,0,.1)}\n', 'src/b.css': '#main{color:var(--text)}\n.z{backdrop-filter:none;-webkit-mask-image:linear-gradient(#000,transparent)}\n' });
  const { code, hits } = rules(d);
  assert.deepEqual(hits, []);
  assert.equal(code, 0);
});

test('직접 정의한 confirm은 넘어가고 window.confirm은 잡는다', () => {
  const d = make({ 'src/a.ts': 'function confirm(x) { return x; }\nconfirm(1);\nwindow.confirm("x");\n' });
  assert.deepEqual(rules(d).hits, ['native-dialog|window.confirm(']);
});

test('예외에는 이유가 필요하다', () => {
  const d = make({ 'src/a.ts': 'const a = "#ff0000"; // design-check-ignore: 서드파티 위젯 고정 색\nconst b = "#00ff00"; // design-check-ignore\n// design-check-ignore-next-line: 인쇄용\nconst c = "#0000ff";\n' });
  assert.deepEqual(rules(d).ids, ['ignore-without-reason']);
});

test('토큰 파일은 정확한 경로만 허용하고, 없는 토큰 사용을 잡는다', () => {
  const d = make({ 'src/theme-settings/Panel.tsx': 'const a = { color: "#ff0000" };', 'src/lib/tokens/count.ts': 'const b = "#00ff00";', 'src/styles/vars.css': ':root{--bg:#fff}', 'src/x.css': '.a{color:var(--bg);border-color:var(--nope);--local:1px;margin:var(--local)}' });
  const r = rules(d, ['--tokens', 'src/styles/vars.css']);
  assert.deepEqual(r.hits.sort(), ['color-hex|#00ff00', 'color-hex|#ff0000', 'unknown-token|--nope']);
});

test('기준선: 0개 파일·없는 폴더·깨진 파일·모르는 옵션은 오류', () => {
  const d = make({ 'src/a.ts': 'const a = "#ff0000";\n', 'empty/readme.md': 'x' });
  assert.equal(run(['nope', '--baseline', 'b.json', '--update-baseline'], d).code, 2);
  assert.equal(run(['empty', '--baseline', 'b.json', '--update-baseline'], d).code, 2);
  assert.equal(run(['src', '--basline', 'b.json'], d).code, 2);
  assert.equal(run(['src', '--baseline'], d).code, 2);
  writeFileSync(join(d, 'broken.json'), '{');
  assert.equal(run(['src', '--baseline', 'broken.json'], d).code, 2);
  assert.equal(run(['src', '--baseline', 'missing.json'], d).code, 2);
});

test('기준선: 늘면 실패, 늘어난 채로는 다시 기록하지 못한다', () => {
  const d = make({ 'src/a.ts': 'const a = "#ff0000";\n' });
  assert.equal(run(['src', '--baseline=b.json', '--update-baseline'], d).code, 0);
  assert.equal(JSON.parse(readFileSync(join(d, 'b.json'), 'utf8')).counts['a.ts::color-hex'], 1);
  assert.equal(run(['src', '--baseline', 'b.json'], d).code, 0);
  writeFileSync(join(d, 'src/a.ts'), 'const a = "#ff0000"; const b = "#00ff00";\n');
  assert.equal(run(['src', '--baseline', 'b.json'], d).code, 1, '같은 줄에 하나 더 늘어도 잡아야 한다');
  assert.equal(run(['src', '--baseline', 'b.json', '--update-baseline'], d).code, 1);
  assert.equal(run(['src', '--baseline', 'b.json', '--update-baseline', '--allow-increase'], d).code, 0);
  writeFileSync(join(d, 'src/new.ts'), 'const c = "#0000ff";\n');
  assert.equal(run(['src', '--baseline', 'b.json'], d).code, 1, '새 파일의 위반도 잡아야 한다');
});

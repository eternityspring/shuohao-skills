#!/usr/bin/env node
/**
 * Chuyển kịch bản người dùng dán (script.md) thành "nguồn đọc" cho novel-characters:
 * mỗi câu thoại thành một dòng "Tên: câu", để persona.evidence có thể trích **nguyên văn** mà vẫn
 * đúng ngữ pháp tiếng Việt. Không gọi model.
 *
 *   node preview/pipeline/book.mjs <project> [--out book.txt]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function bookFromScript(scriptText) {
  const raw = String(scriptText ?? '').replace(/\r\n?/g, '\n');
  const out = [];
  for (const line of raw.split('\n')) {
    // chấp nhận "1. ", "- 1. ", "1) "; không lấy dòng đánh số kiểu "3.5 秒"
    const m = line.match(/^\s*(?:[-*]\s*)?(\d{1,3})[.)、]\s+(\S.+)$/);
    if (!m) continue;
    const text = m[2].trim();
    if (/^\d/.test(text)) continue;
    const sp = text.match(/^([^:：]{1,24})\s*[:：]\s*[“"'「『]?([^:：]+?)[”"'」』]?$/);
    if (sp) out.push(`${sp[1].trim()}: ${sp[2].trim()}`);
    else out.push(text);
  }
  return out.join('\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('cách dùng: node preview/pipeline/book.mjs <project> [--out book.txt]');
    process.exit(1);
  }
  const root = resolve(dir);
  // kichban.md là bản người dùng dán; script.md là báo cáo render (đánh số dạng khác)
  const source = ['kichban.md', 'script.md'].map((f) => join(root, f)).find((f) => existsSync(f));
  if (!source) {
    // project dựng từ file tầng (không có văn bản gốc): lấy lời thoại từ script.json
    const sj = join(root, 'script.json');
    if (!existsSync(sj)) { console.error(`✗ ${root} không có script.md lẫn script.json`); process.exit(1); }
    const doc = JSON.parse(readFileSync(sj, 'utf8'));
    const names = new Map(((doc.characters ?? []).map((c) => [c.id, c.name])));
    const lines = [];
    for (const ep of doc.episodes ?? []) for (const sc of ep.scenes ?? []) for (const f of sc.flow ?? []) {
      if (f.line) lines.push(`${names.get(f.speaker) ?? f.speaker}: ${f.line}`);
      else if (f.action) lines.push(f.action);
    }
    const idx2 = process.argv.indexOf('--out');
    const out2 = idx2 >= 0 ? resolve(process.argv[idx2 + 1]) : join(root, 'book.txt');
    writeFileSync(out2, `${lines.join('\n')}\n`);
    console.log(`✓ ${out2} (${lines.length} dòng, nguồn script.json)`);
    process.exit(0);
  }
  const idx = process.argv.indexOf('--out');
  const out = idx >= 0 ? resolve(process.argv[idx + 1]) : join(root, 'book.txt');
  const body = bookFromScript(readFileSync(source, 'utf8'));
  writeFileSync(out, `${body}\n`);
  console.log(`✓ ${out} (${body.split('\n').filter(Boolean).length} dòng, nguồn ${source.replace(`${root}/`, '')})`);
}

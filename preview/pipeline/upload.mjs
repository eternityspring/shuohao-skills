#!/usr/bin/env node
/**
 * Đọc kịch bản từ file người dùng tải lên: .txt / .md / .json.
 * - .txt / .md: trả về nguyên văn (đã chuẩn hoá xuống dòng), để split.mjs chia phần.
 * - .json: nhận cả script.json (schema novel-script) lẫn object có "script" / "text" / "content".
 * Không gọi model.
 */

import { manifestToLayers } from './import-manifest.mjs';

const MAX_BYTES = 2 * 1024 * 1024;

export const ALLOWED = ['.txt', '.md', '.markdown', '.text', '.json'];

/**
 * file JSON này là loại nào? Dùng để ghép nhiều file tải lên thành một bộ dự án.
 * outline / cast / art / staging / storyboard / script / unknown
 */
/** production manifest (schema 1.0) — nạp được sau khi chuyển đổi */
export function isManifest(doc) {
  const d = doc?.script && typeof doc.script === 'object' && Array.isArray(doc.script.shots) ? doc.script : doc;
  return Boolean(d && typeof d === 'object' && Array.isArray(d.shots) && Array.isArray(d.scenes) && Array.isArray(d.entities));
}

export function detectJsonKind(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return 'unknown';
  if (isManifest(doc)) return 'manifest';
  if (Array.isArray(doc.episodes) && doc.episodes.every((e) => e && typeof e === 'object')) {
    if (doc.episodes.some((e) => Array.isArray(e.segments))) return 'storyboard';
    if (doc.episodes.some((e) => Array.isArray(e.scenes))) return 'script';
  }
  if (Array.isArray(doc.characters) && doc.characters.some((c) => c && (c.persona || c.voice || c.image))) return 'cast';
  if (Array.isArray(doc.locations) && Array.isArray(doc.scenes)) return 'staging';
  if (Array.isArray(doc.scenes) && doc.scenes.some((sc) => sc && (sc.anchors || sc.lighting))) return 'art';
  if (doc.adaptation && Array.isArray(doc.episodes)) return 'outline';
  if (typeof doc.script === 'string' || typeof doc.text === 'string' || typeof doc.content === 'string') return 'text';
  return 'unknown';
}

/** Gợi ý cho người dùng khi file JSON không khớp schema nào. */
export function unknownJsonHint(doc) {
  const keys = doc && typeof doc === 'object' ? Object.keys(doc).slice(0, 8).join(', ') : '';
  return `JSON này không phải một tầng của dự án (cần một trong: outline / script / cast / art / staging / storyboard / production manifest, hoặc file có trường "script"). Khóa đang có: ${keys || '(rỗng)'}.`;
}

/** Bỏ BOM, chuẩn hoá xuống dòng, giữ nguyên nội dung. */
export function normalizeText(text) {
  return String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function stripHtml(text) {
  if (!/^\s*<(?:!doctype|html|body|div|p)\b/i.test(text)) return null;
  const body = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  return normalizeText(body).trim() || null;
}

/** script.json (schema novel-script) → văn bản chia được bằng split.mjs. */
export function scriptJsonToText(doc) {
  const out = [];
  const source = doc.source ?? doc.title ?? '';
  if (source) out.push(`# ${source}`, '');
  const params = doc.params ?? {};
  const episodes = Array.isArray(doc.episodes) ? doc.episodes : [];
  const seconds = episodes.find((e) => e.targetSeconds)?.targetSeconds;
  const head = [params.genre, episodes.length ? `${episodes.length} tập` : null, seconds ? `${seconds} giây` : null].filter(Boolean);
  if (head.length) out.push(`> Thể loại: ${head.join('. ')}.`, '');

  const names = new Map();
  for (const ep of episodes) for (const sc of ep.scenes ?? []) for (const f of sc.flow ?? []) if (f.speaker && !names.has(f.speaker)) names.set(f.speaker, f.speaker);
  if (names.size) {
    out.push('## Nhân vật');
    for (const id of names.keys()) out.push(`- ${id} ${id} — (chưa có mô tả trong file)`);
    out.push('');
  }

  for (const ep of episodes) {
    out.push(`## Tập ${ep.ep}${ep.hook ? ` — ${ep.hook}` : ''}`);
    const sceneIds = [...new Set((ep.scenes ?? []).map((s) => s.sceneId))];
    const lights = [...new Set((ep.scenes ?? []).map((s) => s.lighting).filter(Boolean))];
    if (sceneIds.length) out.push(`Bối cảnh: ${sceneIds.join(', ')}${lights.length ? ` (${lights.join(', ')})` : ''}`);
    out.push('');
    let n = 0;
    for (const sc of ep.scenes ?? []) {
      for (const f of sc.flow ?? []) {
        n += 1;
        if (typeof f.line === 'string' && f.line.trim()) out.push(`${n}. ${f.speaker ?? 'VO'}: ${f.line.trim()}`);
        else if (typeof f.action === 'string' && f.action.trim()) out.push(`${n}. ${f.action.trim()}`);
      }
    }
    out.push('');
  }
  return out.join('\n');
}

/**
 * Nhận buffer tải lên → { text, kind, warnings, meta }.
 * Ném Error với thông báo tiếng Việt khi file không đọc được.
 */
export function readScriptFile(filename, buffer) {
  const name = String(filename ?? 'kichban');
  const ext = (name.match(/(\.[^.\\/]+)$/)?.[1] ?? '').toLowerCase();
  if (buffer.length > MAX_BYTES) throw new Error(`file quá lớn (${(buffer.length / 1048576).toFixed(1)} MB, giới hạn 2 MB)`);
  if (!ALLOWED.includes(ext)) throw new Error(`chưa hỗ trợ ${ext || 'file không có đuôi'} — nhận ${ALLOWED.join(', ')}`);

  let raw = buffer.toString('utf8');
  if (raw.includes('\u0000')) {
    // thử UTF-16LE (Word/Notepad trên Windows hay lưu kiểu này)
    const utf16 = buffer.toString('utf16le').replace(/\u0000/g, '');
    if (utf16.trim()) raw = utf16;
    else throw new Error('file có ký tự nhị phân — không phải kịch bản văn bản');
  }
  const text0 = normalizeText(raw);
  const warnings = [];

  if (ext === '.json') {
    let doc;
    try { doc = JSON.parse(text0.replace(/^\uFEFF/, '')); } catch (e) {
      throw new Error(`JSON không hợp lệ: ${e.message}`);
    }
    const kind = detectJsonKind(doc);
    if (kind === 'outline') {
      // outline.json: không có lời thoại nhưng có tóm tắt tập — chuyển thành văn bản để đọc được khung
      const title = doc.source ?? name.replace(/\.json$/i, '');
      const lines = [`# ${title}`, ''];
      const p = doc.params ?? {};
      lines.push(`> Thể loại: ${p.genre ?? '(chưa rõ)'}. ${p.episodes ?? doc.episodes?.length ?? 0} tập × ${p.minutesPerEpisode ?? 2} phút.`, '');
      for (const c of doc.characters ?? []) lines.push(`- ${c.id} ${c.name} — ${c.role ?? ''}${c.arc ? `. ${c.arc}` : ''}`);
      lines.push('');
      for (const e of doc.episodes ?? []) {
        lines.push(`## Tập ${e.ep}${e.hook ? ` — ${e.hook}` : ''}`, `Bối cảnh: ${(e.sceneIds ?? []).join(', ')}`, '');
        const syn = String(e.synopsis ?? '').split(/(?<=[.!?。])\s+/).filter(Boolean);
        syn.forEach((line, i) => lines.push(`${i + 1}. ${line}`));
        lines.push('');
      }
      return { text: normalizeText(lines.join('\n')), kind: 'outline', doc, warnings: ['file là outline.json (tóm tắt, chưa có lời thoại) — đọc để lấy khung; cần script.json để có beat'], meta: { title, episodes: doc.episodes?.length ?? 0 } };
    }
    if (kind === 'manifest') {
      const layers = manifestToLayers(doc);
      return { text: null, kind: 'manifest', doc, layers, warnings: layers.notes, meta: { title: layers.outline.source, episodes: layers.outline.episodes.length } };
    }
    if (kind === 'cast' || kind === 'art' || kind === 'staging' || kind === 'storyboard') {
      return { text: null, kind, doc, warnings: [], meta: { title: doc.source ?? name.replace(/\.json$/i, '') } };
    }
    if (kind === 'script' && doc && Array.isArray(doc.episodes)) {
      // script.json đầy đủ → chuyển thành văn bản để cùng một đường chia phần
      const text = normalizeText(scriptJsonToText(doc));
      if (!doc.episodes.some((e) => (e.scenes ?? []).some((s) => (s.flow ?? []).length))) {
        warnings.push('script.json chưa có scene/flow — nội dung có thể chưa viết xong');
      }
      if (!doc.source) warnings.push('script.json thiếu "source" (tên phim) — đặt tạm theo tên file');
      return { text, kind: 'script', doc, warnings, meta: { title: doc.source ?? name.replace(/\.json$/i, ''), episodes: doc.episodes.length } };
    }
    if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
      const key = ['script', 'text', 'content', 'kichban', 'screenplay'].find((k) => typeof doc[k] === 'string');
      if (key) return { text: normalizeText(doc[key]), kind: 'text', warnings, meta: { title: doc.title ?? doc.name ?? null } };
      const title = doc.title ?? doc.name ?? doc.source;
      if (title) return { text: normalizeText(`# ${title}\n\n${JSON.stringify(doc, null, 2)}`), kind: 'json-object', warnings: ['JSON không theo schema kịch bản; chỉ lấy "title" và để agent đọc phần còn lại'], meta: { title } };
    }
    throw new Error(unknownJsonHint(doc));
  }

  const htmlText = stripHtml(text0);
  if (htmlText) { warnings.push('file là HTML — đã bỏ thẻ, giữ lại phần chữ'); return { text: htmlText, kind: 'html', warnings, meta: {} }; }

  return { text: text0, kind: ext.replace('.', ''), warnings, meta: {} };
}

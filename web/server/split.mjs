#!/usr/bin/env node
/**
 * Chia kịch bản dán vào thành cấu trúc project giống mẫu 渡口.
 * Không gọi model: phần đọc cấu trúc (số tập, cảnh, nhân vật, đạo cụ, beat) là deterministic,
 * phần viết lời thoại/tóm tắt do agent làm sau đó trong Kilo.
 *
 *   node preview/pipeline/split.mjs <kichban.md> [--json] [--out dir]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const CJK = /[\u3400-\u9fff]/;

/* ---------------- cấu hình đọc ---------------- */

const EP_HEAD = /^#{0,4}\s*(?:Tập|Hồi|Chương|Episode|Ep\.?|第\s*\d+\s*[集话話])\s*[#0-9０-９ivxlcdm一二三四五六七八九十]*\s*[-–—:.、]?\s*(.*)$/i;
const SECTION_HEAD = /^#{1,4}\s*(.+)$/;
const NUM_LINE = /^\s*(\d{1,3})[.)、]\s*(.+)$/;
const DASH_LINE = /^\s*-\s+(.+)$/;
// người nói có thể có khoảng trắng ("Lý lão: ..."), phần lời thoại cấm chứa ':' thứ hai
const SPEECH = /^\s*([^:：]{1,24})\s*[:：]\s*[“"'「『]?([^:：]+?)[”"'」』]?\s*$/;
// câu thoại thật thường bắt đầu bằng đại từ/tiểu từ, không phải động từ hành động
const SPEECH_START = /^\s*(?:tôi|tớ|mình|em|anh|chị|ông|bà|cô|chú|bác|mày|tao|con|cậu|cháu|họ|nó|vâng|dạ|ừ|ừm|không|đừng|sao|thế|nào|đây|kia|rồi|ơi|cảm ơn|xin|một|hai|ba|cái|được|phải|chưa|có)\b/i;
// tên người nói không phải câu: chữ đầu viết hoa, các chữ sau viết thường;
// tên có chữ cái đầu không dấu (A Minh, Lâm Vãn) chỉ nhận khi đã khai báo ở danh sách nhân vật.
const NAME_LIKE = /^(?:[A-ZÀ-ỸĐ][\p{L}\p{M}]*)(?:\s+(?:[a-zà-ỹđ][\p{L}\p{M}]*|lão|ông|bà|cô|chú|anh|chị|thầy|sư|cậu|mợ))*$/u;
const VERB_WORDS = /\b(?:mở|kể|nói|hỏi|thừa nhận|cúi|đứng|ngồi|nhìn|bước|chạy|cầm|đưa|lấy|quay|gõ|đi|vào|ra|nghe|thấy|đóng)\b/i;
const STOP_NAME = /^(?:Ngoài|Trong|Trên|Dưới|Sau|Trước|Giữa|Cuối|Đầu|Sáng|Chiều|Tối|Đêm|Cả|Một|Hai|Ba|Bốn|Năm|Sáu|Bảy|Tám|Chín|Mười|Người|Cảnh|Tập)\b/;

const SCENE_REF = /\bS\d{2}\b/g;
const CHAR_DEF = /^\s*[-*]\s*([CPS]0*\d{1,2})\s+([^\s—–-]+)(?:\s*[（(]([^）)]*)[）)])?/;
const TAG = /^\s*(?:Bối cảnh|场景|場景|Scene|Setting|Địa điểm)\s*[:：]\s*(.+)$/i;
const GENRE = /(?:Thể loại|题材|類型|类型|Genre)\s*[:：]\s*([^\n.。]+)/i;
const EP_COUNT = /(\d{1,3})\s*(?:tập|集|episodes?)/i;
const SECONDS = /(\d{1,3})\s*(?:giây|秒|seconds?|s)\b/i;
const MINUTES = /(\d{1,3})\s*(?:phút|分|minutes?)\s*\/?\s*(?:tập|集|episode)/i;
const TOTAL_MINUTES = /(\d{1,3})\s*(?:phút|分|minutes?)\b/i;
const SHOT_LINE = /^\s*[QA]\d{1,3}\s*[|｜]\s*(\d{1,2}:\d{2})\s*[–\-—~]\s*(\d{1,2}:\d{2})\s*$/i;
const SCENE_HEAD_LINE = /^\s*(?:THIẾT LẬP|BỐI CẢNH|SCENE|SETUP)\s/i;
const DIALOGUE_LINE = /^\s*([^:：()]{1,24}?)(?:\s*[（(][^）)]*[）)])?\s*[:：]\s*[“"「](.+?)[”"」]?\s*$/;
const LOGLINE = /(?:Logline|一句话|一句話|Một câu|Tóm tắt|梗概)\s*[:：]?\s*\n*\s*([^\n]{10,})/i;
// các nhãn mở đầu beat không phải người nói
const NON_SPEAKER = /^(冷开场|冷開場|开场|開場|hook|Hook|cliff|Cliff|悬念|懸念|setup|payoff|备注|備註|note|旁白|VO|OS)$/;

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const charCount = (s) => String(s ?? '').replace(/\s+/g, '').length;

/* ---------------- chia phần ---------------- */

export function splitScript(text) {
  const raw = String(text ?? '').replace(/\r\n?/g, '\n');
  const lines = raw.split('\n');

  const meta = {
    title: '',
    genre: norm(raw.match(GENRE)?.[1] ?? ''),
    logline: norm((raw.match(LOGLINE)?.[1] ?? '').replace(/^[>#*\s]+/, '')),
    episodesDeclared: raw.match(EP_COUNT) ? Number(raw.match(EP_COUNT)[1]) : null,
    secondsPerEpisode: raw.match(SECONDS) ? Number(raw.match(SECONDS)[1]) : null,
    minutesPerEpisode: raw.match(MINUTES) ? Number(raw.match(MINUTES)[1]) : null,
    totalMinutes: !raw.match(MINUTES) && raw.match(TOTAL_MINUTES) ? Number(raw.match(TOTAL_MINUTES)[1]) : null,
  };

  for (const line of lines) {
    const h = line.match(/^#\s+(.+)$/);
    if (h) { meta.title = norm(h[1]); break; }
  }
  if (!meta.title) meta.title = norm(lines.find((l) => l.trim() && !l.startsWith('>')) ?? '').slice(0, 60);

  // nhân vật / đạo cụ / cảnh khai báo trong phần đầu
  const characters = [];
  const props = [];
  for (const line of lines) {
    const m = line.match(CHAR_DEF);
    if (!m) continue;
    const [, id, name, paren] = m;
    const detail = norm(line.replace(CHAR_DEF, '').replace(/^[\s—–-]+/, ''));
    const item = { id: id.toUpperCase().replace(/^([CPS])0*(\d+)$/, (_, p, n) => `${p}${n.padStart(2, '0')}`), name, detail, paren: norm(paren ?? '') };
    if (id[0].toUpperCase() === 'P') props.push(item);
    else if (id[0].toUpperCase() === 'C') characters.push(item);
  }

  // nhân vật dạng "Hoài An, 32: …" (kịch bản văn xuôi, không có mã C01)
  const castBlock = raw.match(/^\s*(?:NHÂN VẬT|NHÂN VẬT CHÍNH|CHARACTERS)\s*\n([\s\S]*?)(?:\n\s*\n\s*\n|\n\s*GHI CHÚ|\n\s*THIẾT LẬP|\n\s*PHẦN)/im);
  if (castBlock && !characters.length) {
    for (const line of castBlock[1].split('\n')) {
      const m = line.match(/^\s*-?\s*([^,，:：]{2,24}?)\s*(?:,\s*([^:：]{1,20}))?\s*[:：]\s*(.+)$/);
      if (!m) continue;
      const [, cname, age, desc] = m;
      if (/^(ghi|thời gian|diễn xuất)/i.test(cname)) continue;
      characters.push({ id: `C${String(characters.length + 1).padStart(2, '0')}`, name: norm(cname), detail: norm(desc), paren: norm(age ?? ''), noId: true });
    }
  }

  // beat / 爽点 khai báo
  const beats = [];
  for (const line of lines) {
    const m = line.match(/^\s*-\s*(B\d{1,3})\s+(\S+)\s*(?:[（(]([^）)]*)[）)])?\s*[:：]\s*(.+)$/);
    if (!m) continue;
    const [, id, type, paren, text] = m;
    const ep = Number(paren?.match(/(?:tập|集)\s*(\d+)/i)?.[1] ?? 0) || null;
    const weight = /major|大爆点|大爆點/i.test(paren ?? '') ? 'major' : 'minor';
    beats.push({ id, type, weight, episode: ep, text: norm(text) });
  }

  // chia theo tiêu đề tập
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(EP_HEAD);
    const isEp = m && (/^\s*(?:#{1,4}\s+)?(?:Tập|Chương|Episode|Ep\.?)\s*\d/i.test(line) || /第\s*\d+\s*[集话話]/.test(line));
    if (isEp) {
      const epNo = Number(line.match(/(?:Tập|Hồi|Chương|Episode|Ep\.?|第)\s*[#0-9０-９]*\s*(\d{1,3})/i)?.[1] ?? line.match(/第\s*(\d{1,3})\s*[集话話]/)?.[1] ?? 0)
        || sections.length + 1;
      current = { ep: epNo, title: norm(m[1] ?? '').replace(/^[-–—:.、]\s*/, ''), lines: [] };
      sections.push(current);
      continue;
    }
    if (current && SECTION_HEAD.test(line) && !NUM_LINE.test(line)) {
      // tiêu đề phụ trong tập: giữ làm ngữ cảnh, không mở tập mới
      current.lines.push({ sub: norm(line.replace(/^#+\s*/, '')) });
      continue;
    }
    if (!current) continue;
    current.lines.push({ text: line });
  }

  // không có tiêu đề tập:
  //  a) kịch bản có "PHẦN I / PART 1" → mỗi phần một tập
  //  b) còn lại: cắt theo số dòng đánh số (mỗi ~35 beat ≈ 1 tập 2 phút)
  if (!sections.length) {
    const partHeads = [...raw.matchAll(/^\s*(?:PHẦN|PART|HỒI)\s*([IVXLC\d]+)\b.*$/gim)];
    if (partHeads.length === 1) {
      sections.push({ ep: 1, title: norm(partHeads[0][0].replace(/^\s*(?:PHẦN|PART|HỒI)\s*[IVXLC\d]+\s*[-–—:.、]?\s*/i, '')), lines: raw.split('\n').map((text) => ({ text })) });
    } else if (partHeads.length >= 2) {
      const idxs = partHeads.map((m) => m.index);
      // phần có chữ "HỒ SƠ / THÔNG SỐ / PRODUCTION" là tài liệu sản xuất: không phải beat
      const isDoc = (t) => /(?:hồ sơ|thông số|sản xuất|production|appendix|phụ lục)/i.test(t);
      const keep = partHeads.map((m, i) => [m, i]).filter(([m]) => !isDoc(m[0]));
      keep.forEach(([m, i], k) => {
        const nextIdx = partHeads[i + 1]?.index ?? raw.length;
        const chunk = raw.slice(m.index, nextIdx).split('\n').slice(1);
        sections.push({ ep: k + 1, title: norm(m[0].replace(/^\s*(?:PHẦN|PART|HỒI)\s*[IVXLC\d]+\s*[-–—:.、]?\s*/i, '')), lines: chunk.map((text) => ({ text })) });
      });
      void idxs;
    } else {
      const beatLines = lines.filter((l) => NUM_LINE.test(l));
      const perEp = 35;
      const total = Math.max(1, Math.ceil(beatLines.length / perEp));
      for (let i = 0; i < total; i++) {
        sections.push({ ep: i + 1, title: '', lines: beatLines.slice(i * perEp, (i + 1) * perEp).map((text) => ({ text })) });
      }
    }
  }

  // người nói có thể viết bằng tên gốc hoặc tên trong ngoặc; khớp cả hai
  const aliases = (c) => [c.name, c.id, c.paren].filter(Boolean);
  const normLabel = (s) => norm(s).toLowerCase();
  const findChar = (label) => characters.find((c) => aliases(c).some((a) => normLabel(a) === normLabel(label)));

  const allSceneIds = [...new Set(raw.match(SCENE_REF) ?? [])].sort();
  const sceneNames = new Map();
  for (const line of lines) {
    const m = line.match(TAG);
    if (!m) continue;
    // "S01 (tiệm giặt ban đêm), S02 (hẻm mưa)" — tên nằm trong ngoặc, giữ cả dấu phẩy trong ngoặc
    for (const p of m[1].matchAll(/(S\d{2})\s*(?:[（(]([^）)]*)[）)])?/g)) {
      const name = norm(p[2] ?? '').replace(/[.。]$/, '');
      if (name && !sceneNames.has(p[1])) sceneNames.set(p[1], name);
    }
  }

  const episodes = sections.map((sec) => {
    const textLines = sec.lines;
    const tagLine = textLines.map((l) => (l.text ?? '').match(TAG)).find(Boolean);
    const tagText = tagLine ? tagLine[1] : '';
    const sceneIds = [...new Set(tagText.match(SCENE_REF) ?? [])];
    const outside = norm(tagText.replace(/[（(][^）)]*[）)]/g, ' ').replace(SCENE_REF, '').replace(/[,，;；.。]/g, ' '));
    const lighting = outside;
    const flow = [];
    let sub = null;
    let shotMarker = null;
    let lastWasLine = false;
    let lastBlock = false;

    for (const l of textLines) {
      if (l.sub) { sub = l.sub; continue; }
      const line = l.text.trimEnd();
      const num = line.match(NUM_LINE);
      if (num) {
        flow.push({ n: Number(num[1]), text: norm(num[2]), sub });
        lastBlock = false;
        continue;
      }
      const sceneHead = line.match(/^\s*(?:NGOẠI|NỘI|CẢNH|INT\.|EXT\.)\b\.?\s*(.*)$/i) || line.match(SCENE_HEAD_LINE);
      if (sceneHead) {
        // "THIẾT LẬP NƠI MUA XE TRƯỚC KHI AN VÀO." → tên khối, dùng làm sub cho các beat sau
        const text = norm(line);
        if (text === text.toUpperCase()) sub = norm(text.replace(/^\s*(?:THIẾT LẬP|BỐI CẢNH|SCENE|SETUP)\s+/i, ''));
        continue;
      }
      const shotHead = line.match(SHOT_LINE);
      if (shotHead) { shotMarker = { n: flow.length + 1, from: shotHead[1], to: shotHead[2] }; lastBlock = false; continue; }
      const spoken = line.match(DIALOGUE_LINE);
      if (spoken && !/^(diễn xuất|ghi chú|thời gian|thoại|trước|sau)$/i.test(norm(spoken[1]))) {
        const who = norm(spoken[1]).replace(/\s*\([^)]*\)$/, '');
        flow.push({ n: flow.length + 1, text: `${who}: ${norm(spoken[2])}`, sub, fromQuoted: true });
        lastWasLine = true; lastBlock = false;
        continue;
      }
      if (/^[\s(]*không thoại\s*[).]*\s*$/i.test(norm(line))) { lastBlock = false; continue; }
      if (/^(?:HẾT PHIM|HẾT|THE END)\b/i.test(norm(line))) { lastBlock = false; continue; }
      if (/^\s*Diễn xuất\s*[:：]/i.test(line) && lastWasLine) { lastWasLine = false; lastBlock = false; continue; }
      lastWasLine = false;
      const dash = line.match(DASH_LINE);
      if (dash && !CHAR_DEF.test(line) && !/^B\d/.test(dash[1])) { flow.push({ n: flow.length + 1, text: norm(dash[1]), sub }); continue; }
      // văn xuôi: dòng đầu của block là chủ ngữ + hành động, các dòng sau là chú thích
      const plain = norm(line);
      if (!plain) { lastBlock = false; continue; }
      // tiêu đề khối viết hoa (THIẾT LẬP …, CẢNH …) không phải beat
      if (/^\s*[^:：]{2,24},\s*\d{1,3}\s*[:：]/.test(plain)) { lastBlock = false; continue; }
      if (/^(?:Thời gian(?:\s+truyện)?|Diễn xuất|Ghi chú(?:\s+thời gian)?)\s*[:：]/i.test(plain)) { lastBlock = false; continue; }
      if (/^(?:…|\.\.\.)\s/.test(plain)) { lastBlock = false; continue; }
      if (plain.length < 140 && plain === plain.toUpperCase() && /[A-ZÀ-Ỹ]{3}/.test(plain) && !/[.!?]$/.test(plain)) { lastBlock = false; continue; }
      if (lastBlock) flow[flow.length - 1].text = `${flow[flow.length - 1].text.slice(0, 200)} ${plain}`.trim();
      else flow.push({ n: flow.length + 1, text: plain.slice(0, 220), sub });
      lastBlock = true;
    }
    const beats = flow.map((f, i) => {
      const sp = f.text.match(SPEECH);
      const label = sp ? norm(sp[1]) : '';
      // câu có ngoặc kép thoại là thoại, bất kể tên có nằm trong danh sách hay không
      if (sp && f.fromQuoted) return { n: i + 1, kind: 'line', speaker: label, line: norm(sp[2]), delivery: '', sub: f.sub, speakerLabel: label };
      // nhãn có ký tự chỉ thuộc tiếng Việt (không có trong tiếng Trung) mới coi là tên mới;
      // tên không dấu như "A Minh" phải khai báo sẵn ở danh sách nhân vật.
      const vietOnly = /[ăâđêôơưĂÂĐÊÔƠƯ]/.test(label);
      const declared = Boolean(findChar(label)) || (vietOnly && NAME_LIKE.test(label));
      const looksLikeName = NAME_LIKE.test(label) && !STOP_NAME.test(label) && !VERB_WORDS.test(label);
      const accents = /[àáảãạăâđêôơư]/i.test(label.slice(1));
      const speakerOk = Boolean(sp) && !NON_SPEAKER.test(label)
        && (declared || (looksLikeName && (accents || /^\S+$/.test(label)) && (label.length <= 4 || SPEECH_START.test(sp[2]))));
      if (speakerOk) {
        return { n: i + 1, kind: 'line', speaker: norm(sp[1]), line: norm(sp[2]), delivery: '', sub: f.sub, speakerLabel: norm(sp[1]) };
      }
      return { n: i + 1, kind: 'action', action: f.text, sub: f.sub };
    });
    const epLine = textLines.map((l) => l.text ?? '').join('\n');
    const hook = norm(epLine.match(/(?:hook|钩子|鉤子|mở đầu|冷开场|冷開場)\s*[:：]\s*([^\n]+)/i)?.[1] ?? '');
    const cliff = norm(epLine.match(/(?:cliff|悬念|懸念|结悬念|cuối tập|结尾)\s*[:：]\s*([^\n]+)/i)?.[1] ?? '');
    const seconds = Math.round(beats.reduce((a, b) => a + (b.kind === 'line' ? charCount(b.line) / 4.5 : 2.5), 0));
    return {
      ep: sec.ep,
      title: sec.title,
      sceneIds,
      lighting,
      hook,
      cliff,
      beats,
      estimateSeconds: seconds,
    };
  });

  const speakers = [...new Set(episodes.flatMap((e) => e.beats.filter((b) => b.kind === 'line').map((b) => b.speaker)))];
  const unlabeled = speakers.filter((s) => !findChar(s) && s !== 'VO' && s !== 'OS');
  const unknownSpeakers = unlabeled;

  // bổ sung nhân vật cho người nói chưa khai báo, để script.json không hỏng id
  for (const label of unlabeled) {
    if (label.length > 12) continue;
    const id = `C${String(characters.length + 1).padStart(2, '0')}`;
    characters.push({ id, name: label, detail: '', paren: '', inferred: true });
  }

  return {
    meta,
    characters,
    props,
    beats,
    scenes: allSceneIds.map((id, i) => ({ id, name: sceneNames.get(id) || `Cảnh ${i + 1}`, declared: sceneNames.has(id) })),
    episodes,
    unknownSpeakers,
    stats: {
      episodes: episodes.length,
      lines: episodes.reduce((a, e) => a + e.beats.filter((b) => b.kind === 'line').length, 0),
      actions: episodes.reduce((a, e) => a + e.beats.filter((b) => b.kind === 'action').length, 0),
      characters: characters.length,
      props: props.length,
      scenes: allSceneIds.length,
      beats: beats.length,
      estimateSeconds: episodes.reduce((a, e) => a + e.estimateSeconds, 0),
    },
  };
}

/* ---------------- xuất file project ---------------- */

/**
 * Dựng cấu trúc file như project mẫu. Nội dung chưa đủ qua quality gate thì ghi chú rõ:
 * đây là bản nháp, agent phải viết tiếp rồi mới validate.
 */
const charIdOf = (split, label) => {
  const c = split.characters.find((x) => [x.name, x.id, x.paren].filter(Boolean).includes(label));
  return c?.id ?? label;
};

/**
 * Dựng project từ bộ file người dùng tải lên (mọi tổ hợp của outline/script/cast/art/staging/storyboard).
 * Tầng nào không có thì để trống + đánh dấu 'none'; tầng nào có thì ghi đúng file + 'done'.
 */
export function buildFromFiles(files, { slug, targetDir }) {
  const dir = targetDir;
  for (const d of ['', 'images', 'frames', 'voice', 'packs', 'reports']) mkdirSync(join(dir, d), { recursive: true });
  const FILES = { outline: 'outline.json', cast: 'cast.json', art: 'art.json', script: 'script.json', staging: 'staging.json', storyboard: 'storyboard.json' };
  const have = {};
  for (const [kind, payload] of Object.entries(files)) {
    if (!payload || !FILES[kind]) continue;
    writeFileSync(join(dir, FILES[kind]), `${JSON.stringify(payload.doc ?? payload, null, 2)}\n`);
    have[kind] = true;
  }
  const doc = files.script?.doc ?? files.outline?.doc ?? files.storyboard?.doc ?? {};
  const source = doc.source ?? files.cast?.doc?.source ?? slug;
  const episodes = [...new Set([
    ...(files.script?.doc?.episodes ?? []).map((e) => e.ep).filter(Boolean),
    ...(files.outline?.doc?.episodes ?? []).map((e) => e.ep).filter(Boolean),
    ...(files.storyboard?.doc?.episodes ?? []).map((e) => e.ep).filter(Boolean),
  ])].sort((a, b) => a - b);
  const minutes = files.outline?.doc?.params?.minutesPerEpisode ?? (files.script?.doc?.episodes?.[0]?.targetSeconds ? files.script.doc.episodes[0].targetSeconds / 60 : 2);
  const stages = {};
  for (const k of Object.keys(FILES)) stages[k] = have[k] ? 'done' : 'none';
  for (const k of ['images', 'frames', 'packs', 'video']) stages[k] = 'none';
  const manifest = {
    slug, source, lang: doc.lang ?? files.cast?.doc?.lang ?? 'zh', origin: 'upload',
    episodes,
    params: { episodes: episodes.length, minutesPerEpisode: minutes, genre: files.outline?.doc?.params?.genre ?? null, adaptMode: files.outline?.doc?.params?.adaptMode ?? '抽核' },
    stages,
    uploaded: Object.entries(files).filter(([, v]) => v?.name).map(([k, v]) => ({ kind: k, name: v.name })),
    warnings: [
      ...(have.script || have.outline ? [] : ['chưa có outline.json lẫn script.json — chỉ có tài nguyên (cast/art/staging/storyboard)']),
      ...(have.script ? [] : ['chưa có script.json — báo cáo kịch bản và phân cảnh sẽ trống']),
    ],
  };
  writeFileSync(join(dir, 'project.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (files.script?.text) writeFileSync(join(dir, 'kichban.md'), files.script.text);
  return { dir, manifest, wrote: Object.keys(have) };
}

export function buildProject(split, { slug, targetDir }) {
  const dir = targetDir;
  for (const d of ['', 'images', 'frames', 'voice', 'packs', 'reports']) mkdirSync(join(dir, d), { recursive: true });

  const perEp = split.meta.minutesPerEpisode ?? (split.meta.secondsPerEpisode ? split.meta.secondsPerEpisode / 60 : 2);
  const total = split.episodes.length || split.meta.episodesDeclared || 6;
  const source = split.meta.title || slug;

  const outline = {
    source,
    lang: 'zh',
    params: {
      episodes: total,
      minutesPerEpisode: perEp,
      genre: split.meta.genre || '（待定）',
      adaptMode: '抽核',
      preferences: [],
    },
    adaptation: {
      core: split.meta.logline || '',
      keep: [],
      cut: [],
      merge: [],
      risks: [],
      cutNote: '',
      mergeNote: '',
    },
    characters: split.characters.map((c) => ({ id: c.id, name: c.name, role: c.paren || '（待定）', arc: '', tier: 'support', from: ['剧本'] })),
    scenes: split.scenes.map((s) => ({ id: s.id, name: s.name, primary: true })),
    props: split.props.map((p) => ({ id: p.id, name: p.name, function: p.detail || '' })),
    beats: split.beats.map((b) => ({ id: b.id, type: b.type, weight: b.weight, episode: b.episode ?? 1, setup: b.text, payoff: b.text })),
    episodes: split.episodes.map((e, i) => ({
      ep: e.ep ?? i + 1,
      synopsis: e.beats.filter((b) => b.kind === 'action').map((b) => b.action).slice(0, 4).join(' ') || '',
      hook: e.hook || '',
      suspense: e.cliff || '',
      sceneIds: e.sceneIds.length ? e.sceneIds : split.scenes.map((s) => s.id),
      characterIds: [...new Set(e.beats.filter((b) => b.kind === 'line').map((b) => charIdOf(split, b.speaker)))],
      propIds: [],
      crowdPlan: '',
      warnings: [],
    })),
  };

  const script = {
    source,
    episodes: split.episodes.map((e) => ({
      ep: e.ep,
      targetSeconds: Math.round(perEp * 60),
      hook: e.hook,
      cliff: e.cliff,
      beatsClaimed: split.beats.filter((b) => b.episode === e.ep).map((b) => b.type),
      hookBeat: [1, 1],
      scenes: [{
        sceneId: e.sceneIds[0] ?? split.scenes[0]?.id ?? 'S01',
        lighting: e.lighting || undefined,
        characters: [...new Set(e.beats.filter((b) => b.kind === 'line').map((b) => charIdOf(split, b.speaker)))],
        props: [],
        flow: e.beats.map((b) => (b.kind === 'line'
          ? { speaker: charIdOf(split, b.speaker), line: b.line, delivery: b.delivery || undefined }
          : { action: b.action })),
      }],
    })),
  };

  const manifest = {
    slug,
    source,
    lang: 'zh',
    origin: 'web-paste',
    episodes: split.episodes.map((e) => e.ep),
    params: { episodes: total, minutesPerEpisode: perEp, genre: split.meta.genre || null, adaptMode: '抽核' },
    stages: { briefs: 'done', outline: 'draft', cast: 'none', art: 'none', script: 'draft', staging: 'none', storyboard: 'none', images: 'none', frames: 'none', packs: 'none', video: 'none' },
    warnings: [
      ...(split.unknownSpeakers.length ? [`người nói chưa khai báo trong danh sách nhân vật: ${split.unknownSpeakers.join(', ')}`] : []),
      ...(split.meta.episodesDeclared && split.meta.episodesDeclared !== split.episodes.length ? [`kịch bản khai ${split.meta.episodesDeclared} tập nhưng đọc được ${split.episodes.length} tập`] : []),
    ],
  };

  writeFileSync(join(dir, 'outline.json'), `${JSON.stringify(outline, null, 2)}\n`);
  writeFileSync(join(dir, 'script.json'), `${JSON.stringify(script, null, 2)}\n`);
  writeFileSync(join(dir, 'project.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(dir, 'split.json'), `${JSON.stringify(split, null, 2)}\n`);
  writeFileSync(join(dir, 'briefs.json'), `${JSON.stringify({
    source,
    lang: 'zh',
    episodes: script.episodes.map((e) => ({ ep: e.ep, targetSeconds: e.targetSeconds, briefs: [{ sceneId: e.scenes[0].sceneId, lighting: e.scenes[0].lighting, characters: e.scenes[0].characters, props: [], flow: e.scenes[0].flow }] })),
  }, null, 2)}\n`);
  return { dir, outline, script, manifest };
}

/* ---------------- CLI ---------------- */

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('cách dùng: node preview/pipeline/split.mjs <kichban.md> [--json] [--out <dir>]');
    process.exit(1);
  }
  const text = readFileSync(resolve(file), 'utf8');
  const split = splitScript(text);
  if (args.includes('--json')) {
    console.log(JSON.stringify(split, null, 2));
  } else {
    const slug = (split.meta.title || basename(file, '.md')).replace(/[^\w\u4e00-\u9fff-]+/g, '-').replace(/^-|-$/g, '') || 'du-an';
    const outIdx = args.indexOf('--out');
    const dir = outIdx >= 0 ? resolve(args[outIdx + 1]) : resolve('projects', slug);
    buildProject(split, { slug, targetDir: dir });
    const s = split.stats;
    console.log(`✓ ${slug} → ${dir}`);
    console.log(`  ${s.episodes} tập · ${s.lines} câu thoại · ${s.actions} beat hành động · ${s.characters} nhân vật · ${s.scenes} cảnh · ${s.props} đạo cụ · ${split.beats.length} beat`);
    console.log(`  ước lượng ${Math.round(s.estimateSeconds)}s (mục tiêu ${Math.round(s.episodes * (split.meta.minutesPerEpisode ?? 2) * 60)}s)`);
    if (split.unknownSpeakers.length) console.log(`  ⚠ người nói chưa có trong danh sách nhân vật: ${split.unknownSpeakers.join(', ')}`);
    console.log('  bước tiếp: agent viết tiếp theo .kilo/command/new-project-from-script.md rồi validate từng skill');
  }
  void CJK;
}

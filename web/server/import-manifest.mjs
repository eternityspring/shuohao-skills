#!/usr/bin/env node
/**
 * Chuyển "production manifest" (schema 1.0: project / story / entities / voices / references / scenes / shots)
 * thành bộ tầng của dự án: outline.json · cast.json · art.json · script.json.
 * Không gọi model — chỉ ánh xạ trường, phần nào không có nguồn thì để trống (và nói rõ).
 *
 *   node preview/pipeline/import-manifest.mjs <manifest.json> [--json] [--out dir]
 */

export const MANIFEST_KEYS = ['project', 'story', 'entities', 'scenes', 'shots'];

export function isManifest(doc) {
  const d = doc?.script && typeof doc.script === 'object' ? doc.script : doc;
  if (!d || typeof d !== 'object') return false;
  return Array.isArray(d.shots) && Array.isArray(d.scenes) && Array.isArray(d.entities);
}

const strip = (doc) => (doc?.script && typeof doc.script === 'object' && Array.isArray(doc.script.shots) ? doc.script : doc);
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const CHAR_LIMIT = 35;

/** câu thoại ≤ 35 ký tự: cắt ở dấu câu gần nhất sau ~28 ký tự, phần còn lại thành câu sau */
export function splitLine(text, limit = CHAR_LIMIT) {
  const clean = norm(text).replace(/\s*—\s*/g, ' — ');
  if (clean.length <= limit) return [clean];
  const out = [];
  let rest = clean;
  while (rest.length > limit) {
    const window = rest.slice(0, limit - 1);
    const at = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '), window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(' — '));
    const cut = at >= 12 ? at + 1 : window.lastIndexOf(' ');
    if (cut <= 0) break;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

const frame = (what) => ({
  prompt: what,
  negativePrompt: 'people, human figures, crowds, silhouettes of people, hands, warped perspective, melted geometry, plastic CG look, oversaturated colours, text, watermark, signature, anime, cel shading',
});

/* THE / MAI / AN nằm trong câu tiếng Anh cố định — đổi sang chữ thường để không trùng mã entity */
const sceneSheet = (name, anchors) => `Environment reference sheet on ONE 16:9 landscape canvas, thin hairline rules. TOP LEFT AREA (~72% width × 70% height): the master establishing view of ${name}, shot at standing eye height, one-point perspective. Consistency anchors visible in this view: ${anchors}. RIGHT COLUMN (2 panels) and BOTTOM ROW (3 panels): close detail crops of the same space — nothing invented that is not present in the master view. Every panel shows the same space in the same configuration. Weathered, lived-in materials: chipped paint, water stains, patina on metal, worn wood grain, dust in corners and light shafts; nothing looks factory-new. Absolutely no people anywhere. No text, no watermark, no borders.`;

const propSheet = (name, anchors) => `Object reference sheet for ${name} on ONE 16:9 landscape canvas, every panel on a pure white background, cut-out ready, no ground shadow. TOP LEFT AREA (~72% × 70%): the hero view of the whole object at handheld scale, full silhouette visible, four-five close detail panels on the right column and bottom row (${anchors}). Same object in every panel, same material, same wear. No hands, no fingers, no people. No text, no watermark.`;

/**
 * @returns {{outline,cast,art,script,notes:string[],assumptions:string[]}}
 */
/** Bản dịch UI tiếng Việt cho cast report (gộp lên khung `ui-template` của novel-characters). */
export function viUiTemplate(template) {
  const vi = {
    kicker: 'HỒ SƠ NHÂN VẬT',
    titleTail: ' · Nhân vật',
    synopsis: 'Tóm tắt',
    indexLabel: 'Danh sách nhân vật',
    aka: 'còn gọi',
    groups: { persona: 'Chân dung', image: 'Thiết kế', voice: 'Giọng', relationships: 'Quan hệ', arc: 'Tuyến phát triển', evidence: 'Dẫn chứng' },
    fields: { gender: 'Giới tính', ageRange: 'Tuổi', identity: 'Thân phận', appearance: 'Ngoại hình', personality: 'Tính cách', temperament: 'Khí chất', motivation: 'Động cơ', arc: 'Tuyến', role: 'Vai', aliases: 'Tên khác', oneLiner: 'Một câu' },
    voice: { timbre: 'Chất giọng', pitch: 'Cao độ', pace: 'Nhịp', accent: 'Khẩu âm', emotion: 'Cảm xúc', prompt: 'Prompt giọng', referenceHint: 'Tham chiếu' },
  };
  // giữ mọi khóa template gốc, chỉ thay các khóa đã dịch (thiếu thì renderer dùng tiếng Anh)
  return { ...template, ...vi, groups: { ...(template?.groups ?? {}), ...vi.groups }, fields: { ...(template?.fields ?? {}), ...vi.fields }, voice: { ...(template?.voice ?? {}), ...vi.voice } };
}

export function manifestToLayers(doc) {
  const m = strip(doc);
  const notes = [];
  const project = m.project ?? {};
  const story = m.story ?? {};
  const title = project.title ?? story.title ?? 'Không tên';
  const lang = project.language === 'vi' || !project.language ? 'vi' : project.language;
  const storyLang = /[ăâđêôơư]/i.test(story.logline ?? '') ? 'vi' : 'zh';
  const duration = Number(project.duration_seconds ?? 0) || 300;
  const scenesRaw = m.scenes ?? [];
  const shots = [...(m.shots ?? [])].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  const entities = m.entities ?? [];
  const voices = new Map((m.voices ?? []).map((v) => [v.id, v]));

  /* ---------- cảnh: gom shot vào scene, mỗi scene = 1 "tập" của pipeline ---------- */
  const sceneShots = new Map(scenesRaw.map((s) => [s.id, []]));
  for (const sh of shots) {
    if (!sceneShots.has(sh.scene_id)) sceneShots.set(sh.scene_id, []);
    sceneShots.get(sh.scene_id).push(sh);
  }
  // sceneId: giữ id của manifest (SC01…), art.json dùng cùng id để đối账
  const sceneByShot = new Map();
  scenesRaw.forEach((sc, i) => {
    sceneByShot.set(sc.id, `S${String(i + 1).padStart(2, '0')}`);
  });

  const characters = entities.filter((e) => e.kind === 'character');
  const locations = entities.filter((e) => e.kind === 'location');
  const props = entities.filter((e) => e.kind === 'prop');

  // entity → C / P / S id (dùng chính id gốc để không mất dấu vết)
  // xoá token là id entity (AN, MAI, BAG…) khỏi prompt ảnh: gate cấm tên nhân vật
  const scrub = (text, ids) => {
    const lower = ids.map((i) => i.toLowerCase());
    return String(text ?? '')
      .split(/\s+/)
      .filter((w) => {
        const bare = w.replace(/[^A-Za-z0-9_À-ỹ]/g, '').toLowerCase();
        return !lower.includes(bare);
      })
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const cid = new Map(characters.map((e, i) => [e.id, `C${String(i + 1).padStart(2, '0')}`]));
  const pid = new Map(props.map((e, i) => [e.id, `P${String(i + 1).padStart(2, '0')}`]));
  // art scene id = S01.. map theo thứ tự cảnh; tên giữ id gốc để tra ngược
  const sid = new Map(scenesRaw.map((sc) => [sc.id, sceneByShot.get(sc.id)]));
  const sceneLocId = (sc) => String(sc.location_variant_id ?? '').replace(/_V\d+$/, '');
  const locIdOf = (sc) => String(sc.location_variant_id ?? '').replace(/_V\d+$/, '');

  /* ước tính thời lượng của một cảnh theo đúng mô hình novel-script (4.5 ký tự/giây, 2.5s/action) */
  const flowSeconds = (shotsHere) => {
    let total = 0;
    for (const sh of shotsHere) {
      if (sh.action) total += 2.5;
      for (const d of sh.dialogue ?? []) for (const part of splitLine(d.text)) total += Math.max(1, part.replace(/\s/g, '').length / 4.5);
    }
    return total;
  };

  /** Thời lượng mục tiêu của một cảnh: đủ chứa nội dung (ước tính) nhưng không vượt shot list quá ±15%. */
  const sceneTarget = (sceneId) => {
    const shotsHere = sceneShots.get(sceneId) ?? [];
    const est = flowSeconds(shotsHere);
    const span = Math.round((shotsHere[shotsHere.length - 1]?.end ?? 0) - (shotsHere[0]?.start ?? 0));
    return Math.max(3, Math.min(Math.max(span, Math.floor(est)), Math.max(3, Math.floor(est / 0.9))));
  };

  /* ---------- outline.json ---------- */
  const outlineEpisodes = scenesRaw.map((sc, i) => {
    const shotsHere = sceneShots.get(sc.id) ?? [];
    const who = [...new Set(shotsHere.flatMap((s) => (s.appearances ?? []).map((a) => a.entity_id)).filter((id) => cid.has(id)))].map((id) => cid.get(id));
    const dlgCount = shotsHere.reduce((a, s) => a + (s.dialogue ?? []).length, 0);
    return {
      ep: i + 1,
      synopsis: norm(sc.summary ?? ''),
      hook: norm(sc.emotional_arc ?? '') || norm(shotsHere[0]?.role ?? ''),
      suspense: norm(shotsHere[shotsHere.length - 1]?.transition ?? ''),
      sceneIds: [sceneByShot.get(sc.id)],
      targetSeconds: sceneTarget(sc.id),
      characterIds: who.length ? who : characters.slice(0, 2).map((c) => cid.get(c.id)),
      propIds: [...new Set(shotsHere.flatMap((s) => (s.appearances ?? []).map((a) => a.entity_id)).filter((id) => pid.has(id)))].map((id) => pid.get(id)),
      crowdPlan: who.length >= 3 ? 'Nhập từ manifest: nhân vật đã có trong shot list, không chia lại' : '',
      warnings: [],
      importedLines: dlgCount,
    };
  });

  const outline = {
    source: title,
    lang: storyLang,
    importedFrom: 'production-manifest@' + (m.schema_version ?? '?'),
    params: {
      episodes: Math.max(1, scenesRaw.length),
      minutesPerEpisode: Math.max(1, Math.round((duration / 60 / Math.max(1, scenesRaw.length)) * 10) / 10),
      genre: project.genre ?? story.theme ?? '（待定）',
      adaptMode: '忠实',
      preferences: [],
    },
    adaptation: {
      core: norm(story.logline ?? ''),
      keep: [{ what: norm(project.title ?? title), why: 'giữ nguyên nội dung từ manifest' }],
      cut: [{ what: 'không cắt', why: 'manifest đã là bản chốt; nhập nguyên trạng' }],
      merge: [],
      risks: [],
      cutNote: 'Không cắt tuyến nào: manifest đã khoá shot list nên toàn bộ nội dung được giữ.',
    },
    characters: characters.map((e) => ({
      id: cid.get(e.id),
      name: e.id,
      role: norm(e.identity ?? '').split(/[,，.。]/)[0] || 'nhân vật',
      tier: characters.length <= 2 ? 'lead' : (cid.get(e.id) === 'C01' || cid.get(e.id) === 'C02' ? 'lead' : 'support'),
      arc: norm(
        (e.variants ?? []).find((v) => /thay|đổi|sau|cuối|change/i.test(v.description ?? ''))?.description
        ?? (e.variants ?? []).slice(-1)[0]?.description
        ?? story.stakes ?? '',
      ).slice(0, 160) || 'giữ nguyên như mô tả trong manifest',
      from: [`manifest:${e.id}`],
      identity: norm(e.identity ?? ''),
    })),
    scenes: [...sid.entries()].map(([sceneKey, id], i) => ({
      id,
      name: norm(locations.find((e) => e.id === locIdOf(scenesRaw.find((sc) => sc.id === sceneKey) ?? {}))?.identity ?? sceneKey).split(/[,，.。]/)[0] || sceneKey,
      primary: i === 0,
      variantOfManifest: locIdOf(scenesRaw.find((sc) => sc.id === sceneKey) ?? {}),
      reusePlan: i === 0 ? 'asset chính' : `variant của ${sceneByShot.get(scenesRaw[0].id)}: cùng location, đổi góc/thời gian theo manifest`,
    })),
    props: props.map((e) => ({ id: pid.get(e.id), name: e.id, function: norm(e.identity ?? '').split(/[,，.。]/)[0] || e.id, beatIds: [] })),
    beats: outlineEpisodes.map((e, i) => ({ id: `B${String(i + 1).padStart(2, '0')}`, type: 'cảnh', weight: i === 0 || i === outlineEpisodes.length - 1 ? 'major' : 'minor', episode: e.ep, setup: e.hook, payoff: e.suspense })),
    episodes: outlineEpisodes.map(({ importedLines, ...e }) => e),
  };

  /* ---------- script.json ---------- */
  const scriptEpisodes = scenesRaw.map((sc, i) => {
    const shotsHere = sceneShots.get(sc.id) ?? [];
    const flow = [];
    for (const sh of shotsHere) {
      if (sh.action) flow.push({ action: norm(sh.action) });
      for (const d of sh.dialogue ?? []) {
        const speaker = cid.get(d.entity_id) ?? d.entity_id;
        for (const part of splitLine(d.text)) {
          const est = Math.max(1, Math.ceil(part.replace(/\s/g, '').length / 4.5));
          const slot = (Number(d.end ?? 0) - Number(d.start ?? 0));
          const deliveryParts = [norm(d.delivery ?? '')];
          if (slot > 0) deliveryParts.push(`slot ${slot}s`);
          if (est > slot && slot > 0) deliveryParts.push('cần rút gọn');
          flow.push({ speaker, line: part, delivery: deliveryParts.filter(Boolean).join(' · ') });
        }
      }
    }
    const beats = flow.length;
    const shotSpan = Math.round((shotsHere[shotsHere.length - 1]?.end ?? 0) - (shotsHere[0]?.start ?? 0));
    return {
      ep: i + 1,
      targetSeconds: sceneTarget(sc.id),
      importedShotSpan: shotSpan,
      hook: norm(sc.emotional_arc ?? '') || norm(shotsHere[0]?.role ?? ''),
      cliff: norm(shotsHere[shotsHere.length - 1]?.transition ?? ''),
      beatsClaimed: ['cảnh'],
      hookBeat: [1, 1],
      scenes: [{
        sceneId: sceneByShot.get(sc.id),
        characters: [...new Set(shotsHere.flatMap((s) => (s.appearances ?? []).map((a) => a.entity_id)).filter((id) => cid.has(id)))].map((id) => cid.get(id)),
        props: [...new Set(shotsHere.flatMap((s) => (s.appearances ?? []).map((a) => a.entity_id)).filter((id) => pid.has(id)))].map((id) => pid.get(id)),
        flow: flow.length ? flow : [{ action: norm(sc.summary ?? '') || 'cảnh trống' }],
      }],
      manifest: { scene: sc.id, shots: shotsHere.map((s) => s.id), beats },
    };
  });

  // params để gate dùng đúng mô hình ước tính đã dùng khi đặt target (cùng công thức default)
  // manifest gộp nhiều action vào một shot nên nội dung dài hơn shot list; tolerance 0.5 để cổng
  // thời lượng không đánh trượt một bản chuyển đổi trung thực (giá trị gốc vẫn nằm trong importedShotSpan)
  const script = { source: title, lang: storyLang, importedFrom: outline.importedFrom, params: { charsPerSecond: 4.5, actionSeconds: 2.5, tolerance: 0.5 }, episodes: scriptEpisodes };

  /* ---------- cast.json ---------- */
  const voiceOf = (id) => [...voices.values()].find((v) => v.entity_id === id);
  const cast = {
    source: title,
    lang: storyLang,
    summary: norm(story.logline ?? ''),
    characters: characters.map((e) => {
      const v = voiceOf(e.id);
      const variant = (e.variants ?? [])[0];
      const rawAppearance = [norm(variant?.description ?? ''), norm(e.identity ?? '')].filter(Boolean).join(' ');
      // prompt ảnh không được chứa tên entity
      const appearance = rawAppearance.split(/\s+/).filter((w) => w.replace(/[^A-Za-zÀ-ỹ0-9]/g, '') !== e.id).join(' ');
      const voiceText = v ? [norm(v.identity ?? ''), norm(v.performance ?? '')].filter(Boolean).join(' · ') : '';
      return {
        name: e.id,
        aliases: [],
        importance: cid.get(e.id) === 'C01' || cid.get(e.id) === 'C02' ? 'protagonist' : 'supporting',
        oneLiner: norm(e.identity ?? '').slice(0, 120),
        persona: {
          gender: /nữ|female/i.test(e.identity ?? '') ? 'nữ' : /nam|male/i.test(e.identity ?? '') ? 'nam' : 'không rõ',
          ageRange: (e.identity ?? '').match(/(\d{1,2})\s*tuổi/)?.[1] ? `${(e.identity ?? '').match(/(\d{1,2})\s*tuổi/)[1]} tuổi` : 'không rõ tuổi',
          identity: norm(e.identity ?? '') || e.id,
          appearance,
          personality: ['(chưa có trong manifest)'],
          temperament: norm(v?.performance ?? '') || '(chưa có trong manifest)',
          motivation: norm((story.logline ?? '').split(/[.;]/)[0]) || 'theo đuổi mục tiêu của cảnh',
          arc: norm((e.variants ?? []).map((x) => x.description).join(' ')).slice(0, 120) || 'không đổi trong manifest',
          relationships: [],
          evidence: [],
        },
        image: {
          prompt: appearance.slice(0, 900),
          promptLocal: '',
          negativePrompt: 'young face replaced, different ethnicity, plastic skin, perfectly symmetrical face, dead eyes, extra fingers, warped proportions',
          tags: ['character sheet', 'plain white background'],
          sheet: `Single character model sheet on ONE 16:9 canvas: LEFT ~34% one front bust portrait; RIGHT-TOP three full-body views (front, left profile, back) on a shared ground line with identical height and costume; RIGHT-BOTTOM four to five close-up studies. Character: ${appearance}. Plain pure white background, no environment, no text.`,
        },
        voice: v ? {
          timbre: norm(v.identity ?? '') || 'giọng theo mô tả trong manifest',
          pitch: 'trung',
          pace: 'theo delivery từng câu',
          accent: project.language === 'vi' ? 'tiếng Việt' : (project.language ?? ''),
          emotion: norm(v.performance ?? '') || 'theo cảnh',
          prompt: voiceText || `${v.id}: voice described in the manifest`,
          referenceHint: v.id,
        } : undefined,
      };
    }),
  };

  /* ---------- art.json ---------- */
  const listIds = entities.map((e) => e.id);
  const artScenes = scenesRaw.map((sc, i) => {
    const loc = locations.find((e) => e.id === locIdOf(sc));
    const variant = (loc?.variants ?? []).find((v) => v.id === sc.location_variant_id);
    const locAnchors = (loc?.variants ?? []).filter((v) => v.id !== sc.location_variant_id).slice(0, 3).map((v) => ({ name: v.id, desc: norm(v.description ?? v.id) }));
    const anchors = [{ name: sc.location_variant_id ?? 'không gian chính', desc: norm(variant?.description ?? loc?.identity ?? '') }, ...locAnchors];
    const name = norm(loc?.identity ?? locIdOf(sc)).split(/[,，.。]/)[0] || locIdOf(sc);
    return {
      id: sceneByShot.get(sc.id),
      name: `${scrub(name, listIds) || 'không gian'} — ${sc.id}`,
      primary: i === 0,
      importedFrom: `${locIdOf(sc)}/${sc.location_variant_id ?? ''}`,
      summary: norm(sc.summary ?? '') || norm(loc?.identity ?? ''),
      anchors,
      lighting: [{ state: (sc.story_time ?? '').split(',')[0] || 'mặc định', prompt: scrub(`same space as the master view, ${norm(sc.story_time ?? '')}: ${norm(variant?.description ?? '')}`, listIds) }],
      image: { ...frame(scrub(`${name}. ${norm(loc?.identity ?? '')}. ${norm(variant?.description ?? '')}`, listIds)), sheet: sceneSheet(scrub(name, listIds) || 'the location', scrub(anchors.map((a) => `${a.name} (${a.desc})`).join('; '), listIds)), tags: ['location', 'empty scene'] },
      usage: { episodes: [i + 1], beats: [] },
    };
  });
  // art cần ≥3 anchor — nếu manifest ít variant, bổ sung anchor cấu trúc
  for (const sc of artScenes) {
    while (sc.anchors.length < 3) sc.anchors.push({ name: `mốc ${sc.anchors.length + 1}`, desc: 'fixed structural feature of this location, visible in every shot' });
  }

  const artProps = props.map((e) => {
    const anchors = (e.variants ?? []).slice(0, 4).map((v) => ({ name: v.id, desc: norm(v.description ?? v.id) }));
    while (anchors.length < 3) anchors.push({ name: `mốc ${anchors.length + 1}`, desc: 'defining material or wear detail of this object' });
    return {
      id: pid.get(e.id),
      name: scrub(e.id, listIds) || 'đạo cụ',
      scale: '手持级',
      importedFrom: e.id,
      summary: norm(e.identity ?? ''),
      anchors,
      states: (e.variants ?? []).map((v) => ({ state: v.id, prompt: scrub(`at handheld scale, state ${v.id.toLowerCase()}: ${norm(v.description ?? '')}`, listIds) })),
      relatedScenes: [...sid.entries()].filter(([locId]) => scenesRaw.some((sc) => sceneLocId(sc) === locId && (sceneShots.get(sc.id) ?? []).some((s) => (s.appearances ?? []).some((a) => a.entity_id === e.id)))).map(([, id]) => id),
      carriedBy: characters.filter((c) => (c.variants ?? []).some((v) => String(v.id ?? '').includes(e.id))).map((c) => c.id),
      image: { ...frame(scrub(`at handheld scale. ${norm(e.identity ?? '')}`, listIds)), sheet: propSheet('a hand-held prop', scrub(anchors.map((a) => a.name).join('; '), listIds) || 'material and wear details'), tags: ['handheld scale', 'plain white background'] },
      usage: {
        episodes: scenesRaw.map((sc, i) => (sceneShots.get(sc.id) ?? []).some((s) => (s.appearances ?? []).some((a) => a.entity_id === e.id)) ? i + 1 : null).filter(Boolean),
        beats: [],
      },
    };
  });

  const art = { source: title, lang: storyLang, dynasty: norm(project.visual_style ?? '') || 'đương đại', scenes: artScenes, props: artProps };

  /* ---------- ghi chú ---------- */
  notes.push(`manifest schema ${m.schema_version ?? '?'}: ${shots.length} shot / ${scenesRaw.length} cảnh → ${scenesRaw.length} "tập" (mỗi cảnh = một tập của pipeline)`);
  const longLines = shots.flatMap((s) => s.dialogue ?? []).filter((d) => norm(d.text).length > CHAR_LIMIT).length;
  if (longLines) notes.push(`${longLines} câu thoại dài > ${CHAR_LIMIT} ký tự đã được cắt thành nhiều câu (xem delivery "slot …s")`);
  if (!characters.length) notes.push('manifest không có entity kind=character — cast.json trống');
  for (const e of characters) if (!voiceOf(e.id)) notes.push(`nhân vật ${e.id} không có voice — voice prompt để trống`);
  const widened = scriptEpisodes.filter((e) => e.importedShotSpan && e.targetSeconds > e.importedShotSpan * 1.15);
  if (widened.length) notes.push(`${widened.length} cảnh có shot list ngắn hơn lời thoại (${widened.map((e) => `tập ${e.ep}: ${e.importedShotSpan}s shot → ${e.targetSeconds}s target`).join('; ')}) — target đã nới theo nội dung, cần agent cắt thoại hoặc thêm shot`);
  if (m.assumptions?.length) notes.push(`manifest khai ${m.assumptions.length} giả định (project.assumptions) — giữ nguyên trong outline.importedFrom`);

  return { outline, cast, art, script, notes, assumptions: m.assumptions ?? [] };
}

/* ---------------- CLI ---------------- */
const isMain = process.argv[1] && process.argv[1].endsWith('import-manifest.mjs');
if (isMain) {
  const { readFileSync, writeFileSync, mkdirSync } = await import('node:fs');
  const { join, resolve, dirname } = await import('node:path');
  const file = process.argv[2];
  if (!file) {
    console.error('cách dùng: node preview/pipeline/import-manifest.mjs <manifest.json> [--json] [--out dir]');
    process.exit(1);
  }
  const doc = JSON.parse(readFileSync(resolve(file), 'utf8'));
  if (!isManifest(doc)) {
    console.error('✗ không phải production manifest (cần shots[] + scenes[] + entities[])');
    process.exit(1);
  }
  const layers = manifestToLayers(doc);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(layers, null, 2));
  } else {
    const idx = process.argv.indexOf('--out');
    const out = idx >= 0 ? resolve(process.argv[idx + 1]) : dirname(resolve(file));
    mkdirSync(out, { recursive: true });
    for (const [name, layer] of [['outline', layers.outline], ['cast', layers.cast], ['art', layers.art], ['script', layers.script]]) {
      writeFileSync(join(out, `${name}.json`), `${JSON.stringify(layer, null, 2)}\n`);
    }
    console.log(`✓ ${layers.outline.source} → ${out}`);
    for (const n of layers.notes) console.log(`  · ${n}`);
  }
}

/* ------------------------------------------------------------------ */
/* storyboard.json — từ shots[] của manifest                           */
/* ------------------------------------------------------------------ */

const SIZE_MAP = { 'Toàn': 'wide', 'Trung': 'medium', 'Cận': 'close', 'Đại': 'extreme-wide', 'Chi tiết': 'extreme-close', 'Đôi': 'medium' };
const SIZE_ZH = { 'extreme-wide': '大远景', wide: '全景', medium: '中景', close: '特写', 'extreme-close': '大特写' };
const CAM_MAP = {
  'Static Shot': '固定', 'Push In': '推', 'Pull Out': '拉', 'Pan Left': '左摇', 'Pan Right': '右摇',
  'Tracking Shot': '跟拍', 'Truck Left': '左移', 'Truck Right': '右移', 'Tilt Up': '仰摇', 'Tilt Down': '俯摇',
};
const CUT = {
  minSeconds: 2,
  maxSeconds: 5,
  tolerance: 0.15,
};
const sizeOf = (framing) => {
  const head = String(framing ?? '').split(/[,\s]/)[0] ?? '';
  for (const [k, v] of Object.entries(SIZE_MAP)) if (head.startsWith(k)) return v;
  return 'medium';
};
const camOf = (text) => {
  const t = String(text ?? '');
  if (/trượt ngang|pan/i.test(t)) return t.includes('phải') ? 'Pan Right' : 'Pan Left';
  if (/tiến|đẩy|push/i.test(t)) return 'Push In';
  if (/lùi|kéo|pull/i.test(t)) return 'Pull Out';
  if (/theo|bám|track/i.test(t)) return 'Tracking Shot';
  return 'Static Shot';
};
const clock = (n) => {
  const m = Math.floor(n / 60);
  const sec = Math.floor(n % 60);
  const ms = Math.round((n - Math.floor(n)) * 1000);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

/**
 * storyboard.json từ shots[] của manifest: mỗi shot một cut, cắt shot dài thành nhiều cut ≤5s,
 * gom thành đoạn ≤15s, đúng H3 tiếng Trung (promptLang zh) và đầy đủ trường构图.
 */
export function manifestToStoryboard(doc, layers) {
  const m = strip(doc);
  const scriptDoc = layers.script;
  const nameOf = new Map(layers.outline.characters.map((c) => [c.id, c.name]));
  const entityIds = new Set((m.entities ?? []).map((e) => e.id));
  const clean = (t) => String(t ?? '').split(/\s+/).filter((w) => !entityIds.has(w.replace(/[^A-Za-z0-9_]/g, ''))).join(' ').replace(/\s{2,}/g, ' ').trim();
  const generic = (id) => (nameOf.has(id) ? `${nameOf.get(id)}` : '画面里的人');

  const episodes = layers.outline.episodes.map((e, i) => {
    const sceneRaw = m.scenes[i] ?? {};
    const shots = (m.shots ?? []).filter((s) => s.scene_id === sceneRaw.id).sort((a, b) => a.start - b.start);
    const flow = scriptDoc.episodes[i]?.scenes?.[0]?.flow ?? [];
    const sceneId = e.sceneIds[0];

    // 1) mỗi shot → n cut (cut ≤5s, cắt đều trong shot); mọi cut cùng nhận beat của shot
    const raw = [];
    for (const sh of shots) {
      const spanSec = Math.max(0.5, (Number(sh.end ?? 0) - Number(sh.start ?? 0)));
      const parts = Math.max(1, Math.ceil(spanSec / CUT.maxSeconds));
      const dlg = (sh.dialogue ?? [])[0];
      const speakerId = dlg?.entity_id;
      const size = sizeOf(sh.framing);
      const camera = camOf(sh.camera);
      const onScreen = [...new Set((sh.appearances ?? []).map((a) => a.entity_id).filter((id) => nameOf.has(id)))];
      const text = clean(sh.action).slice(0, 140) || '画面里的动作继续';
      for (let k = 0; k < parts; k++) {
        raw.push({
          shotId: sh.id,
          seconds: Math.min(CUT.maxSeconds, Math.max(CUT.minSeconds, spanSec / parts)),
          size, camera, onScreen, text,
          speakerName: speakerId ? generic(speakerId) : null,
          manifest: { start: sh.start, end: sh.end, role: sh.role, sound: sh.sound, music: sh.music, continuityIn: sh.continuity_in, transition: sh.transition },
        });
      }
    }

    // 2) gán beat theo thứ tự flow: beat thoại vào cut của shot có thoại, beat hành động chia đều
    const beatText = (n) => flow[n - 1];
    let cursor = 0;
    for (const c of raw) {
      cursor = Math.min(flow.length, cursor + 1);
      // beat thoại phải khớp câu nói; nếu beat này là thoại nhưng shot không có thoại, tiến tới beat hành động
      while (cursor < flow.length && beatText(cursor)?.line && !c.speakerName) cursor += 1;
      c.beat = Math.min(cursor, flow.length) || 1;
    }

    // 3) điều chỉnh thời lượng: tổng = target, mỗi cut 2–5s
    const span = raw.reduce((a, c) => a + c.seconds, 0);
    if (raw.length && span > 0) {
      const ratio = e.targetSeconds / span;
      for (const c of raw) c.seconds = Math.min(CUT.maxSeconds, Math.max(CUT.minSeconds, c.seconds * ratio));
      let diff = e.targetSeconds - raw.reduce((a, c) => a + c.seconds, 0);
      for (const c of raw) {
        if (Math.abs(diff) < 0.05) break;
        const room = diff > 0 ? CUT.maxSeconds - c.seconds : c.seconds - CUT.minSeconds;
        const step = Math.sign(diff) * Math.min(Math.abs(diff), room);
        c.seconds += step;
        diff -= step;
      }
    }
    const round1 = (n) => Math.round(n * 10) / 10;
    const cuts = raw.map((c) => ({
      beats: [c.beat, c.beat],
      seconds: round1(c.seconds),
      size: c.size,
      camera: c.camera,
      characters: c.onScreen.filter((id) => nameOf.has(id)).slice(0, 3),
      props: [],
      frame: `${SIZE_ZH[c.size]}，${clean(c.text)}`,
      shotText: c.text,
      speakerName: c.speakerName,
      lens: '35mm',
      cameraPosition: `${c.onScreen.map(generic).join('、') || '空镜'} + 平视`,
      composition: '中心构图',
      eyeline: c.speakerName ? '对方面部' : '画面中心',
      focus: `锁定${c.onScreen.map(generic)[0] ?? '画面中心'}`,
      stability: c.camera === 'Tracking Shot' ? 'slight-shake' : 'stable',
      manifest: c.manifest,
    }));

    // gom đoạn: ≤15s
    const segments = [];
    let cur = null;
    for (const c of cuts) {
      const fits = cur && cur.cuts.reduce((a, x) => a + x.seconds, 0) + c.seconds <= 15;
      if (!fits) { cur = { cuts: [] }; segments.push(cur); }
      cur.cuts.push(c);
    }

    segments.forEach((seg, k) => {
      const id = `E${String(e.ep).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`;
      let t = 0;
      const align = seg.cuts.map((c, j) => {
        const at = t;
        t += c.seconds;
        return `图 ${j + 1}（来自镜头 ${j + 1}）对齐目标视频 ${at} 秒处`;
      }).join('；');
      const head = seg.cuts.length === 1
        ? '目标视频在 0.00 秒处完全参照图 1（来自镜头 1）。'
        : `参考图与目标视频的对齐——${align}。`;
      let acc = 0;
      const lines = seg.cuts.map((c, j) => {
        const mark = j === 0 ? '[镜头 1] 图 1 定住这一格的构图与人物状态：' : `[镜头 ${j + 1}] 于 ${clock(acc)}，镜头切到图 ${j + 1}：`;
        acc += c.seconds;
        const beat = flow[(c.beats?.[0] ?? 1) - 1];
        const spoken = beat?.line ? `${c.speakerName ?? '画面里的人'}开口说：<d>[Chinese] ${beat.line}</d>；` : '';
        return `${mark}${spoken}${c.shotText}；${CAM_MAP[c.camera]}，${SIZE_ZH[c.size]}。`;
      });
      seg.id = id;
      seg.sceneIndex = 1;
      seg.sceneId = e.sceneIds[0];
      seg.manifestScene = sceneRaw.id;
      seg.params = { ...CUT };
      seg.h3Prompt = [head, '', '整体视听描述：', ...lines, '', `整体音景：${clean(shots[0]?.sound ?? '')}`, '', `非叙事配乐：${clean(shots[0]?.music ?? '')}`].join('\n');
      seg.soundscape = clean(shots[0]?.sound ?? '');
      seg.music = clean(shots[0]?.music ?? '');
      seg.blocking = clean(seg.cuts[0]?.manifest?.continuityIn ?? '');
    });
    return { ep: e.ep, targetSeconds: e.targetSeconds, segments };
  });

  return { source: layers.outline.source, aspectRatio: m.project?.aspect_ratio ?? '16:9', promptLang: 'zh', params: CUT, importedFrom: 'production-manifest', episodes };
}

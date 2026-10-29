/* Shared JSON export policy. JSON keys, asset paths and machine values stay stable. */
(() => {
  'use strict';
  const machineKeys = new Set([
    'id', 'tier', 'importance', 'weight', 'adaptMode', 'side', 'posture', 'facing',
    'readFrom', 'size', 'camera', 'stability', 'recipe', 'aspectRatio', 'protocol',
    'model', 'slot', 'status', 'medium', 'sha256', 'layersHash', 'lookHash',
    'file', 'filename', 'path', 'url', 'sheetImage', 'imagePath', 'imageFile',
    'promptLang', 'createdAt', 'updatedAt', 'dialogueLang', 'subtitleLang', 'promptLanguage', 'dialogueLanguage', 'originalLine', 'subtitle', 'line', 'quote', 'evidence', 'sourceText', 'slug', 'schemaVersion', 'schema_version', 'kind', 'origin', 'stages', 'gates',
  ]);
  const isMachineKey = key => machineKeys.has(key) || /(?:Id|Ids|Hash|Path|File|Url)$/.test(key);
  const isMachineValue = value => /^(?:https?:\/\/|data:|blob:|file:\/\/)/i.test(value)
    || /^(?:\.{0,2}\/|[A-Za-z]:\\)/.test(value)
    || /^(?:[^\s/\\]+[/\\])+[^\n]+$/.test(value)
    || /^[^\s]+\.(?:png|jpe?g|webp|gif|svg|mp[34]|wav|json|html|txt)$/i.test(value)
    || /^(?:[A-Z]+\d+(?:[-_.][A-Za-z0-9]+)*|VO|OS|OFF)$/.test(value);

  function localize(data, language, translate) {
    if (!['vi', 'en', 'zh'].includes(language)) throw new Error('Unsupported export language');
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new TypeError('Expected a JSON document');
    function visit(value, key = '', ui = false) {
      ui = ui || key === 'ui';
      if (key === 'lang') return language;
      if (!ui && (isMachineKey(key) || /(?:prompt|promptNegative|sheet|visualDNA|styleDNA|h3Description|soundscapeEn|musicEn)$/i.test(key))) return clone(value);
      if (Array.isArray(value)) return value.map(item => visit(item, key, ui));
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, visit(item, name, ui)]));
      }
      if (typeof value !== 'string' || isMachineValue(value)) return value;
      // Provenance fields in character assets use these fixed tokens.
      if (key === 'source' && ['stated', 'inferred', 'default'].includes(value)) return value;
      return translate(value);
    }
    const clone = value => value && typeof value === 'object'
      ? Array.isArray(value) ? value.map(clone) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]))
      : value;
    const result = visit(data);
    if (data.kind === 'shuohao-project') {
      // Some saved documents (notably split.json and project.json) predate the lang field.
      for (const key of ['project','outline','cast','art','script','staging','storyboard','reading','production','split']) {
        if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) result[key].lang = language;
      }
    }
    return { ...result, lang: language };
  }
  const sections = {
    vi: { outline:'dan-y', cast:'nhan-vat', art:'my-thuat', script:'kich-ban', staging:'bo-tri', storyboard:'phan-canh', reading:'doc-hieu', production:'ho-so-dao-dien', asset:'tham-chieu-nhan-vat', all:'toan-bo', data:'du-lieu', split:'tach-kich-ban', subtitles:'phu-de', references:'anh-tham-chieu' },
    en: { outline:'outline', cast:'characters', art:'art', script:'screenplay', staging:'staging', storyboard:'storyboard', reading:'reading', production:'director-dossier', asset:'character-reference', all:'all', data:'data', split:'script-breakdown', subtitles:'subtitles', references:'reference-images' },
    zh: { outline:'大纲', cast:'角色', art:'美术', script:'剧本', staging:'站位', storyboard:'分镜', reading:'剧本理解', production:'导演档案', asset:'角色参考', all:'全部', data:'数据', split:'剧本拆分', subtitles:'字幕', references:'参考图片' },
  };
  function filename(section, project, language) {
    if (!sections[language]) throw new Error('Unsupported export language');
    if (!Object.hasOwn(sections[language], section)) throw new Error('Unknown export section');
    const clean = String(project || 'project').normalize('NFC')
      .replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'project';
    // Leave room for the section and locale even on filesystems with a 255-byte filename limit.
    let prefix = '', bytes = 0;
    const encoder = new TextEncoder();
    for (const letter of clean) {
      const size = encoder.encode(letter).length;
      if (bytes + size > 120) break;
      prefix += letter; bytes += size;
    }
    return `${prefix.replace(/-+$/g, '')}-${sections[language][section]}-${language}.json`;
  }
  const api = { localize, filename };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else globalThis.shuohaoJsonExport = api;
})();

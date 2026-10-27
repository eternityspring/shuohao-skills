/* Shared JSON export policy. JSON keys, asset paths and machine values stay stable. */
(() => {
  'use strict';
  const machineKeys = new Set([
    'id', 'tier', 'importance', 'weight', 'adaptMode', 'side', 'posture', 'facing',
    'readFrom', 'size', 'camera', 'stability', 'recipe', 'aspectRatio', 'protocol',
    'model', 'slot', 'status', 'medium', 'sha256', 'layersHash', 'lookHash',
    'file', 'filename', 'path', 'url', 'sheetImage', 'imagePath', 'imageFile',
    'promptLang', 'createdAt', 'updatedAt',
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
    function visit(value, key = '') {
      if (isMachineKey(key)) return clone(value);
      if (Array.isArray(value)) return value.map(item => visit(item, key));
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, visit(item, name)]));
      }
      if (typeof value !== 'string' || isMachineValue(value)) return value;
      // Provenance fields in character assets use these fixed tokens.
      if (key === 'source' && ['stated', 'inferred', 'default'].includes(value)) return value;
      return translate(value);
    }
    const clone = value => value && typeof value === 'object'
      ? Array.isArray(value) ? value.map(clone) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]))
      : value;
    return { ...visit(data), lang: language };
  }
  const api = { localize };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else globalThis.shuohaoJsonExport = api;
})();

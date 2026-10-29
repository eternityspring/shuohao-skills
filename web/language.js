/* Shared report localization. Source data and DOM identifiers stay unchanged. */
(() => {
  'use strict';
  const supported = new Set(['vi', 'en', 'zh']);
  const storageKey = 'shuohao.locale';
  const textRecords = new WeakMap();
  const attributeRecords = new WeakMap();
  const scriptUrl = document.currentScript.src;
  const rootUrl = new URL('./', scriptUrl);
  const ui = {
    vi: { home: 'Trang chủ', language: 'Ngôn ngữ', loading: 'Đang tải bản dịch…', error: 'Không tải được bản dịch. Hãy tải lại trang.' },
    en: { home: 'Home', language: 'Language', loading: 'Loading translations…', error: 'Translations could not be loaded. Please reload.' },
    zh: { home: '首页', language: '语言', loading: '正在加载翻译…', error: '无法加载翻译，请刷新页面。' },
  };
  let locale = 'vi';
  try {
    const value = new URL(location.href).searchParams.get('lang') || localStorage.getItem(storageKey);
    if (supported.has(value)) locale = value;
  } catch { /* Browser storage may be disabled. */ }
  document.documentElement.lang = locale;
  document.documentElement.classList.add('sh-locale-loading');
  const bar = document.createElement('div');
  bar.className = 'sh-langbar';
  bar.setAttribute('data-no-translate', '');
  bar.innerHTML = '<a class="sh-home" href="./"></a><span class="sh-locale-message" role="status"></span><label for="sh-language"></label><select id="sh-language" aria-label="Ngôn ngữ / Language / 语言"><option value="vi">Tiếng Việt</option><option value="en">English</option><option value="zh">中文</option></select>';
  document.body.prepend(bar);
  const select = bar.querySelector('select');
  const message = bar.querySelector('[role=status]');
  let lookup = new Map();
  let phraseLookup = new Map();
  let phrasePattern = null;
  const dynamicWords = {
    vi: { sits:'ngồi', stands:'đứng', 'on the':'ở trên', 'side of the':'phía của', 'facing':'hướng về', 'toward the north end':'gần đầu phía bắc', 'toward the south end':'gần đầu phía nam', 'toward the west end':'gần đầu phía tây', 'toward the east end':'gần đầu phía đông', 'in the middle':'ở giữa', 'just south of':'ngay phía nam của', 'just east of':'ngay phía đông của', 'background only':'chỉ làm nền', 'extra':'diễn viên quần chúng', 'extras':'diễn viên quần chúng', north:'bắc', northeast:'đông bắc', east:'đông', southeast:'đông nam', south:'nam', southwest:'tây nam', west:'tây', northwest:'tây bắc' },
    zh: { sits:'坐在', stands:'站在', 'on the':'在', 'side of the':'一侧', 'facing':'面朝', 'toward the north end':'靠北', 'toward the south end':'靠南', 'toward the west end':'靠西', 'toward the east end':'靠东', 'in the middle':'中段', 'just south of':'紧靠南侧', 'just east of':'紧靠东侧', 'background only':'只作背景', 'extra':'名群演', 'extras':'名群演', north:'北', northeast:'东北', east:'东', southeast:'东南', south:'南', southwest:'西南', west:'西', northwest:'西北' },
    en: {},
  };
  let observer;
  let ready = false;
  function updateBar() {
    bar.querySelector('.sh-home').textContent = '← ' + ui[locale].home;
    bar.querySelector('label').textContent = ui[locale].language;
    select.value = locale;
    message.textContent = ready ? '' : ui[locale].loading;
    bar.querySelector('.sh-home').href = new URL('./?lang=' + locale, rootUrl).href;
  }
  updateBar();
  const lockedTexts = new Set();
  const lockedKey = key => ['line','originalLine','subtitle','quote','evidence'].includes(key) || /(?:prompt|promptNegative|sheet|visualDNA|styleDNA|h3Description|soundscapeEn|musicEn)$/i.test(key);
  function rememberProductionText(value, key='', locked=false) {
    if (key === 'ui') return;
    const keep=locked || lockedKey(key);
    if(Array.isArray(value))value.forEach(item=>rememberProductionText(item,key,keep));
    else if(value && typeof value==='object')Object.entries(value).forEach(([k,v])=>rememberProductionText(v,k,keep));
    else if(keep && typeof value==='string')lockedTexts.add(value.trim());
  }
  document.querySelectorAll('script[type="application/json"]').forEach(script=>{try{rememberProductionText(JSON.parse(script.textContent))}catch{}});
  const skip = node => lockedTexts.has(node.data?.trim()) || node.parentElement?.closest('script,style,noscript,pre,[data-no-translate],[contenteditable=true],textarea:not([readonly]),input');
  function translate(value) {
    if (typeof value !== 'string' || !value.trim()) return value;
    const trimmed = value.trim();
    const exact = lookup.get(trimmed);
    const display = text => locale === 'vi' ? text.replace(/@\[图片(\d+)\]/g,'@[Ảnh$1]').replace(/@图片(\d+)/g,'@Ảnh$1') : locale === 'en' ? text.replace(/@\[图片(\d+)\]/g,'@[Image$1]').replace(/@图片(\d+)/g,'@Image$1') : text;
    if (exact) return display(value.replace(trimmed, exact));
    // Some reports combine labels and source prose into a single text node.
    return display(phrasePattern ? value.replace(phrasePattern, source => phraseLookup.get(source) ?? source) : value);
  }
  function translateNode(node, force = false) {
    if (skip(node)) return;
    const current = node.data;
    let record = textRecords.get(node);
    if (!record || current !== record.rendered) record = { source: current, rendered: current };
    if (force || current === record.source) {
      const translated = translate(record.source);
      if (translated !== current) node.data = translated;
      record.rendered = translated;
    }
    textRecords.set(node, record);
  }
  function translateAttributes(element, force = false) {
    if (element.closest('script,style,[data-no-translate],[contenteditable=true]')) return;
    let records = attributeRecords.get(element);
    if (!records) { records = new Map(); attributeRecords.set(element, records); }
    for (const name of ['title', 'alt', 'aria-label', 'placeholder']) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name);
      let record = records.get(name);
      if (!record || current !== record.rendered) record = { source: current, rendered: current };
      if (force || current === record.source) {
        const translated = translate(record.source);
        if (translated !== current) element.setAttribute(name, translated);
        record.rendered = translated;
      }
      records.set(name, record);
    }
  }
  function scan(root, force = false) {
    if (root.nodeType === Node.TEXT_NODE) return translateNode(root, force);
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root, force);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateNode(node, force);
    root.querySelectorAll('[title],[alt],[aria-label],[placeholder]').forEach(el => translateAttributes(el, force));
  }
  function setLocale(next, persist = true) {
    if (!supported.has(next) || !window.shuohaoTranslations) return;
    observer?.disconnect();
    locale = next;
    lookup = new Map();
    const phraseMap = new Map();
    for (const entry of window.shuohaoTranslations) {
      const translated = entry[locale];
      for (const source of [entry.source, entry.vi, entry.en, entry.zh]) {
        if (!source) continue;
        if (!lookup.has(source)) lookup.set(source, translated);
        if (source !== translated && source.length >= (/[\u3400-\u9fff]/.test(source) ? 2 : 4) && source.length <= 1000) {
          if (!phraseMap.has(source)) phraseMap.set(source, translated);
        }
      }
    }
    for(const [source,translated] of Object.entries(dynamicWords[locale])) if(!phraseMap.has(source)) phraseMap.set(source,translated);
    phraseLookup = phraseMap;
    const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expressions = [...phraseMap.keys()].sort((a,b) => b.length-a.length).map(source => {
      const chinese = /[\u3400-\u9fff]/.test(source);
      return (chinese ? '' : '(?<![\\p{L}\\p{N}_])') + escape(source) + (chinese ? '' : '(?![\\p{L}\\p{N}_])');
    });
    phrasePattern = expressions.length ? new RegExp(expressions.join('|'), 'gu') : null;
    document.documentElement.lang = locale;
    updateBar();
    scan(document, true);
    // Keep the active report pane and any edits; switching languages does not reload.
    try {
      const url = new URL(location.href);
      url.searchParams.set('lang', locale);
      history.replaceState(history.state, '', url);
      if (persist) localStorage.setItem(storageKey, locale);
    } catch { /* File previews and private storage remain usable. */ }
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || a.hasAttribute('download')) return;
      try {
        const target = new URL(href, location.href);
        if (target.origin === location.origin && (target.pathname.endsWith('.html') || target.pathname.endsWith('/'))) {
          target.searchParams.set('lang', locale);
          a.href = target.href;
        }
      } catch { /* Leave special links alone. */ }
    });
    document.documentElement.classList.remove('sh-locale-loading');
    observer?.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title','alt','aria-label','placeholder'] });
    document.dispatchEvent(new CustomEvent('shuohao:language', { detail: { language: locale } }));
  }
  observer = new MutationObserver(mutations => {
    observer.disconnect();
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') translateNode(mutation.target);
      else if (mutation.type === 'attributes') translateAttributes(mutation.target);
      else for (const node of mutation.addedNodes) scan(node);
    }
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title','alt','aria-label','placeholder'] });
  });
  select.addEventListener('change', () => setLocale(select.value));
  select.addEventListener('keydown', event => event.stopPropagation());
  addEventListener('storage', event => { if (event.key === storageKey && supported.has(event.newValue)) setLocale(event.newValue, false); });
  // Serialize a localized copy at click time; the live project remains untouched.
  function exportJson(data) {
    if (!ready) throw new Error(ui[locale].loading);
    return window.shuohaoJsonExport.localize(data, locale, translate);
  }
  function downloadJson(data, filename, options = {}) {
    const localized = exportJson(data);
    const url = URL.createObjectURL(new Blob([JSON.stringify(localized, null, 2) + '\n'], { type: 'application/json;charset=utf-8' }));
    const section = /(?:^|-)(outline|cast|art|script|staging|storyboard|reading|production|asset|all|split|subtitles|references)\.json$/i.exec(filename)?.[1]?.toLowerCase() || 'data';
    const projectPath = /^\/project\/([^/]+)\//.exec(location.pathname);
    const project = options.project || (projectPath ? decodeURIComponent(projectPath[1]) : data.project?.slug || translate(data.source || 'project'));
    const name = window.shuohaoJsonExport.filename(section, project, locale);
    const link = Object.assign(document.createElement('a'), { href: url, download: name });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  // Expose a small API for generated report additions and browser checks.
  window.shuohaoLanguage = { get: () => locale, set: setLocale, translate, exportJson, downloadJson };
  // Use the report's live state, rather than a translated copy, for blocking.
  if(document.getElementById('staging-data') && typeof core !== 'undefined' && typeof drawScene === 'function') {
    const diagnose=core.sceneProblems;
    core.sceneProblems=(scene,location) => diagnose(scene,location,locale);
    const blocking=core.stagingBlocking;
    core.stagingBlocking=(scene) => {
      const display={...scene,extrasWhere:translate(scene.extrasWhere || ''),places:(scene.places||[]).map(p=>({...p,name:translate(p.name),item:translate(p.item)}))};
      return blocking(display,locale);
    };
    document.addEventListener('shuohao:language',()=>{
      for(let i=0;i<doc.scenes.length;i++)drawScene(i);
    });
  }
  fetch(new URL('translations.json', rootUrl), { cache: 'no-cache' })
    .then(response => { if (!response.ok) throw Error('catalog'); return response.json(); })
    .then(entries => { window.shuohaoTranslations = entries; ready = true; setLocale(locale); })
    .catch(() => { message.textContent = ui[locale].error; document.documentElement.classList.remove('sh-locale-loading'); });
})();

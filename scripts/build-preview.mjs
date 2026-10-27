#!/usr/bin/env node
// Build the local reports with shared Vietnamese / English / Chinese controls.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'preview');
mkdirSync(out, { recursive: true });
mkdirSync(join(out, 'pipeline'), { recursive: true });
copyFileSync(join(root, 'web', 'studio.html'), join(out, 'pipeline', 'studio.html'));
for (const name of ['studio.mjs','project.mjs','split.mjs','upload.mjs','book.mjs','make-preview-video.mjs','import-manifest.mjs']) copyFileSync(join(root, 'web', 'server', name), join(out, 'pipeline', name));
const previewAssets = join(root, 'web', 'assets');
mkdirSync(join(out, 'images'), { recursive: true });
for (const name of ['outline','characters','art','script','storyboard','staging']) {
  const filename = `report-${name}.webp`;
  if (existsSync(join(previewAssets, filename))) copyFileSync(join(previewAssets, filename), join(out, 'images', filename));
}
const run = (relative, args) => execFileSync(process.execPath, [join(root, relative), ...args], {
  cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, NODE_OPTIONS: '' },
});
const sample = (skill, file) => join(root, 'skills', skill, 'examples', file);
const flagFiles = {
  '--outline': sample('novel-outline', '渡口-outline.json'),
  '--cast': sample('novel-characters', '渡口-cast.json'),
  '--art': sample('novel-art', '渡口-art.json'),
  '--script': sample('novel-script', '渡口-script.json'),
  '--storyboard': sample('novel-storyboard', '渡口-storyboard.json'),
};
console.log(run('scripts/report.mjs', [...Object.entries(flagFiles).flat(), '--out', join(out, 'report.html'), '--lang', 'en', '--title', '渡口']).trim());
writeFileSync(join(out, 'staging.html'), run('skills/novel-staging/scripts/novel-staging.mjs', ['render', sample('novel-staging','渡口-staging.json'), '--lang', 'en']));
const asset = join(out, 'characters', '阿禾', 'asset.json');
if (existsSync(asset)) console.log(run('skills/character-refs/scripts/character-refs.mjs', ['render', asset, '--out', join(out, 'character-refs.html'), '--lang', 'en']).trim());
// máy trạm: bản tĩnh của studio KHÔNG tạo được dự án (cần server ghi file) — nói rõ thay vì giả vờ
copyFileSync(join(root, 'web', 'studio-static.html'), join(out, 'studio.html'));
copyFileSync(join(root, 'web', 'index.html'), join(out, 'index.html'));
for (const name of ['language.js','json-export.js','language.css','translations.json']) copyFileSync(join(root, 'web', name), join(out, name));
for (const page of ['index.html','report.html','staging.html','character-refs.html','studio.html']) {
  const file = join(out, page);
  if (!existsSync(file)) continue;
  let html = readFileSync(file, 'utf8');
  html = html.replace(/<html\b([^>]*)>/i, (_m, attrs) => `<html${attrs.replace(/\s+lang="[^"]*"/i, '')} lang="vi" class="sh-locale-loading">`);
  html = html.replace('</head>', '<link rel="stylesheet" href="language.css"><script src="json-export.js" defer></script><script src="language.js" defer></script><noscript><style>.sh-locale-loading body>*{visibility:visible!important}</style></noscript></head>');
  writeFileSync(file, html);
}
console.log('Built reports with Vietnamese as the default and a language selector on every page.');
console.log('Studio cần server: node preview/pipeline/studio.mjs  →  http://127.0.0.1:8765/');

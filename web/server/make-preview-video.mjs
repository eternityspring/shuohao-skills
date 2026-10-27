import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const REPO = '/home/huynv/shuohao-skills';
const sbPath = resolve(REPO, 'skills/novel-storyboard/examples/渡口-storyboard.json');
const scriptPath = resolve(REPO, 'skills/novel-script/examples/渡口-script.json');
const sb = JSON.parse(readFileSync(sbPath, 'utf8'));
const script = JSON.parse(readFileSync(scriptPath, 'utf8'));

const W = 1280, H = 720, FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const outDir = '/tmp/kilo/preview-video';
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const count = Number(process.argv[2] ?? 3);
const narr = Boolean(process.argv[3] === '--narration');
const segs = [];
for (const ep of sb.episodes) for (const s of ep.segments) segs.push(s);
const pick = segs.slice(0, count);

const linesByEp = new Map();
for (const ep of script.episodes) {
  const lines = [];
  for (const sc of ep.scenes) for (const f of sc.flow) if (f.line) lines.push({ speaker: f.speaker, line: f.line, delivery: f.delivery });
  linesByEp.set(ep.ep, lines);
}

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '\u2019').replace(/%/g, '\\%');
const run = (args) => {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr.slice(-1500));
};

const clips = [];
for (const seg of pick) {
  const ep = Number(String(seg.id).match(/E(\d+)-/)?.[1] ?? 1);
  const lines = (linesByEp.get(ep) ?? []).slice(0, seg.cuts.length);
  const dur = seg.cuts.reduce((a, c) => a + c.seconds, 0) + 0.5;
  const clip = join(outDir, `${seg.id}.mp4`);
  const next = join(outDir, `${seg.id}-next.mp4`);
  const card = (t, i, c) => [
    `drawbox=x=40:y=40:w=1200:h=640:color=0x121212@1:t=fill`,
    `drawbox=x=56:y=56:w=1168:h=608:color=0x8a1c1c@1:t=4`,
    `drawtext=fontfile=${FONT}:text='${seg.id} · cut ${i + 1}/${seg.cuts.length} · ${c.seconds}s · ${c.camera}':fontcolor=0xd8d0c0:fontsize=26:x=90:y=110`,
    `drawtext=fontfile=${FONT}:text='${esc((c.frame ?? '').slice(0, 46))}':fontcolor=0xffffff:fontsize=34:x=90:y=250`,
    `drawtext=fontfile=${FONT}:text='${esc((c.frame ?? '').slice(46, 92))}':fontcolor=0xffffff:fontsize=34:x=90:y=300`,
    `drawtext=fontfile=${FONT}:text='${esc((c.size ?? '') + ' / ' + (c.lens ?? ''))}':fontcolor=0x9fd0ff:fontsize=24:x=90:y=380`,
    ...(lines[i] ? [`drawtext=fontfile=${FONT}:text='${esc(lines[i].line.slice(0, 44))}':fontcolor=0xffe08a:fontsize=40:x=90:y=560`, `drawtext=fontfile=${FONT}:text='${esc('（' + (lines[i].speaker ?? '') + '  ' + (lines[i].delivery ?? '') + '）')}':fontcolor=0xb0b0b0:fontsize=22:x=90:y=620`] : []),
    `drawtext=fontfile=${FONT}:text='PREVIEW · placeholder frames · t=${t.toFixed(1)}s':fontcolor=0x666666:fontsize=20:x=90:y=660`,
  ].join(',');

  const parts = [];
  let t = 0;
  seg.cuts.forEach((c, i) => {
    const vf = card(t, i, c);
    parts.push(`[${i}:v]${vf},fade=t=in:st=0:d=0.3[v${i}]`);
    t += c.seconds;
  });
  const concatInputs = seg.cuts.map((_, i) => `[v${i}]`).join('');
  const filter = [...parts, `${concatInputs}concat=n=${seg.cuts.length}:v=1:a=0[v]`].join(';');
  const args = ['-y', '-loglevel', 'error'];
  seg.cuts.forEach((c) => args.push('-f', 'lavfi', '-t', String(c.seconds), '-i', `color=c=black:s=${W}x${H}:r=25`));
  args.push('-filter_complex', filter, '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25', clip);
  run(args);

  const af = [];
  seg.cuts.forEach(() => {});
  const audioArgs = ['-y', '-loglevel', 'error'];
  if (!narr) {
    audioArgs.push('-i', clip, '-f', 'lavfi', '-t', String(dur), '-i', 'anullsrc=r=44100:cl=stereo', '-shortest', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', next);
  } else {
    let filter = '';
    let idx = 0;
    const ins = [];
    seg.cuts.forEach((c, i) => {
      const txt = lines[i]?.line;
      if (!txt) { filter += `anullsrc=r=44100:cl=stereo,atrim=0:${c.seconds},apad=whole_dur=${c.seconds}[a${i}];`; }
      else {
        const tf = join(outDir, `t_${seg.id}_${i}.txt`);
        writeFileSync(tf, txt);
        audioArgs.push("-f","lavfi","-i",`flite=textfile=${tf}:voice=slt`);
        filter += `[${idx}:a]atrim=0:${c.seconds},asetpts=PTS-STARTPTS,apad=whole_dur=${c.seconds},volume=1.0[a${i}];`;
      }
      idx += 1;
    });
    audioArgs.push('-i', clip);
    void af; void ins;
    const labels = seg.cuts.map((_, i) => `[a${i}]`).join('');
    const graph = `${filter}${labels}concat=n=${seg.cuts.length}:v=0:a=1[a]`;
    audioArgs.push('-filter_complex', graph, '-map', `${idx}:v`, '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', next);
  }
  if (process.env.DBG) console.log(JSON.stringify(audioArgs));
  run(audioArgs);
  clips.push(next);
}

const list = join(outDir, 'list.txt');
writeFileSync(list, clips.map((c) => `file '${c.replace(/'/g, `'\\''`)}'`).join('\n'));
const final = `/tmp/kilo/${narr ? 'preview-narration' : 'preview-silent'}.mp4`;
run(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', final]);
console.log('out:', final);
console.log('segments:', pick.map((s) => s.id).join(', '));
void q;

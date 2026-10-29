import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseObject, normalizeOptions, safeError, composeH3, validateStage, generateProject, ROOT, writeJSON, readJSON, jobFile, STAGES } from './ai-project.mjs';
import { validateStoryboard } from '../skills/novel-storyboard/scripts/novel-storyboard.mjs';
import { prepareTiming } from './production-timing.mjs';
import { validateOutline } from '../skills/novel-outline/scripts/novel-outline.mjs';
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++};
assert.deepEqual(parseObject('```json\n{"a":1}\n```'),{a:1});checks++;
for(const bad of ['[]','null','text {"a":1}','{"a":']){assert.throws(()=>parseObject(bad));checks++}
const options={episodes:2,seconds:120,genre:'tâm lý',model:'cx/gpt-6.1-sol',lang:'vi'};
assert.equal(normalizeOptions(options).aspectRatio,'16:9');checks++;
for(const patch of [{episodes:0},{episodes:1.5},{episodes:-1},{seconds:-1},{seconds:Infinity},{model:'cx/gpt-image-2'}]){assert.throws(()=>normalizeOptions({...options,...patch}));checks++}
assert.equal(normalizeOptions({}).episodes,null);checks++;
assert.equal(normalizeOptions({}).seconds,null);checks++;
assert.equal(normalizeOptions({}).planningMode,'content-first');checks++;
assert.equal(normalizeOptions({episodes:100,seconds:3600}).seconds,3600);checks++;
ok(!safeError(new Error('Bearer abc SECRETKEY'),'SECRETKEY').includes('SECRETKEY'),'credential redaction');
const load=(skill,stage)=>JSON.parse(readFileSync(join(ROOT,'skills',skill,'examples','渡口-'+stage+'.json'),'utf8'));
const outline=load('novel-outline','outline');
const one=structuredClone(outline);one.params.episodes=1;one.episodes=[one.episodes[0]];one.characters=one.characters.filter(c=>one.episodes[0].characterIds.includes(c.id));one.scenes=one.scenes.filter(s=>one.episodes[0].sceneIds.includes(s.id));one.props=(one.props||[]).filter(p=>one.episodes[0].propIds.includes(p.id));one.beats=[{...one.beats[0],episode:1,weight:'major'}];one.props.forEach(p=>{p.beatIds=[]});
ok(!validateOutline(one).some(p=>p.includes('大爆点')),'one-episode film permits its climax');
const flexible=normalizeOptions({episodes:1,seconds:1,lang:'zh'});
const full=structuredClone(outline);full.params.adaptMode='忠实';full.adaptation.cut=[];full.adaptation.merge=[];prepareTiming('outline',full,flexible);
assert.deepEqual(validateStage('outline',full,{},flexible,''),[]);checks++; // All six real outline episodes may exceed the one-episode suggestion.
const script=load('novel-script','script');const board=load('novel-storyboard','storyboard');board.lang='vi';
for(const ep of board.episodes)for(const seg of ep.segments)for(const cut of seg.cuts){cut.size='medium';cut.frame='trung cảnh nhân vật đứng cạnh mạn thuyền trong sương';cut.shot='Máy quay giữ nhân vật ở giữa khung hình, người khách nhìn về cửa.';cut.h3Description='A passenger looks toward the entrance in the established foggy cabin.';}
composeH3(board,script);
ok(validateStoryboard(board,{script}).length===0,'Vietnamese visual prose passes all structural, duration, dialogue and coverage gates');
const broken=structuredClone(board);broken.episodes[0].segments[0].cuts[0].frame='A view without its shot size label';
ok(validateStoryboard(broken,{script}).some(p=>p.includes('trung cảnh')),'Vietnamese still checks shot size label');
const chinese=structuredClone(board);chinese.episodes[0].segments[0].cuts[0].shot='一个人看着门';
ok(validateStoryboard(chinese,{script}).some(p=>p.includes('language must match vi')),'wrong prose language rejected');
const gap=structuredClone(board);gap.episodes[0].segments[0].cuts.shift();composeH3(gap,script);
ok(validateStoryboard(gap,{script}).some(p=>p.includes('没人认领')),'beat omission rejected');
const expandedBoard=structuredClone(board);
for(const ep of expandedBoard.episodes) {
 const segments=[];
 for(const original of ep.segments) {
  let part;
  for(const originalCut of original.cuts) {
   if(!part || part.cuts.length===3){part={...structuredClone(original),cuts:[]};segments.push(part)}
   part.cuts.push({...structuredClone(originalCut),seconds:5});
  }
 }
 segments.forEach((segment,i)=>segment.id='E'+String(ep.ep).padStart(2,'0')+'-'+String(i+1).padStart(2,'0'));
 ep.segments=segments;
}
composeH3(expandedBoard,script);
ok(validateStoryboard(expandedBoard,{script}).some(e=>e.includes('总时长')),'legacy storyboard still enforces the episode budget');
const untimedScript=prepareTiming('script',structuredClone(script),flexible);
assert.deepEqual(validateStoryboard(expandedBoard,{script:untimedScript}),[]);checks++; // All beats now get readable 5s shots without being cut to fit the old budget.
const missingBeat=structuredClone(expandedBoard);missingBeat.episodes[0].segments[0].cuts.shift();composeH3(missingBeat,untimedScript);
ok(validateStoryboard(missingBeat,{script:untimedScript}).some(e=>e.includes('没人认领')),'content-first storyboard still rejects missing beats');

const dir=mkdtempSync(join(tmpdir(),'shuohao-ai-test-'));
try {
 const source=readFileSync(join(ROOT,'skills/novel-characters/examples/渡口.txt'),'utf8');
 writeFileSync(join(dir,'kichban.md'),source);writeFileSync(join(dir,'book.txt'),source);
 const opts={episodes:6,seconds:120,genre:'民国情感悬疑',lang:'zh',model:'test',aspectRatio:'16:9'};
 writeJSON(join(dir,'project.json'),{stages:{}});writeJSON(jobFile(dir),{options:opts,stages:{}});
 const faithful=structuredClone(outline);faithful.params.adaptMode='忠实';faithful.adaptation.cut=[];faithful.adaptation.merge=[];
 let calls=0;
 const request=async messages=>{calls++;if(messages[0].content.includes('novel-outline skill'))return faithful;throw new Error('connection test SECRETKEY');};
 await assert.rejects(generateProject(dir,{config:{key:'SECRETKEY',model:'test'},request}));checks++;
 let job=readJSON(jobFile(dir));assert.equal(job.status,'failed');checks++;assert.equal(job.stages.outline.status,'passed');checks++;ok(!job.error.includes('SECRETKEY'),'persistent error redacts key');ok(existsSync(join(dir,'outline.json')),'validated stage committed before later failure');
 let errors=readJSON(jobFile(dir)).errors;assert.equal(errors.length,1);checks++;assert.equal(errors[0].stage,'cast');checks++;
 const errorLog=join(dir,'.ai','errors.jsonl');ok(!readFileSync(errorLog,'utf8').includes('SECRETKEY'),'error log redacts credentials');
 calls=0;await assert.rejects(generateProject(dir,{config:{key:'SECRETKEY',model:'test'},request}));checks++;assert.equal(calls,1,'resume skips approved outline');checks++;
 const countBeforeCancel=readFileSync(errorLog,'utf8').trim().split('\n').length;
 const controller=new AbortController();controller.abort();await assert.rejects(generateProject(dir,{signal:controller.signal,request}));checks++;assert.equal(readJSON(jobFile(dir)).status,'cancelled');checks++;
 assert.equal(readJSON(jobFile(dir)).error,null);checks++;
 assert.equal(readJSON(jobFile(dir)).transport,null);checks++;
 assert.equal(readFileSync(errorLog,'utf8').trim().split('\n').length,countBeforeCancel,'cancellation adds no error log');checks++;
} finally {rmSync(dir,{recursive:true,force:true})}
console.log('Passed '+checks+' AI orchestration, language, security and resume checks.');

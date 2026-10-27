import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseObject, normalizeOptions, safeError, composeH3, validateStage, generateProject, ROOT, writeJSON, readJSON, jobFile, STAGES } from './ai-project.mjs';
import { validateStoryboard } from '../skills/novel-storyboard/scripts/novel-storyboard.mjs';
import { validateOutline } from '../skills/novel-outline/scripts/novel-outline.mjs';
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++};
assert.deepEqual(parseObject('```json\n{"a":1}\n```'),{a:1});checks++;
for(const bad of ['[]','null','text {"a":1}','{"a":']){assert.throws(()=>parseObject(bad));checks++}
const options={episodes:2,seconds:120,genre:'tâm lý',model:'cx/gpt-6.1-sol',lang:'vi'};
assert.equal(normalizeOptions(options).aspectRatio,'16:9');checks++;
for(const patch of [{episodes:0},{episodes:1.5},{episodes:61},{seconds:14},{seconds:601},{genre:''},{model:'cx/gpt-image-2'}]){assert.throws(()=>normalizeOptions({...options,...patch}));checks++}
ok(!safeError(new Error('Bearer abc SECRETKEY'),'SECRETKEY').includes('SECRETKEY'),'credential redaction');
const load=(skill,stage)=>JSON.parse(readFileSync(join(ROOT,'skills',skill,'examples','渡口-'+stage+'.json'),'utf8'));
const outline=load('novel-outline','outline');
const one=structuredClone(outline);one.params.episodes=1;one.episodes=[one.episodes[0]];one.characters=one.characters.filter(c=>one.episodes[0].characterIds.includes(c.id));one.scenes=one.scenes.filter(s=>one.episodes[0].sceneIds.includes(s.id));one.props=(one.props||[]).filter(p=>one.episodes[0].propIds.includes(p.id));one.beats=[{...one.beats[0],episode:1,weight:'major'}];one.props.forEach(p=>{p.beatIds=[]});
ok(!validateOutline(one).some(p=>p.includes('大爆点')),'one-episode film permits its climax');
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
 calls=0;await assert.rejects(generateProject(dir,{config:{key:'SECRETKEY',model:'test'},request}));checks++;assert.equal(calls,1,'resume skips approved outline');checks++;
 const controller=new AbortController();controller.abort();await assert.rejects(generateProject(dir,{signal:controller.signal,request}));checks++;assert.equal(readJSON(jobFile(dir)).status,'cancelled');checks++;
} finally {rmSync(dir,{recursive:true,force:true})}
console.log('Passed '+checks+' AI orchestration, language, security and resume checks.');

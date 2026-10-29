// Offline integration through the actual six skill gates, persisted jobs, segment enrichment and renderers.
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync,cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateProject,writeJSON,readJSON,jobFile,ROOT,STAGES,composeH3,validateStage } from './ai-project.mjs';
import { normalizeOptions } from './ai-project.mjs';
import { prepareTiming } from './production-timing.mjs';
import { loadBrain,validateProduction,continuityStateHash } from './studio-brain.mjs';
import { AITransportError,withTransportRetry } from './ai-transport.mjs';
import { productionFixture } from './fixtures/production-story.mjs';
const base=productionFixture();const clone=structuredClone;
const load=(skill,stage)=>JSON.parse(readFileSync(join(ROOT,'skills',skill,'examples','渡口-'+stage+'.json'),'utf8'));
const ctx={outline:load('novel-outline','outline'),cast:load('novel-characters','cast'),art:load('novel-art','art'),script:load('novel-script','script'),staging:load('novel-staging','staging'),storyboard:load('novel-storyboard','storyboard'),brain:loadBrain()};
const source=readFileSync(join(ROOT,'skills/novel-characters/examples/渡口.txt'),'utf8');
const options={episodes:6,seconds:120,genre:'民国情感悬疑',lang:'zh',model:'offline-test',aspectRatio:'16:9',productionProfile:ctx.brain.version};
ctx.reading={...clone(base.reading),source:ctx.outline.source,lang:'zh',facts:[{id:'F01',quote:source.trim().split('\n').find(s=>s.trim()),meaning:'故事原文'}]};
ctx.outline.lang='zh';ctx.outline.params.adaptMode='忠实';ctx.outline.adaptation.cut=[];ctx.outline.adaptation.merge=[];
ctx.outline.production={...clone(base.outline.production),pacing:ctx.outline.episodes.map(ep=>({...clone(base.outline.production.pacing[0]),ep:ep.ep}))};
for(const c of ctx.cast.characters){c.id=ctx.outline.characters.find(x=>x.name===c.name).id;c.production=clone(base.cast.characters[0].production);c.production.visualDNA=c.image.prompt;}
ctx.art.production=clone(base.art.production);
for(const s of ctx.art.scenes)s.production=clone(base.art.scenes[0].production);
for(const p of ctx.art.props)p.production=clone(base.art.props[0].production);
for(const ep of ctx.script.episodes)for(const s of ep.scenes)for(const beat of s.flow)if(beat.line){beat.acting=clone(base.script.episodes[0].scenes[0].flow[1].acting);beat.acting.listeners=s.characters.filter(id=>id!==beat.speaker).map(characterId=>({characterId,action:'双手搭在膝上，视线停在门边。'}));}
for(const s of ctx.staging.scenes){s.production=clone(base.staging.scenes[0].production);s.production.screenPositions=s.places.filter(p=>p.present).map((p,i)=>({characterId:p.id,position:'画面'+i+' '+p.item,gaze:p.facing}));}
// The storyboard example contains one episode. Repack its existing cuts into <=15s segments after raising 2s cuts to 3s.
const template=ctx.storyboard.episodes[0];
const plans=[];
for(const scriptEp of ctx.script.episodes.slice(0,1)) {
 const segments=[];
 if(scriptEp.ep===1) {
  for(const old of template.segments){let current=null;for(const cut of old.cuts){const c=clone(cut);c.seconds=Math.max(3,c.seconds);if(!current||current.cuts.reduce((n,x)=>n+x.seconds,0)+c.seconds>15){current={...clone(old),cuts:[]};segments.push(current)}current.cuts.push(c);}}
 }
 segments.forEach((s,i)=>s.id='E'+String(scriptEp.ep).padStart(2,'0')+'-'+String(i+1).padStart(2,'0'));
 plans.push({ep:scriptEp.ep,segments});
}
ctx.storyboard={...ctx.storyboard,lang:'zh',aspectRatio:'16:9',episodes:plans};
for(const ep of ctx.storyboard.episodes) {
 let previous=null;
 for(const [si,seg] of ep.segments.entries()) {
  const scene=ctx.script.episodes.find(e=>e.ep===ep.ep).scenes[seg.sceneIndex-1];
  const staging=ctx.staging.scenes.find(s=>s.ep===ep.ep&&s.scene===seg.sceneIndex);
  seg.soundscapeEn='River water and soft footfalls on wood.';
  for(const [ci,c] of seg.cuts.entries()) {
   c.h3Description='A passenger shifts weight and settles the hands against the cloth.';
   const p=clone(base.storyboard.episodes[0].segments[0].cuts[0].production);
   p.timeline[2].to=c.seconds;
   p.face=c.characters.map(characterId=>({...clone(p.face[0]),characterId}));
   const speaking=scene.flow.slice(c.beats[0]-1,c.beats[1]).filter(b=>b.line).map(b=>b.speaker);
   p.listeners=scene.characters.filter(id=>!speaking.includes(id)).map(characterId=>({characterId,action:'手掌搭在膝盖，目光落向门边。'}));
   p.startState={cameraSide:staging.production.cameraSide,lightingDirection:staging.production.lightingDirection,characters:scene.characters.map(characterId=>({...staging.production.screenPositions.find(x=>x.characterId===characterId),characterId,position:staging.production.screenPositions.find(x=>x.characterId===characterId)?.position||'船舱后部',gaze:staging.production.screenPositions.find(x=>x.characterId===characterId)?.gaze||'门边',pose:'站在地板上。'})),props:(scene.props||[]).map(propId=>({propId,location:'固定在船舱地板上。',state:'静止。'}))};
   if(previous?.sceneIndex===seg.sceneIndex)p.startState=clone(previous.cut.production.endState);
   p.endState=clone(p.startState);
   if(previous && previous.sceneIndex!==seg.sceneIndex)p.sceneLink={previousSegmentId:previous.segmentId,fromSceneIndex:previous.sceneIndex,toSceneIndex:seg.sceneIndex,previousEndStateHash:continuityStateHash(previous.cut.production.endState),storyConnection:'上一场人物的反应引出下一场动作，保持故事次序与情绪。'};
   const nextScene=ci<seg.cuts.length-1?seg.sceneIndex:ep.segments[si+1]?.sceneIndex;
   p.handover.type=nextScene!=null&&nextScene!==seg.sceneIndex?'scene-change':'hold';
   p.keyframePrompt=ctx.art.production.styleDNA+' '+c.characters.map(id=>ctx.cast.characters.find(x=>x.id===id).production.visualDNA).join(' ')+' Eye-level view, fixed starting poses, soft light from the left.';
   c.production=p;previous={segmentId:seg.id,sceneIndex:seg.sceneIndex,cut:c};
  }
 }
}
composeH3(ctx.storyboard,ctx.script,ctx.cast);
// This integration only needs one episode; use the existing validated episode to keep the fixture's timing faithful.
// Full six-episode sample plans may have different editorial timing, so select its first episode everywhere.
options.episodes=1;
ctx.outline.params.episodes=1;ctx.outline.episodes=ctx.outline.episodes.slice(0,1);ctx.outline.production.pacing=ctx.outline.production.pacing.slice(0,1);
ctx.outline.characters=ctx.outline.characters.filter(c=>ctx.outline.episodes[0].characterIds.includes(c.id));
ctx.outline.scenes=ctx.outline.scenes.filter(s=>ctx.outline.episodes[0].sceneIds.includes(s.id));
ctx.outline.props=(ctx.outline.props||[]).filter(p=>ctx.outline.episodes[0].propIds.includes(p.id));ctx.outline.beats=[{...ctx.outline.beats[0],episode:1,weight:'major'}];ctx.outline.props.forEach(p=>p.beatIds=[]);
ctx.outline.scenes.forEach(s=>s.reusePlan='复用现有场景与机位。');
ctx.cast.characters=ctx.cast.characters.filter(c=>ctx.outline.characters.some(x=>x.id===c.id));
ctx.art.scenes=ctx.art.scenes.filter(s=>ctx.outline.scenes.some(x=>x.id===s.id));ctx.art.props=ctx.art.props.filter(p=>ctx.outline.props.some(x=>x.id===p.id));
ctx.script.episodes=ctx.script.episodes.slice(0,1);ctx.staging.scenes=ctx.staging.scenes.filter(s=>s.ep===1);ctx.staging.locations=ctx.staging.locations.filter(s=>ctx.art.scenes.some(x=>x.id===s.sceneId));ctx.storyboard.episodes=ctx.storyboard.episodes.slice(0,1);
for(const stage of STAGES)ctx[stage].lang='zh';
ctx.script.params={charsPerSecond:4.5,actionSeconds:2.5,tolerance:.15,maxLineChars:35,hookWindow:3};
for(const stage of STAGES)assert.deepEqual(validateStage(stage,ctx[stage],ctx,options,source),[],stage);
const dir=mkdtempSync(join(tmpdir(),'brain-integration-'));
try {
 writeFileSync(join(dir,'kichban.md'),source);writeFileSync(join(dir,'book.txt'),source);
 writeJSON(join(dir,'project.json'),{stages:{},lang:'zh'});writeJSON(jobFile(dir),{options,stages:{}});
 const calls=[],repaired=new Set();let checkProgress=true,maxConcurrentRequests=0;
 const request=async (messages,{onStatus,signal}={})=>{
  if(onStatus){
   for(const phase of ['waiting','retrying','receiving']){
    onStatus({phase,attempt:1,maxAttempts:4});
    if(checkProgress){const live=readJSON(jobFile(dir));maxConcurrentRequests=Math.max(maxConcurrentRequests,live.transport.activeRequests);assert.equal(live.status,'running');assert.equal(live.error,null);assert.ok(live.transport.requests.some(p=>p.phase===phase),'per-request phase is retained throughout sequential direction');assert.equal(live.transport.activeRequests,live.transport.requests.length);assert.ok(!existsSync(join(dir,'.ai','errors.jsonl')))}
   }
  }
  const system=messages[0].content;const input=JSON.parse(messages[1].content);
  if(system.includes('screenplay reader')){calls.push('reading');if(!repaired.has('reading')){repaired.add('reading');throw Object.assign(Error('Invalid generated JSON'),{code:'AI_JSON_INVALID'})}return clone(ctx.reading)}
  if(system.includes('ONE storyboard segment')){
   if(!repaired.has('providerRecovery')){
    let transientCalls=0,sawRecovery=false;
    await withTransportRetry(async()=>{if(++transientCalls<=4)throw new AITransportError('9router trả lỗi HTTP 503.',{retryable:true,code:'HTTP_503'});return true},{config:{maxRetries:1,retryDelayMs:1,availabilityRetryMs:1},signal,onStatus:p=>{onStatus(p);if(p?.phase==='recovering'){sawRecovery=true;const live=readJSON(jobFile(dir));assert.equal(live.status,'running');assert.equal(live.error,null);assert.equal(live.transport.phase,'recovering');assert.ok(!existsSync(join(dir,'.ai','errors.jsonl')))}}});
    assert.ok(sawRecovery);assert.equal(transientCalls,5);repaired.add('providerRecovery');
   }
   calls.push(input.segment.id);if(!repaired.has('segment')){repaired.add('segment');throw Object.assign(Error('Invalid segment JSON'),{code:'AI_JSON_INVALID'})}return clone(ctx.storyboard.episodes[0].segments.find(s=>s.id===input.segment.id))}
  const stage=STAGES.find(s=>system.includes('novel-'+(s==='cast'?'characters':s)+' skill'));
  assert.ok(stage,'known request');calls.push(stage);
  const doc=clone(ctx[stage]);
  if(stage==='storyboard')for(const ep of doc.episodes)for(const seg of ep.segments)for(const cut of seg.cuts)delete cut.production;
  return doc;
 };
 const job=await generateProject(dir,{config:{key:'offline-test'},request});
 checkProgress=false;
 assert.equal(maxConcurrentRequests,1,'each detail request waits for the actual preceding scene result');
 assert.equal(job.error,null);assert.equal(job.transport,null);assert.ok(!existsSync(join(dir,'.ai','errors.jsonl')),'automatic JSON repairs and temporary connection states do not create error logs');
 assert.equal(calls.filter(x=>x==='reading').length,2,'reading JSON repaired automatically');assert.ok(repaired.has('segment'),'segment JSON repaired automatically');
 assert.equal(job.status,'completed');assert.equal(job.reading.status,'passed');assert.ok(STAGES.every(s=>job.stages[s].status==='passed'));
 assert.equal(calls[0],'reading');assert.equal(calls.filter(x=>x==='storyboard').length,1);
 assert.ok(calls.includes('E01-01'));assert.ok(existsSync(join(dir,'production-report.html')));assert.ok(existsSync(join(dir,'production.json')));
 const dossier=readJSON(join(dir,'production.json'));assert.equal(dossier.storyboard[0].segments.length,ctx.storyboard.episodes[0].segments.length);
 const firstPrompt=readJSON(join(dir,'storyboard.json')).episodes[0].segments[0].h3Prompt;
 assert.ok(firstPrompt.includes(ctx.cast.characters[0].production.visualDNA));
 const again=await generateProject(dir,{config:{key:'offline-test'},request:()=>{throw Error('approved job must not call AI')}});assert.equal(again.status,'completed');
 // Regression: detailed production cards produce >1 MiB HTML. Resume must render it completely without AI.
 const large=readJSON(join(dir,'storyboard.json'));
 const detail=' The same character remains grounded beside the fixed doorway, with soft light from the left.';
 large.episodes[0].segments[0].cuts[0].production.motionPrompt+=detail.repeat(12000);
 assert.deepEqual(validateStage('storyboard',large,ctx,options,source),[]);
 writeJSON(join(dir,'.ai','approved','storyboard.json'),large);
 writeJSON(join(dir,'storyboard.json'),large);
 const rendered=await generateProject(dir,{config:{key:'offline-test'},request:()=>{throw Error('large report resume must not call AI')}});
 assert.equal(rendered.status,'completed');
 for(const name of ['storyboard-report.html','report.html']) {
  const html=readFileSync(join(dir,name),'utf8');
  assert.ok(Buffer.byteLength(html)>1024*1024,name+' exceeds the default child-process buffer');
  assert.match(html,/<\/html>\s*$/i,name+' is complete');
  assert.ok(html.includes(detail.trim()),name+' retains the full production data');
 }
 console.log('PASS: production reports above 1 MiB render completely from approved snapshots without another AI request.');
 // Content-first requests deliberately disagree with the actual one-episode plan and its runtime.
 for(const hints of [{episodes:3,seconds:1},{}]) {
  const flexible=join(dir,hints.episodes?'soft-hints':'automatic');
  const opts={...normalizeOptions({...hints,lang:'zh',model:'offline-test'}),productionProfile:ctx.brain.version};
  writeJSON(join(flexible,'project.json'),{stages:{},lang:'zh'});
  writeFileSync(join(flexible,'kichban.md'),source);writeFileSync(join(flexible,'book.txt'),source);
  writeJSON(jobFile(flexible),{options:opts,stages:{}});
  const result=await generateProject(flexible,{config:{key:'offline-test'},request});
  assert.equal(result.status,'completed');assert.equal(result.timing.plannedEpisodes,1);
  assert.equal(result.timing.requested.episodes,hints.episodes??null);
  assert.equal(result.timing.requested.secondsPerEpisode,hints.seconds??null);
  assert.ok(result.timing.scriptSeconds>1);assert.ok(result.timing.storyboardSeconds>1);
  const savedScript=readJSON(join(flexible,'script.json'));
  assert.equal(savedScript.params.timingMode,'content-first');assert.equal(savedScript.episodes[0].estimatedSeconds,result.timing.scriptSeconds);
  assert.deepEqual(savedScript.episodes[0].scenes,ctx.script.episodes[0].scenes,'full story and dialogue preserved');
  assert.deepEqual(readJSON(join(flexible,'project.json')).timing,result.timing);
  const cached=await generateProject(flexible,{config:{key:'offline-test'},request:()=>{throw Error('content-first resume must use approved work')}});
  assert.equal(cached.status,'completed');assert.equal(cached.timing.plannedEpisodes,1);
 }
 // Choosing English before generation automatically publishes a separate validated edition.
 const englishDir=join(dir,'english-dialogue');
 writeJSON(join(englishDir,'project.json'),{stages:{},lang:'zh'});
 writeFileSync(join(englishDir,'kichban.md'),source);writeFileSync(join(englishDir,'book.txt'),source);
 writeJSON(jobFile(englishDir),{options:{...options,dialogueLanguage:'en'},stages:{}});
 writeJSON(join(englishDir,'.ai','approved','reading.json'),ctx.reading);
 for(const stage of STAGES)writeJSON(join(englishDir,'.ai','approved',stage+'.json'),ctx[stage]);
 let translationCalls=0;
 const translate=async messages=>{
   assert.match(messages[0].content,/film localization translator/);translationCalls++;
   return {translations:JSON.parse(messages[1].content).entries.map(entry=>({id:entry.id,text:'English '+entry.id.slice(0,8)+(entry.requiredTokens?.length?' '+entry.requiredTokens.join(' '):'')}))};
 };
 const localized=await generateProject(englishDir,{config:{key:'offline-test'},request:translate});
 assert.equal(localized.status,'completed');assert.ok(translationCalls>0);
 const englishJob=readJSON(join(englishDir,'.ai','english-job.json'));
 assert.equal(englishJob.status,'completed');
 const manifest=readJSON(join(englishDir,'project.json'));assert.equal(manifest.activeEdition,englishJob.edition);
 const editionDir=join(englishDir,englishJob.edition),englishScript=readJSON(join(editionDir,'script.json'));
 assert.equal(englishScript.lang,'en');assert.equal(englishScript.dialogueLang,'en');
 const originalLines=ctx.script.episodes.flatMap(e=>e.scenes.flatMap(s=>s.flow.filter(b=>b.line).map(b=>b.line)));
 const newLines=englishScript.episodes.flatMap(e=>e.scenes.flatMap(s=>s.flow.filter(b=>b.line)));
 assert.deepEqual(newLines.map(b=>b.subtitle),originalLines);assert.deepEqual(newLines.map(b=>b.originalLine),originalLines);
 assert.ok(newLines.every(b=>b.line.startsWith('English ')));
 assert.deepEqual(readJSON(join(englishDir,'script.json')),ctx.script,'the original approved script is preserved');
 assert.ok(readFileSync(join(editionDir,'script-report.html'),'utf8').includes('original-subtitle'));
 assert.ok(readFileSync(join(editionDir,'storyboard-report.html'),'utf8').includes('original-subtitle'));
 const englishBoard=readJSON(join(editionDir,'storyboard.json'));
 const editionManifest=readJSON(join(editionDir,'project.json'));
 assert.equal(editionManifest.params.genre,readJSON(join(editionDir,'outline.json')).params.genre);
 assert.equal(editionManifest.timing.scriptSeconds,Math.round(englishScript.episodes.reduce((sum,ep)=>sum+ep.estimatedSeconds,0)*10)/10);
 assert.equal(editionManifest.timing.storyboardSeconds,englishBoard.episodes.reduce((sum,ep)=>sum+ep.segments.reduce((n,seg)=>n+seg.cuts.reduce((m,cut)=>m+cut.seconds,0),0),0));
 assert.equal(editionManifest.promptLang,'en');
 assert.ok(englishBoard.episodes[0].segments.some(s=>s.h3Prompt.includes('<d>[English]')));
 const subtitles=readJSON(join(editionDir,'subtitles.json'));assert.equal(subtitles.cues.length,originalLines.length);
 assert.ok(readFileSync(join(editionDir,'subtitles-bilingual.srt'),'utf8').includes(originalLines[0]));
 const {translateProject}=await import('./english-project.mjs');
 await translateProject(englishDir,{config:{key:'offline-test'},request:()=>{throw Error('published English edition must reuse cached translations')}});
 // Cancellation never publishes partial English data and a retry reuses completed batches.
 const interrupted=join(dir,'english-interrupted');cpSync(englishDir,interrupted,{recursive:true});
 rmSync(join(interrupted,'editions'),{recursive:true,force:true});rmSync(join(interrupted,'.ai','english-cache.json'),{force:true});
 const originalManifest=readJSON(join(interrupted,'project.json'));delete originalManifest.activeEdition;writeJSON(join(interrupted,'project.json'),originalManifest);
 const abortEnglish=new AbortController();let partialCalls=0;
 await assert.rejects(translateProject(interrupted,{config:{key:'offline-test'},signal:abortEnglish.signal,request:async messages=>{partialCalls++;const result=await translate(messages);abortEnglish.abort();return result}}));
 assert.equal(readJSON(join(interrupted,'.ai','english-job.json')).status,'cancelled');
 assert.equal(readJSON(join(interrupted,'project.json')).activeEdition,undefined);
 assert.ok(Object.keys(readJSON(join(interrupted,'.ai','english-cache.json')).translations).length>0);
 let remainingCalls=0;
 await translateProject(interrupted,{config:{key:'offline-test'},request:async messages=>{remainingCalls++;return translate(messages)}});
 assert.ok(remainingCalls>0);assert.equal(partialCalls,1);
 assert.deepEqual(readJSON(join(interrupted,'script.json')),ctx.script);
 if(process.env.SHUOHAO_ENGLISH_FIXTURE_DIR){assert.equal(existsSync(process.env.SHUOHAO_ENGLISH_FIXTURE_DIR),false);cpSync(englishDir,process.env.SHUOHAO_ENGLISH_FIXTURE_DIR,{recursive:true});console.log('Browser fixture: '+process.env.SHUOHAO_ENGLISH_FIXTURE_DIR)}
 console.log('PASS: English dialogue selected before generation -> real validated English edition, original subtitles/SRT, English H3 speech, source preservation and zero-call resume.');
 console.log('PASS: optional/mismatched planning estimates, content-derived runtime, complete story, real gates/renderers, legacy and content-first no-call resume.');
 console.log('PASS: transient waiting/retry/receiving states persisted without errors; invalid reading and segment JSON automatically repaired.');
 console.log('PASS: screenplay reading → six real skill validators → per-segment details → production report/JSON → no-call resume. AI responses are mocked; no external API call.');
}finally{rmSync(dir,{recursive:true,force:true})}

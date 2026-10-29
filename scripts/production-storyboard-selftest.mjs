// Regression contract for sequential story context, scene handoffs, cache and cancellation.
// Uses the project's own production fixture; no model or network requests.
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { detailErrors, enrichStoryboard } from './production-storyboard.mjs';
import { loadBrain, validateProduction, continuityStateHash, dossierData, renderDossier } from './studio-brain.mjs';
import { productionFixture } from './fixtures/production-story.mjs';

const clone=structuredClone;
let checks=0;
async function test(label,run){await run();checks++;console.log('PASS '+label)}
function scenario(sceneIndices=[1,1,2,2,3,3]) {
 const ctx=productionFixture();ctx.brain=loadBrain();
 const firstScene=clone(ctx.script.episodes[0].scenes[0]),firstStaging=clone(ctx.staging.scenes[0]);
 ctx.script.episodes[0].scenes=Array.from({length:Math.max(...sceneIndices)},(_,i)=>({...clone(firstScene),sceneId:'S'+String(i+1).padStart(2,'0')}));
 ctx.staging.scenes=ctx.script.episodes[0].scenes.map((_,i)=>({...clone(firstStaging),scene:i+1}));
 const base=clone(ctx.storyboard.episodes[0].segments[0]);
 const plan={...clone(ctx.storyboard),episodes:[{ep:1,segments:sceneIndices.map((sceneIndex,i)=>{
  const seg={...clone(base),id:'E01-'+String(i+1).padStart(2,'0'),sceneIndex};
  for(const cut of seg.cuts)delete cut.production;
  return seg;
 })}]};
 const details=new Map();let previous;
 for(const [i,segment] of plan.episodes[0].segments.entries()) {
  const doc=clone(segment),production=clone(base.cuts[0].production);
  if(previous?.sceneIndex===segment.sceneIndex)production.startState=clone(previous.cuts.at(-1).production.endState);
  production.endState=clone(production.startState);
  production.endState.characters[0].pose='Hai chân đứng vững, tay hạ sát sườn sau nhịp '+segment.id+'.';
  const next=plan.episodes[0].segments[i+1];
  production.handover={type:next&&next.sceneIndex!==segment.sceneIndex?'scene-change':'hold',reason:next&&next.sceneIndex!==segment.sceneIndex?'Cắt sang cảnh tiếp theo sau khi bàn tay dừng.':'Giữ đúng tư thế cuối để nối nhịp tiếp theo.'};
  if(previous && previous.sceneIndex!==segment.sceneIndex)production.sceneLink={previousSegmentId:previous.id,fromSceneIndex:previous.sceneIndex,toSceneIndex:segment.sceneIndex,previousEndStateHash:continuityStateHash(previous.cuts.at(-1).production.endState),storyConnection:'Cử chỉ cuối cảnh trước dẫn sang phản ứng và hành động tiếp theo trong câu chuyện.'};
  doc.cuts[0].production=production;details.set(doc.id,doc);previous=doc;
 }
 return {ctx,plan,details,segments:plan.episodes[0].segments};
}
const inputOf=messages=>JSON.parse(messages[1].content);
const approved=(fixture,id)=>clone(fixture.details.get(id));
function assertMerged(doc,fixture){assert.deepEqual(validateProduction('storyboard',doc,fixture.ctx),[],'merged board retains full continuity gates')}
function callbacks(fixture,cache=new Map()) {
 return {source:fixture.ctx.source,readSaved:id=>clone(cache.get(id)||null),saveApproved:(id,doc)=>cache.set(id,clone(doc))};
}

await test('outgoing transition is checked on the segment that owns it, before caching',async()=>{
 const f=scenario([1,1,2,2]),lastOfScene=approved(f,'E01-02');
 assert.deepEqual(detailErrors(lastOfScene,f.segments[1],1,{...f.ctx,nextSceneIndex:2}),[]);
 lastOfScene.cuts.at(-1).production.handover.type='hold';
 assert.ok(detailErrors(lastOfScene,f.segments[1],1,{...f.ctx,nextSceneIndex:2}).length,'stale hold before a scene change rejected locally');
 const sameScene=approved(f,'E01-01');sameScene.cuts.at(-1).production.handover.type='scene-change';
 assert.ok(detailErrors(sameScene,f.segments[0],1,{...f.ctx,nextSceneIndex:1}).length,'no scene-change between same-scene segments');
 const final=approved(f,'E01-04');final.cuts.at(-1).production.handover.type='scene-change';
 assert.ok(detailErrors(final,f.segments[3],1,{...f.ctx,nextSceneIndex:null}).length,'episode ending does not jump to an invented scene');
});

await test('internal cuts cannot announce a scene change inside one segment',async()=>{
 const f=scenario([1]),doc=approved(f,'E01-01'),original=clone(f.segments[0]);
 const cut=clone(doc.cuts[0]);cut.production.startState=clone(doc.cuts[0].production.endState);
 doc.cuts.push(cut);original.cuts.push(clone(original.cuts[0]));
 doc.cuts[0].production.handover.type='scene-change';
 assert.ok(detailErrors(doc,original,1,{...f.ctx,nextSceneIndex:null}).length);
 doc.cuts[0].production.handover.type='match-on-action';
 assert.deepEqual(detailErrors(doc,original,1,{...f.ctx,nextSceneIndex:null}),[]);
});

await test('resume repairs only stale outgoing handover cache and preserves all valid segments',async()=>{
 const f=scenario([1,1,2,2]),cache=new Map([...f.details].map(([id,doc])=>[id,clone(doc)]));
 cache.get('E01-02').cuts.at(-1).production.handover.type='hold';
 const calls=[],saved=[];
 const result=await enrichStoryboard(f.plan,f.ctx,f.ctx.options,{...callbacks(f,cache),concurrency:2,
  request:async messages=>{const {segment}=inputOf(messages);calls.push(segment.id);return approved(f,segment.id)},
  saveApproved:(id,doc)=>{saved.push(id);cache.set(id,clone(doc))}
 });
 assert.deepEqual(calls,['E01-02']);assert.deepEqual(saved,['E01-02']);assertMerged(result,f);
 let resumedCalls=0;
 const resumed=await enrichStoryboard(f.plan,f.ctx,f.ctx.options,{...callbacks(f,cache),concurrency:2,request:async()=>{resumedCalls++;throw Error('valid cache must not call AI')}});
 assert.equal(resumedCalls,0);assert.deepEqual(resumed,result);assertMerged(resumed,f);
});

await test('all scenes consume the actual predecessor and immutable common story in order',async()=>{
 const f=scenario(),events=[],progress=[],cache=new Map();let active=0,peak=0;
 const result=await enrichStoryboard(f.plan,f.ctx,f.ctx.options,{...callbacks(f,cache),
  onProgress:p=>progress.push(clone(p)),
  request:async(messages,{signal}={})=>{
   const input=inputOf(messages),{segment}=input;
   const previous=f.segments[f.segments.findIndex(s=>s.id===segment.id)-1];
   assert.deepEqual(input.episodeScript,f.ctx.script.episodes[0],'entire episode is shared, not isolated scenes');
   assert.deepEqual(input.episodePlan.map(s=>s.id),f.segments.map(s=>s.id),'immutable editorial order is shared');
   if(previous){
    assert.ok(events.includes('end:'+previous.id),'previous scene/segment finishes first');
    assert.deepEqual(input.previousSegment,f.details.get(previous.id),'actual acting, audio and state from predecessor is supplied');
    assert.deepEqual(input.previousEndState,f.details.get(previous.id).cuts.at(-1).production.endState);
    assert.equal(input.continuesScene,previous.sceneIndex===segment.sceneIndex);
    if(!input.continuesScene)assert.equal(input.sceneLinkRequirements.previousEndStateHash,continuityStateHash(input.previousEndState));
   }else {assert.equal(input.previousSegment,null);assert.equal(input.previousEndState,null)}
   active++;peak=Math.max(peak,active);events.push('start:'+segment.id);
   try{await delay(segment.sceneIndex===1?35:5,undefined,{signal});return approved(f,segment.id)}
   finally{active--;events.push('end:'+segment.id)}
  }
 });
 assert.equal(peak,1,'one creative sequence across scene boundaries');assert.equal(active,0);
 assert.ok(events.indexOf('start:E01-03')>events.indexOf('end:E01-02'),'next scene waits for the actual preceding scene');
 assert.ok(events.indexOf('end:E01-03')>events.indexOf('end:E01-02'),'completion follows story order');
 assert.deepEqual(result.episodes[0].segments.map(s=>s.id),f.segments.map(s=>s.id),'merge restores deterministic plan order');
 assert.equal(cache.size,f.segments.length);assertMerged(result,f);
 assert.ok(progress.length);assert.equal(progress.at(-1).completed,f.segments.length);assert.equal(progress.at(-1).total,f.segments.length);
 assert.ok(progress.every(p=>Array.isArray(p.activeSegments)&&p.activeSegments.length<=1));
 assert.ok(progress.every(p=>p.completed>=0&&p.completed<=p.total));
});

await test('legacy concurrency options cannot bypass sequential creative direction',async()=>{
 for(const concurrency of [1,99]){
  const f=scenario([1,2,3,4,5]),events=[];let active=0,peak=0;
  const result=await enrichStoryboard(f.plan,f.ctx,f.ctx.options,{...callbacks(f),concurrency,
   request:async(messages,{signal}={})=>{
    const {segment}=inputOf(messages);active++;peak=Math.max(peak,active);events.push(segment.id);
    try{await delay(5,undefined,{signal});return approved(f,segment.id)}finally{active--}
   }
  });
  assert.equal(active,0);assert.equal(peak,1);assert.deepEqual(events,f.segments.map(s=>s.id));
  assertMerged(result,f);
 }
});

await test('invalid detail is repaired before the first cache write',async()=>{
 const f=scenario([1]);let calls=0,saved=0;
 const result=await enrichStoryboard(f.plan,f.ctx,f.ctx.options,{...callbacks(f),concurrency:1,
  request:async()=>{calls++;const candidate=approved(f,'E01-01');if(calls===1)candidate.cuts[0].production.timeline[2].to=2;return candidate},
  saveApproved:(_id,doc)=>{saved++;assert.deepEqual(detailErrors(doc,f.segments[0],1,{...f.ctx,nextSceneIndex:null}),[])}
 });
 assert.equal(calls,2);assert.equal(saved,1);assertMerged(result,f);
});

await test('exhausted detail repairs include the owning segment and never save invalid output',async()=>{
 const f=scenario([1]);let calls=0,saved=0;
 await assert.rejects(enrichStoryboard(f.plan,f.ctx,f.ctx.options,{...callbacks(f),concurrency:1,
  request:async()=>{calls++;const candidate=approved(f,'E01-01');candidate.cuts[0].production.timeline[2].to=2;return candidate},
  saveApproved:()=>saved++
 }),/E01-01/);
 assert.equal(calls,3);assert.equal(saved,0);
});

await test('fatal detail failure stops before launching the next scene',async()=>{
 const f=scenario([1,2,3]),started=[],cleaned=[];let active=0,saved=0;
 await assert.rejects(enrichStoryboard(f.plan,f.ctx,f.ctx.options,{...callbacks(f),concurrency:2,
  request:async(messages,{signal}={})=>{
   const {segment}=inputOf(messages);started.push(segment.id);active++;
   try{
    if(segment.id==='E01-01'){await delay(15);throw Error('test provider failed')}
    try{await delay(500,undefined,{signal})}catch(error){await delay(15);throw error}
    return approved(f,segment.id);
   }finally{active--;cleaned.push(segment.id)}
  },saveApproved:()=>saved++
 }),/E01-01/);
 assert.equal(active,0,'active request has settled before error escapes');assert.deepEqual(started,['E01-01']);
 assert.equal(cleaned.length,1);assert.equal(saved,0,'aborted siblings cannot commit new output');
});

await test('manual cancellation stops active workers, launches no queued scene and waits for cleanup',async()=>{
 const f=scenario([1,2,3]),controller=new AbortController(),started=[];let active=0,saved=0;
 const timer=setTimeout(()=>controller.abort(),15);
 try{
  await assert.rejects(enrichStoryboard(f.plan,f.ctx,f.ctx.options,{...callbacks(f),signal:controller.signal,concurrency:2,
   request:async(messages,{signal}={})=>{
    const {segment}=inputOf(messages);started.push(segment.id);active++;
    try{try{await delay(500,undefined,{signal})}catch(error){await delay(15);throw error}return approved(f,segment.id)}finally{active--}
   },saveApproved:()=>saved++
  }),error=>error.name==='AbortError');
 }finally{clearTimeout(timer)}
 assert.equal(active,0);assert.deepEqual(started,['E01-01']);assert.equal(saved,0);
 const stopped=new AbortController();stopped.abort();let newCalls=0;
 await assert.rejects(enrichStoryboard(f.plan,f.ctx,f.ctx.options,{...callbacks(f),signal:stopped.signal,request:async()=>newCalls++}),error=>error.name==='AbortError');
 assert.equal(newCalls,0);
});

await test('legacy scene-opening caches are reconciled with the actual predecessor before reuse',async()=>{
 const f=scenario([1,1,2,2]),cache=new Map([...f.details].map(([id,doc])=>[id,clone(doc)]));
 delete cache.get('E01-03').cuts[0].production.sceneLink;
 const calls=[];
 const result=await enrichStoryboard(f.plan,f.ctx,f.ctx.options,{...callbacks(f,cache),request:async messages=>{const input=inputOf(messages);calls.push(input.segment.id);assert.equal(input.previousSegment.id,'E01-02');assert.equal(input.sceneLinkRequirements.previousSegmentId,'E01-02');return approved(f,input.segment.id)}});
 assert.deepEqual(calls,['E01-03']);assertMerged(result,f);
 const data=dossierData({...f.ctx,storyboard:result});
 assert.equal(data.storyboard[0].segments[2].cuts[0].sceneLink.previousSegmentId,'E01-02');
 for(const [lang,label] of [['vi','Mạch hành động và cảm xúc'],['en','Narrative and emotional connection'],['zh','情节与情绪衔接']])assert.ok(renderDossier(data,lang).includes(label),'scene link is visible in each report language');
 const damaged=clone(result);damaged.episodes[0].segments[2].cuts[0].production.sceneLink.previousEndStateHash='outdated';
 assert.ok(validateProduction('storyboard',damaged,f.ctx).some(e=>e.includes('actual approved predecessor')),'a stale boundary reference fails the final merged gate');
 const unconnected=clone(result);delete unconnected.episodes[0].segments[2].cuts[0].production.sceneLink;
 assert.ok(validateProduction('storyboard',unconnected,f.ctx).some(e=>e.includes('sceneLink')),'new-format complete caches cannot skip scene linkage');
 const unsupported=clone(result);unsupported.episodes[0].segments[2].cuts[0].production.sceneLink.storyConnection='';
 assert.ok(validateProduction('storyboard',unsupported,f.ctx).some(e=>e.includes('storyConnection')),'narrative connection is required');
});
console.log('Passed '+checks+' sequential story, scene-link, cache, ordering, quality and cancellation scenarios. No external AI calls.');

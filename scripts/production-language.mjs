// Field-level translation preserves the film structure, source evidence and original subtitle text.
import {createHash} from 'node:crypto';
export const ENGLISH_POLICY='production-english-v1';
export const PROMPT_KEY=/(?:prompt|promptNegative|sheet|visualDNA|styleDNA|h3Description|soundscapeEn|musicEn)$/i;
const MACHINE=new Set(['id','ep','scene','sceneIndex','speaker','tier','importance','weight','adaptMode','scale','side','posture','facing','readFrom','size','camera','stability','recipe','aspectRatio','protocol','model','slot','status','medium','sha256','layersHash','lookHash','file','filename','path','url','sheetImage','imagePath','imageFile','promptLang','lang','dialogueLang','subtitleLang','beatsClaimed','createdAt','updatedAt','slug','schemaVersion','schema_version','kind','origin','phase','type','version','planningMode','timingMode','sourceHash','previousEndStateHash']);
const nonEnglish=/[À-ɏ\u1e00-\u1eff㐀-鿿가-힯]/u;
const technical=(key,text)=>MACHINE.has(key)||/(?:Id|Ids|Hash|Path|File|Url)$/.test(key)||/^(?:https?:|data:|blob:|\.\.?\/)/i.test(text)||/^[^\s]+\.(?:png|jpe?g|webp|gif|svg|mp[34]|wav|json|html|txt)$/i.test(text)||/^(?:[A-Z]+\d+(?:[-_.][A-Za-z0-9]+)*|VO|OS|OFF)$/.test(text);
const digest=text=>createHash('sha256').update(text).digest('hex');
export function validatePromptLanguage(doc) {
 const errors=[];
 function walk(value,key='',path=''){
  if(key==='ui')return; // UI labels named prompt are not production prompt content.
  if(Array.isArray(value)){value.forEach((item,index)=>walk(item,key,path+'/'+index));return}
  if(value && typeof value==='object'){Object.entries(value).forEach(([k,v])=>walk(v,k,path+'/'+k));return}
  if(typeof value==='string' && PROMPT_KEY.test(key)){
   const text=key==='h3Prompt'?value.replace(/<d>[\s\S]*?<\/d>/g,''):value;
   if(nonEnglish.test(text))errors.push(path+' must use English production prompts');
  }
 }
 walk(doc);return errors;
}
export function dialogueBudgets(docs) {
 const map=new Map(),speed=16;
 for(const ep of docs.storyboard?.episodes || [])for(const seg of ep.segments || [])for(const cut of seg.cuts || []){
  const scene=docs.script?.episodes.find(x=>x.ep===ep.ep)?.scenes[seg.sceneIndex-1];
  const lines=(scene?.flow || []).slice(cut.beats[0]-1,cut.beats[1]).filter(x=>typeof x.line==='string');
  const total=lines.reduce((n,b)=>n+b.line.replace(/\s/g,'').length,0);
  for(const b of lines){const limit=Math.max(1,Math.floor(cut.seconds*speed*(b.line.replace(/\s/g,'').length/(total||1))));map.set(b.line,Math.min(map.get(b.line)??80,80,limit));}
 }
 return map;
}
export function translationUnits(docs) {
 const units=new Map(),names=new Set((docs.cast?.characters || []).flatMap(c=>[c.name,...(c.aliases||[])])),budgets=dialogueBudgets(docs);
 function walk(v,key='',path='',parent=''){
  if(technical(key,''))return;
  if(key==='h3Prompt'||key==='originalLine'||key==='subtitle'||key==='sourceText'||key==='quote'||key==='evidence')return;
  if(Array.isArray(v)){v.forEach((item,i)=>walk(item,key,path+'/'+i,parent));return}
  if(v && typeof v==='object'){Object.entries(v).forEach(([k,x])=>walk(x,k,path+'/'+k,key));return}
  if(typeof v!=='string'||!v.trim()||technical(key,v)||names.has(v))return;
  const prompt=PROMPT_KEY.test(key);
  // Existing English production prompts are immutable DNA and need no translation call.
  if(prompt&&!nonEnglish.test(v))return;
  const id=digest(v),kind=key==='line'?'dialogue':prompt?'prompt':'prose';
  const existing=units.get(id),maxCharacters=key==='line'?(budgets.get(v)??80):undefined;
  units.set(id,{id,text:v,kind:existing?.kind==='dialogue'?'dialogue':kind,paths:[...(existing?.paths || []),path],...(maxCharacters?{maxCharacters:Math.min(existing?.maxCharacters??Infinity,maxCharacters)}:{})});
 }
 for(const [name,doc] of Object.entries(docs))walk(doc,'',name);
 const requireWords=(text,words)=>{const entry=units.get(digest(text || ''));if(entry)entry.requiredTokens=[...new Set([...(entry.requiredTokens || []),...words])]};
 for(const prop of docs.art?.props || []){
  const scale={'手持级':'handheld scale','桌面级':'tabletop scale','家具级':'furniture scale'}[prop.scale];
  requireWords(prop.image?.prompt,[...(scale?[scale]:[]),'pure white background']);
 }
 const sizes={wide:'wide shot',medium:'medium shot',close:'close-up','extreme-wide':'extreme wide shot','extreme-close':'extreme close-up'};
 for(const ep of docs.storyboard?.episodes || [])for(const seg of ep.segments || [])for(const cut of seg.cuts || [])if(sizes[cut.size])requireWords(cut.frame,[sizes[cut.size]]);
 return {units:[...units.values()],names:[...names]};
}
export function checkTranslations(reply,entries,names=[]) {
 const problems=[],rows=reply?.translations;
 if(!Array.isArray(rows))return ['translations must be an array'];
 const ids=new Set(entries.map(x=>x.id)),seen=new Set();
 for(const row of rows){
  if(!ids.has(row.id)||seen.has(row.id))problems.push('Unknown or duplicate translation ID: '+row.id);
  seen.add(row.id);const source=entries.find(x=>x.id===row.id);
  if(typeof row.text!=='string'||!row.text.trim()){problems.push('Empty translation: '+row.id);continue}
  let prose=row.text;for(const name of names)prose=prose.split(name).join('');
  if(nonEnglish.test(prose))problems.push('Use English for '+row.id+'; preserve proper names only');
  for(const token of source?.requiredTokens || [])if(!row.text.toLowerCase().includes(token.toLowerCase()))problems.push('Translation '+row.id+' must include production term: '+token);
  if(source?.maxCharacters&&row.text.replace(/\s/g,'').length>source.maxCharacters)problems.push('Dialogue '+row.id+' must fit '+source.maxCharacters+' non-whitespace characters without losing meaning');
 }
 for(const entry of entries)if(!seen.has(entry.id))problems.push('Missing translation: '+entry.id);
 return problems;
}
export function translatedDocuments(docs,translations) {
 const {units}=translationUnits(docs),allowed=new Set(units.map(x=>x.id));
 const translate=(text)=>allowed.has(digest(text))?translations[digest(text)]??text:text;
 function walk(v,key=''){
  if(key==='lang'||key==='promptLang')return 'en';
  if(technical(key,'')||['originalLine','subtitle','subtitleLang','quote','evidence','sourceText'].includes(key))return structuredClone(v);
  if(Array.isArray(v))return v.map(x=>walk(x,key));
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x,k)]));
  return typeof v==='string'?translate(v):v;
 }
 const result=Object.fromEntries(Object.entries(docs).map(([key,doc])=>[key,{...walk(doc),lang:'en',promptLang:'en'}]));
 if(result.script){
  result.script.dialogueLang='en';result.script.subtitleLang=docs.script.subtitleLang || docs.script.lang;
  result.script.params={...result.script.params,charsPerSecond:16,maxLineChars:80};
  for(const [ei,ep] of result.script.episodes.entries())for(const [si,sc] of ep.scenes.entries())for(const [bi,b] of sc.flow.entries())if(typeof b.line==='string'){
   const old=docs.script.episodes[ei].scenes[si].flow[bi];
   b.originalLine=old.originalLine || old.line;b.subtitle=old.subtitle || b.originalLine;b.subtitleLang=old.subtitleLang || docs.script.lang;b.dialogueLang='en';
  }
 }
 return result;
}
export function subtitleTracks(script,board) {
 const cues=[];let at=0;
 for(const ep of board.episodes || [])for(const seg of ep.segments || [])for(const [ci,cut] of seg.cuts.entries()){
  const scene=script.episodes.find(e=>e.ep===ep.ep)?.scenes[seg.sceneIndex-1];
  const lines=(scene?.flow || []).slice(cut.beats[0]-1,cut.beats[1]).filter(b=>typeof b.line==='string');
  const total=lines.reduce((n,b)=>n+b.line.replace(/\s/g,'').length,0);let cursor=at;
  for(const b of lines){const duration=cut.seconds*b.line.replace(/\s/g,'').length/(total||1);cues.push({ep:ep.ep,segment:seg.id,cut:ci+1,speaker:b.speaker,from:cursor,to:cursor+duration,line:b.line,subtitle:b.subtitle || b.originalLine || b.line,subtitleLang:b.subtitleLang || script.subtitleLang || script.lang});cursor+=duration}
  at+=cut.seconds;
 }
 const clock=seconds=>{const ms=Math.round(seconds*1000);return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(n=>String(n).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0')};
 const srt=both=>cues.map((c,i)=>`${i+1}\n${clock(c.from)} --> ${clock(c.to)}\n${(both?c.line+'\n':'')+c.subtitle}\n`).join('\n');
 return {cues,original:srt(false),bilingual:srt(true)};
}

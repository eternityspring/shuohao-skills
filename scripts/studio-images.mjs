// Durable image jobs use server-side 9router credentials and saved English production prompts.
import {existsSync,readFileSync,writeFileSync,mkdirSync,rmSync,copyFileSync,symlinkSync,realpathSync} from 'node:fs';
import {join,resolve,dirname,relative,basename} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ROOT,aiConfig,readJSON,writeJSON,safeError} from './ai-project.mjs';
import {activeEditionDir} from './project-edition.mjs';
import {validatePromptLanguage} from './production-language.mjs';
import {slug} from '../skills/novel-storyboard/scripts/novel-storyboard.mjs';
import {pngInfo,chunks,crc32} from '../skills/character-refs/scripts/png.mjs';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const busy=job=>['queued','running'].includes(job?.status);
const jobFile=dir=>join(dir,'.ai','images-job.json');
const indexFile=dir=>join(dir,'reference-images.json');
const load=file=>existsSync(file)?readJSON(file):null;
export function imageConfig(env=process.env){
 const local={};const file=join(ROOT,'.env.local');
 if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){
  const m=line.match(/^\s*(SHUOHAO_IMAGE_MODEL|SHUOHAO_IMAGE_QUALITY|SHUOHAO_IMAGE_TIMEOUT_MS|SHUOHAO_IMAGE_REFERENCE_MODE)\s*=\s*(.*?)\s*$/);
  if(m)local[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
 }
 const get=name=>env[name]||local[name];
 const timeout=Number(get('SHUOHAO_IMAGE_TIMEOUT_MS')||0);
 return {...aiConfig(env),model:get('SHUOHAO_IMAGE_MODEL')||'cx/gpt-image-2',referenceMode:['json','multipart'].includes(get('SHUOHAO_IMAGE_REFERENCE_MODE'))?get('SHUOHAO_IMAGE_REFERENCE_MODE'):'auto',quality:['low','medium','high','auto'].includes(get('SHUOHAO_IMAGE_QUALITY'))?get('SHUOHAO_IMAGE_QUALITY'):'high',timeoutMs:Number.isSafeInteger(timeout)&&timeout>=0&&timeout<=2147483647?timeout:0};
}
function release(dir,id){
 const lock=join(dir,'.ai','run.lock');
 if(load(join(lock,'image-owner.json'))?.id===id)rmSync(lock,{recursive:true,force:true});
}
export function imageStatus(dir){
 const job=load(jobFile(dir));
 if(busy(job)){
  let alive=false;
  try{if(Number.isInteger(job.pid)){process.kill(job.pid,0);const args=readFileSync('/proc/'+job.pid+'/cmdline','utf8').split('\0');alive=args.includes(join(ROOT,'scripts/studio-images.mjs'))&&args.includes(dir)}}catch{}
  if(!alive){job.status='interrupted';job.error='Lượt tạo ảnh đã gián đoạn. Ảnh cũ được giữ nguyên; có thể bấm tạo lại.';writeJSON(jobFile(dir),job);release(dir,job.id)}
 }
 return job;
}
function safeFile(dir,file){
 if(typeof file!=='string'||!file.startsWith('images/references/'))return null;
 const path=resolve(dir,file);
 if(!path.startsWith(resolve(dir,'images','references')+'/'))return null;
 if(!existsSync(path)||!realpathSync(path).startsWith(realpathSync(dir)+'/'))return null;
 return path;
}
export function imageCatalog(dir){
 const edition=activeEditionDir(dir),docs={};
 for(const key of ['cast','art','script','storyboard'])docs[key]=load(join(edition,key+'.json'));
 const items=[],style=docs.art?.production?.styleDNA||'';
 const add=(kind,id,label,prompt,negative='',refs=[],extra={})=>{
  if(!prompt)return;
  const productionPrompt=[style,prompt,negative?'Avoid: '+negative:''].filter(Boolean).join('\n');
  items.push({assetId:kind+':'+id,kind,entityId:id,label,prompt:productionPrompt,promptHash:hash(productionPrompt),dependencies:[...new Set(refs)],...extra});
 };
 for(const c of docs.cast?.characters||[])add('character',c.id,c.name,c.image?.prompt,c.image?.negativePrompt,[],{ratio:'2:3'});
 for(const s of docs.art?.scenes||[]){
  add('scene',s.id,s.name,s.image?.prompt,s.image?.negativePrompt,[],{ratio:'16:9'});
  for(const [i,light] of (s.lighting||[]).entries())add('lighting',s.id+':'+(i+1),s.name+' · '+light.state,light.prompt,s.image?.negativePrompt,['scene:'+s.id],{ratio:'16:9',parentId:s.id});
 }
 for(const p of docs.art?.props||[]){
  add('prop',p.id,p.name,p.image?.prompt,p.image?.negativePrompt,[],{ratio:'1:1'});
  for(const [i,state] of (p.states||[]).entries())add('state',p.id+':'+(i+1),p.name+' · '+state.state,state.prompt,p.image?.negativePrompt,['prop:'+p.id],{ratio:'1:1',parentId:p.id});
 }
 for(const ep of docs.storyboard?.episodes||[])for(const seg of ep.segments||[])for(const [i,cut] of (seg.cuts||[]).entries()){
  const scene=docs.script?.episodes?.find(e=>e.ep===ep.ep)?.scenes?.[seg.sceneIndex-1];
  add('frame',seg.id+':'+(i+1),seg.id+' · #'+(i+1),cut.production?.keyframePrompt,'text, watermark, inconsistent identity, extra limbs',[
   ...(scene?.sceneId?['scene:'+scene.sceneId]:[]),...(cut.characters||[]).filter(c=>c!=='VO').map(c=>'character:'+c),...(cut.props||[]).map(p=>'prop:'+p),
  ],{ratio:docs.storyboard.aspectRatio||'16:9',segment:seg.id,cut:i+1});
 }
 const saved=load(indexFile(dir))||{schemaVersion:1,assets:{}};
 const byId=new Map(items.map(item=>[item.assetId,item]));
 function current(id,visited=new Set()){
  if(visited.has(id))return false;visited.add(id);
  const item=byId.get(id),record=saved.assets[id];
  return !!(item&&record&&safeFile(dir,record.file)&&record.promptHash===item.promptHash&&item.dependencies.every(dep=>current(dep,new Set(visited))&&record.references?.find(ref=>ref.assetId===dep)?.sha256===saved.assets[dep]?.sha256));
 }
 return items.map(item=>{
  const record=saved.assets[item.assetId],present=record&&safeFile(dir,record.file);
  const missing=item.dependencies.filter(id=>!current(id));
  const errors=validatePromptLanguage({prompt:item.prompt});
  return {...item,image:present?record:null,stale:!!present&&!current(item.assetId),missing:missing.map(id=>({assetId:id,label:byId.get(id)?.label||id})),blocked:errors.length?'Prompt cần bằng tiếng Anh. Hãy chuyển dự án sang tiếng Anh trước.':missing.length?'Tạo ảnh tham chiếu trước: '+missing.map(id=>byId.get(id)?.label||id).join(', '):item.dependencies.length>16?'Mỗi ảnh hỗ trợ tối đa 16 ảnh tham chiếu.':null};
 });
}
export function imageView(dir){
 const config=imageConfig();return {configured:!!config.key,model:config.model,job:imageStatus(dir),items:imageCatalog(dir)};
}
const sizes={'2:3':'1024x1536','16:9':'1536x864','9:16':'864x1536','1:1':'1024x1024'};
export async function requestImage(item,{config=imageConfig(),signal,onStatus=()=>{}}={}){
 if(!config.key)throw Error('Chưa cấu hình khóa 9router ở server.');
 const refs=item.references||[],common={model:config.model,prompt:item.prompt,size:sizes[item.ratio]||sizes['16:9'],quality:config.quality,n:1,output_format:'png'};
 let body,contentType;
 const routerReferences=refs.length&&(config.referenceMode==='json'||(config.referenceMode!=='multipart'&&/^cx\//.test(config.model)));
 if(routerReferences){body=Buffer.from(JSON.stringify({...common,images:refs.map(ref=>'data:image/png;base64,'+readFileSync(ref.path).toString('base64'))}));contentType='application/json'}
 else if(refs.length){
  const form=new FormData();for(const [key,value] of Object.entries(common))form.append(key,String(value));
  for(const ref of refs)form.append('image[]',new Blob([readFileSync(ref.path)],{type:'image/png'}),basename(ref.path));
  const packed=new Response(form);body=Buffer.from(await packed.arrayBuffer());contentType=packed.headers.get('content-type');
 }else{body=Buffer.from(JSON.stringify(common));contentType='application/json'}
 if(body.length>64*1024*1024)throw Error('Tổng dung lượng ảnh tham chiếu vượt 64 MB.');
 const url=new URL(config.baseUrl+(refs.length&&!routerReferences?'/images/edits':'/images/generations'));
 if(!['http:','https:'].includes(url.protocol))throw Error('Địa chỉ 9router phải dùng HTTP hoặc HTTPS.');
 const timer=config.timeoutMs?AbortSignal.timeout(config.timeoutMs):null,combined=signal&&timer?AbortSignal.any([signal,timer]):signal||timer||undefined;
 onStatus({phase:'waiting'});
 return new Promise((done,fail)=>{
  const req=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{method:'POST',agent:false,signal:combined,headers:{Authorization:'Bearer '+config.key,'Content-Type':contentType,'Content-Length':body.length}},res=>{
   if(res.statusCode<200||res.statusCode>=300){res.resume();fail(Error('9router tạo ảnh trả HTTP '+res.statusCode+'. Kiểm tra model ảnh và tài khoản ở 9router.'));return}
   onStatus({phase:'receiving'});let bytes=0;const parts=[];
   res.on('data',part=>{bytes+=part.length;if(bytes>48*1024*1024){res.destroy();fail(Error('Phản hồi ảnh vượt giới hạn 48 MB.'))}else parts.push(part)});
   res.on('error',()=>fail(Error('Kết nối bị ngắt khi nhận ảnh. Ảnh cũ vẫn được giữ nguyên.')));
   res.on('end',()=>{try{const result=JSON.parse(Buffer.concat(parts).toString('utf8'));const value=result.data?.[0]?.b64_json;if(typeof value!=='string'||!value.length)throw Error();done(Buffer.from(value,'base64'))}catch{fail(Error('9router chưa trả ảnh PNG trong data[0].b64_json; chưa lưu ảnh.'))}});
  });
  req.on('error',()=>fail(signal?.aborted?signal.reason||Error('Đã dừng tạo ảnh.'):Error(timer?.aborted?'Đã hết thời gian chờ ảnh theo cấu hình server.':'Không kết nối được 9router để tạo ảnh. Ảnh cũ vẫn được giữ nguyên.')));req.end(body);
 });
}
function checkPng(buffer){
 if(!Buffer.isBuffer(buffer)||buffer.length>32*1024*1024)throw Error('Ảnh không hợp lệ hoặc vượt 32 MB.');
 try{
  const info=pngInfo(buffer),parts=chunks(buffer);
  if(!info.width||!info.height||info.width>8192||info.height>8192||parts.at(-1)?.type!=='IEND'||parts.at(-1).end!==buffer.length||!parts.some(part=>part.type==='IDAT'))throw Error();
  for(const part of parts)if(part.end>buffer.length||crc32(buffer.subarray(part.start+4,part.end-4))!==buffer.readUInt32BE(part.end-4))throw Error();
  return {width:info.width,height:info.height};
 }catch{throw Error('Dữ liệu ảnh PNG bị thiếu hoặc không hợp lệ; chưa thay thế ảnh cũ.')}
}
function alias(dir,item,file){
 let rel;
 if(item.kind==='frame'){
  if(!/^[A-Za-z0-9_-]+$/.test(item.segment))return;
  rel=join('frames',item.segment,'f'+item.cut+'.png');
 }else if(['character','scene','prop'].includes(item.kind)){
  const name=slug(item.label);if(name=== '.'||name==='..'||basename(name)!==name)return;
  rel=join('images',name+'-sheet.png');
 }
 if(!rel)return;
 const path=resolve(dir,rel);if(!path.startsWith(resolve(dir)+'/'))throw Error('Đường dẫn ảnh không hợp lệ.');
 mkdirSync(dirname(path),{recursive:true});copyFileSync(file,path);
}
function shareMedia(dir){
 for(const folder of ['images','frames']){
  mkdirSync(join(dir,folder),{recursive:true});const edition=activeEditionDir(dir);
  if(edition!==dir&&!existsSync(join(edition,folder)))symlinkSync(relative(edition,join(dir,folder)),join(edition,folder),'dir');
 }
}
export async function generateImage(dir,assetId,{config=imageConfig(),signal,request=requestImage,onProgress=()=>{}}={}){
 dir=resolve(dir);const previous=load(jobFile(dir));
 const job={id:previous?.assetId===assetId&&busy(previous)?previous.id:randomUUID(),assetId,status:'running',pid:process.pid,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),error:null,transport:null};
 const save=()=>{job.updatedAt=new Date().toISOString();writeJSON(jobFile(dir),job);onProgress({...job})};save();
 try{
  const items=imageCatalog(dir),item=items.find(row=>row.assetId===assetId);
  if(!item)throw Error('Không tìm thấy prompt ảnh cho mục này.');if(item.blocked)throw Error(item.blocked);
  const references=item.dependencies.map(id=>{const ref=items.find(row=>row.assetId===id);return {assetId:id,sha256:ref.image.sha256,path:safeFile(dir,ref.image.file)}});
  const buffer=await request({...item,references},{config,signal,onStatus:transport=>{job.transport=transport;save()}});
  signal?.throwIfAborted();const dimensions=checkPng(buffer);
  const fresh=imageCatalog(dir),current=fresh.find(row=>row.assetId===assetId);
  if(current?.promptHash!==item.promptHash||current?.blocked||references.some(ref=>fresh.find(row=>row.assetId===ref.assetId)?.image?.sha256!==ref.sha256))throw Error('Prompt hoặc ảnh tham chiếu đã thay đổi; chưa kích hoạt ảnh vừa tạo.');
  const file=join('images','references',hash(assetId).slice(0,16),Date.now()+'-'+randomUUID()+'.png');
  mkdirSync(dirname(join(dir,file)),{recursive:true});writeFileSync(join(dir,file),buffer);
  const registry=load(indexFile(dir))||{schemaVersion:1,assets:{}};
  const old=registry.assets[assetId];
  const record={file,promptHash:item.promptHash,prompt:item.prompt,sha256:createHash('sha256').update(buffer).digest('hex'),model:config.model,createdAt:new Date().toISOString(),...dimensions,references:references.map(({assetId,sha256})=>({assetId,sha256})),history:old?[...(old.history||[]),{file:old.file,sha256:old.sha256,model:old.model,createdAt:old.createdAt}]:[]};
  registry.assets[assetId]=record;writeJSON(indexFile(dir),registry);
  shareMedia(dir);alias(dir,item,join(dir,file));
  const original=imageCatalogSource(dir).find(row=>row.assetId===assetId);if(original)alias(dir,original,join(dir,file));
  const manifest=readJSON(join(dir,'project.json'));manifest.stages={...manifest.stages};
  const all=imageCatalog(dir),referencesComplete=all.filter(row=>['character','scene','prop'].includes(row.kind)).every(row=>row.image&&!row.stale);
  manifest.stages.images=referencesComplete?'done':'draft';
  if(all.some(row=>row.kind==='frame'))manifest.stages.frames=all.filter(row=>row.kind==='frame').every(row=>row.image&&!row.stale)?'done':'draft';
  writeJSON(join(dir,'project.json'),manifest);
  const edition=activeEditionDir(dir);if(edition!==dir){const localized=readJSON(join(edition,'project.json'));localized.stages={...localized.stages,images:manifest.stages.images,frames:manifest.stages.frames};writeJSON(join(edition,'project.json'),localized);}
  job.status='completed';job.file=file;job.transport=null;save();return record;
 }catch(error){job.status=signal?.aborted?'cancelled':'failed';job.error=signal?.aborted?null:safeError(error,config.key);job.transport=null;save();throw error}
}
function imageCatalogSource(dir){
 // Source names are used only for compatible filenames, never to change approved documents.
 const out=[];for(const [file,kind,key] of [['cast','character','characters'],['art','scene','scenes'],['art','prop','props']])for(const row of load(join(dir,file+'.json'))?.[key]||[])out.push({assetId:kind+':'+row.id,kind,label:row.name});return out;
}
export async function handleImages(req,res,{url,readBody,json,projectDir,isGenerating}){
 const match=url.pathname.match(/^\/api\/projects\/([^/]+)\/images(?:\/(cancel))?$/);if(!match)return false;
 try{
  const {dir,slug:projectSlug}=projectDir(decodeURIComponent(match[1]));if(!existsSync(join(dir,'project.json'))){json(res,404,{error:'Không tìm thấy dự án.'});return true}
  if(req.method==='GET'&&!match[2]){json(res,200,{...imageView(dir),busy:isGenerating(dir)});return true}
  if(req.method!=='POST'){json(res,405,{error:'Phương thức không được hỗ trợ.'});return true}
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==url.origin)){json(res,403,{error:'Yêu cầu phải đến từ Studio trên máy này.'});return true}
  const current=imageStatus(dir);
  if(match[2]==='cancel'){if(busy(current))try{process.kill(current.pid,'SIGTERM')}catch{}json(res,202,{job:current});return true}
  if(isGenerating(dir)){json(res,409,{error:'Dự án đang có một lượt AI khác. Vui lòng chờ hoàn tất.'});return true}
  const {assetId}=JSON.parse(await readBody(req)||'{}'),item=imageCatalog(dir).find(row=>row.assetId===assetId);
  if(!item){json(res,404,{error:'Không tìm thấy prompt ảnh cho mục này.'});return true}
  if(item.blocked){json(res,409,{error:item.blocked});return true}
  if(!imageConfig().key)throw Error('Chưa cấu hình khóa 9router ở server.');
  const lock=join(dir,'.ai','run.lock');mkdirSync(dirname(lock),{recursive:true});
  try{mkdirSync(lock)}catch(error){if(error.code==='EEXIST'){json(res,409,{error:'Dự án đang có một lượt AI khác.'});return true}throw error}
  const job={id:randomUUID(),assetId,status:'queued',pid:null,createdAt:new Date().toISOString(),error:null};
  try{
   writeJSON(join(lock,'image-owner.json'),{id:job.id});writeJSON(jobFile(dir),job);
   const child=spawn(process.execPath,[join(ROOT,'scripts/studio-images.mjs'),'--project',dir,'--asset',assetId],{cwd:ROOT,env:{...process.env,NODE_OPTIONS:''},detached:true,stdio:'ignore'});
   job.pid=child.pid;writeJSON(jobFile(dir),job);child.on('error',()=>{job.status='failed';job.error='Không khởi động được tiến trình tạo ảnh.';writeJSON(jobFile(dir),job);release(dir,job.id)});child.unref();
   json(res,202,{slug:projectSlug,job});return true;
  }catch(error){release(dir,job.id);throw error}
 }catch(error){json(res,400,{error:safeError(error,imageConfig().key)});return true}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--project')){
 const dir=resolve(process.argv[process.argv.indexOf('--project')+1]),assetId=process.argv[process.argv.indexOf('--asset')+1],controller=new AbortController();
 process.on('SIGTERM',()=>controller.abort());process.on('SIGINT',()=>controller.abort());
 for(let i=0;i<200;i++){if(load(jobFile(dir))?.pid===process.pid)break;await new Promise(done=>setTimeout(done,10))}
 const id=load(jobFile(dir))?.id;
 try{await generateImage(dir,assetId,{signal:controller.signal})}catch{process.exitCode=1}finally{release(dir,id)}
}

// HTTP integration for persisted AI writing jobs; API keys never reach the browser.
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ROOT, STAGES, aiConfig, models, normalizeOptions, jobFile, readJSON, writeJSON, safeError } from './ai-project.mjs';
import {englishStatus} from './english-project.mjs';
import {imageStatus} from './studio-images.mjs';
import {englishJobFile} from './project-edition.mjs';
import { BRAIN_VERSION } from './studio-brain.mjs';
const active = new Map();
const hash=text=>createHash('sha256').update(text).digest('hex');
function alive(pid,dir) { if(!Number.isInteger(pid))return false;try{process.kill(pid,0);if(process.platform==='linux' && dir){const args=readFileSync('/proc/'+pid+'/cmdline','utf8').split('\0');return args.includes(join(ROOT,'scripts/ai-project.mjs')) && args.includes(dir)}return true}catch{return false} }
export function status(dir) {
  if(!existsSync(jobFile(dir))) return null;
  const job=readJSON(jobFile(dir));
  if(['queued','running'].includes(job.status) && !alive(job.pid,dir)) {
    job.status='interrupted';job.error='Tiến trình đã dừng. Có thể chạy tiếp từ phần đã lưu.';writeJSON(jobFile(dir),job);rmSync(join(dir,'.ai','run.lock'),{recursive:true,force:true});
  }
  return job;
}
function launch(dir,job) {
  const lock=join(dir,'.ai','run.lock');
  try {mkdirSync(lock)} catch(e) {if(e.code==='EEXIST')throw new Error('Dự án đang có một lượt AI khác.');throw e}
  try {
    job.pid=null;job.status='queued';job.error=null;job.transport=null;delete job.finishedAt;
    for(const state of [job.reading,...Object.values(job.stages || {})])if(state && ['failed','cancelled'].includes(state.status)){state.status='pending';delete state.problems}
    writeJSON(jobFile(dir),job);
    const child=spawn(process.execPath,[join(ROOT,'scripts/ai-project.mjs'),'--project',dir],{cwd:ROOT,env:{...process.env,NODE_OPTIONS:''},detached:true,stdio:'ignore'});
    job.pid=child.pid;job.status='queued';job.error=null;writeJSON(jobFile(dir),job);active.set(dir,child);
    child.on('error',e=>{job.status='failed';job.error=safeError(e,aiConfig().key);writeJSON(jobFile(dir),job);rmSync(lock,{recursive:true,force:true});active.delete(dir)});
    child.on('exit',()=>active.delete(dir));child.unref();return job;
  } catch(e){rmSync(lock,{recursive:true,force:true});throw e}
}
export async function handleAI(req,res,{url,readBody,json,projectDir,slugify,splitScript}) {
  const path=url.pathname;
  if(!path.startsWith('/api/ai/') && !/^\/api\/projects\/[^/]+\/(?:ai(?:\/cancel)?|english(?:\/(?:cancel|source))?)$/.test(path))return false;
  if(req.method==='POST') {
    const origin=req.headers.origin;
    if(req.headers['sec-fetch-site']==='cross-site' || (origin && origin!==url.origin)) {json(res,403,{error:'Yêu cầu phải đến từ Studio trên máy này.'});return true}
  }
  try {
    if(path==='/api/ai/config' && req.method==='GET') {
      const config=aiConfig();let info;
      try{info=await models(config)}catch(e){info={configured:Boolean(config.key),model:config.model,models:[],error:safeError(e,config.key)}}
      json(res,200,info);return true;
    }
    if(path==='/api/ai/projects' && req.method==='POST') {
      const body=JSON.parse(await readBody(req)||'{}');const script=String(body.script || '').trim();
      if(script.length<30)throw new Error('Dán kịch bản hoặc cốt truyện ít nhất 30 ký tự.');
      if(script.length>160000)throw new Error('Tối đa 160.000 ký tự mỗi lần biên soạn; hãy chia nội dung dài thành các dự án.');
      if(!aiConfig().key)throw new Error('Chưa cấu hình khóa 9router ở server.');
      const split=splitScript(script);const options={...normalizeOptions(body,split),productionProfile:BRAIN_VERSION};
      const slug=slugify(body.slug || split.meta.title || 'du-an-ai-'+Date.now());const {dir}=projectDir(slug);
      if(existsSync(dir)){json(res,409,{error:'Dự án đã tồn tại. Mở dự án để chạy tiếp hoặc nhập mã mới.',slug});return true}
      mkdirSync(dir,{recursive:true});mkdirSync(join(dir,'.ai'),{recursive:true});
      writeFileSync(join(dir,'kichban.md'),script+'\n');writeFileSync(join(dir,'book.txt'),script+'\n');writeJSON(join(dir,'split.json'),split);
      writeJSON(join(dir,'project.json'),{slug,source:split.meta.title || slug,lang:options.lang,origin:'ai-9router',episodes:[],params:{episodes:options.episodes,minutesPerEpisode:options.seconds===null?null:options.seconds/60,genre:options.genre},stages:Object.fromEntries([...STAGES.map(s=>[s,'none']),['images','none'],['frames','none'],['video','none']])});
      const job={status:'queued',options,sourceHash:hash(script+'\n'),createdAt:new Date().toISOString(),stages:Object.fromEntries(STAGES.map(s=>[s,{status:'pending'}]))};
      const started=launch(dir,job);json(res,202,{slug,job:started});return true;
    }
    const englishMatch=path.match(/^\/api\/projects\/([^/]+)\/english(?:\/(cancel|source))?$/);
    if(englishMatch) {
      const {dir,slug}=projectDir(decodeURIComponent(englishMatch[1]));
      if(!existsSync(dir)){json(res,404,{error:'Không tìm thấy dự án.'});return true}
      const current=englishStatus(dir);
      if(req.method==='GET'){json(res,200,{job:current});return true}
      if(req.method==='POST'&&englishMatch[2]==='cancel'){
        if(current&&['queued','running'].includes(current.status))try{process.kill(current.pid,'SIGTERM')}catch{}
        json(res,202,{job:englishStatus(dir)});return true;
      }
      if(req.method==='POST'){
        if(isGenerating(dir)){json(res,409,{error:'Dự án đang có một lượt AI khác.'});return true}
        if(englishMatch[2]==='source'){
          const manifest=readJSON(join(dir,'project.json'));delete manifest.activeEdition;manifest.dialogueLang=manifest.lang;writeJSON(join(dir,'project.json'),manifest);
          json(res,200,{slug,source:true});return true;
        }
        if(!STAGES.every(s=>existsSync(join(dir,s+'.json')))){json(res,409,{error:'Cần hoàn tất cả sáu phần trước khi chuyển sang tiếng Anh.'});return true}
        if(!aiConfig().key)throw new Error('Chưa cấu hình khóa 9router ở server.');
        const lock=join(dir,'.ai','run.lock');mkdirSync(join(dir,'.ai'),{recursive:true});
        try{mkdirSync(lock)}catch(error){if(error.code==='EEXIST')throw Error('Dự án đang có một lượt AI khác.');throw error}
        try{
          const job={...current,status:'queued',pid:null,error:null,transport:null};writeJSON(englishJobFile(dir),job);
          const child=spawn(process.execPath,[join(ROOT,'scripts/english-project.mjs'),'--project',dir],{cwd:ROOT,env:{...process.env,NODE_OPTIONS:''},detached:true,stdio:'ignore'});
          job.pid=child.pid;writeJSON(englishJobFile(dir),job);
          child.on('error',error=>{job.status='failed';job.error=safeError(error,aiConfig().key);writeJSON(englishJobFile(dir),job);rmSync(lock,{recursive:true,force:true})});child.unref();
          json(res,202,{slug,job});return true;
        }catch(error){rmSync(lock,{recursive:true,force:true});throw error}
      }
    }
    const match=path.match(/^\/api\/projects\/([^/]+)\/ai(\/cancel)?$/);
    if(match) {
      const {dir,slug}=projectDir(decodeURIComponent(match[1]));if(!existsSync(dir)){json(res,404,{error:'Không tìm thấy dự án.'});return true}
      const job=status(dir);
      if(req.method==='GET'){json(res,200,{job});return true}
      if(req.method==='POST' && match[2]) {
        if(job && ['queued','running'].includes(job.status) && alive(job.pid,dir))process.kill(job.pid,'SIGTERM');
        json(res,202,{ok:true,job:status(dir)});return true;
      }
      if(req.method==='POST') {
        if(job && ['queued','running'].includes(job.status)){json(res,409,{error:'AI đang biên soạn dự án này.',job});return true}
        if(job?.status==='completed'){json(res,409,{error:'Dự án này đã được AI biên soạn đủ sáu phần.',job});return true}
        if(!aiConfig().key)throw new Error('Chưa cấu hình khóa 9router ở server.');
        const source=join(dir,'kichban.md');if(!existsSync(source))throw new Error('Dự án không có kịch bản gốc kichban.md.');
        const body=JSON.parse(await readBody(req)||'{}');const text=readFileSync(source,'utf8');
        const options=job?.options || {...normalizeOptions({...readJSON(join(dir,'project.json')).params,...body},splitScript(text)),productionProfile:BRAIN_VERSION};
        if(job?.sourceHash && job.sourceHash!==hash(text))throw new Error('Kịch bản gốc đã thay đổi; tạo dự án mới để tránh dùng nhầm phần đã biên soạn.');
        mkdirSync(join(dir,'.ai'),{recursive:true});if(!existsSync(join(dir,'book.txt')))writeFileSync(join(dir,'book.txt'),text);
        json(res,202,{slug,job:launch(dir,job || {options,sourceHash:hash(text),createdAt:new Date().toISOString(),stages:Object.fromEntries(STAGES.map(s=>[s,{status:'pending'}]))})});return true;
      }
    }
    json(res,405,{error:'Phương thức không hỗ trợ.'});return true;
  } catch(e){json(res,400,{error:safeError(e,aiConfig().key)});return true}
}
export function isGenerating(dir){return ['queued','running'].includes(status(dir)?.status)||['queued','running'].includes(englishStatus(dir)?.status)||['queued','running'].includes(imageStatus(dir)?.status)}

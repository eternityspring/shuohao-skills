// Real image transport and durable workers against a local fake provider; no external model calls.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {imageCatalog,generateImage,requestImage,handleImages,imageStatus} from './studio-images.mjs';
import {readJSON,writeJSON} from './ai-project.mjs';
import {solidPng} from '../skills/character-refs/scripts/png.mjs';
const dir=mkdtempSync(join(tmpdir(),'studio-images-test-'));
const fixture={
 cast:{lang:'vi',source:'Người giao thư',characters:[{id:'C01',name:'Mai',image:{prompt:'An adult Vietnamese courier with a short black bob and a green rain jacket, full body, neutral background.',negativePrompt:'extra fingers'}}]},
 art:{lang:'vi',scenes:[{id:'S01',name:'Bưu điện',image:{prompt:'An empty timber post office with brass letter slots, no people.'},lighting:[{state:'Ban đêm',prompt:'The same empty timber post office, night lighting, no people.'}]}],props:[{id:'P01',name:'Chìa khóa',image:{prompt:'One brass key on a pure white background, no hands.'},states:[{state:'Ướt',prompt:'The same brass key with rain droplets, pure white background, no hands.'}]}],production:{styleDNA:'A detailed cinematic illustration with natural materials.'}},
 script:{lang:'vi',episodes:[{ep:1,scenes:[{sceneId:'S01',characters:['C01'],flow:[{speaker:'C01',line:'Thư của bà đây.'}]}]}]},
 storyboard:{lang:'vi',aspectRatio:'16:9',episodes:[{ep:1,segments:[{id:'E01-01',sceneIndex:1,cuts:[{characters:['C01'],props:['P01'],production:{keyframePrompt:'A courier in a green rain jacket holds a brass key inside a timber post office, medium shot.'}}]}]}]},
};
let number=0,mode='ok',requests=[];
const provider=createServer(async(req,res)=>{
 const parts=[];for await(const part of req)parts.push(part);const body=Buffer.concat(parts);
 requests.push({path:req.url,auth:req.headers.authorization,type:req.headers['content-type'],body});
 if(mode==='error'){res.writeHead(401);res.end(JSON.stringify({error:{message:'DO_NOT_EXPOSE_PROVIDER_SECRET'}}));return}
 if(mode==='slow')return;
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{b64_json:solidPng(48,48,[++number%255,120,170]).toString('base64')}]}));
});
await new Promise(done=>provider.listen(0,'127.0.0.1',done));
const config={baseUrl:'http://127.0.0.1:'+provider.address().port+'/v1',model:'cx/gpt-image-2',key:'fake-local-key',quality:'high',timeoutMs:10000};
let server;
try{
 writeJSON(join(dir,'project.json'),{lang:'vi',slug:'__image-controls-review',source:'Người giao thư',stages:{cast:'done',art:'done',storyboard:'done'},episodes:[1]});
 for(const [key,value] of Object.entries(fixture))writeJSON(join(dir,key+'.json'),value);
 for(const section of ['cast','art','storyboard','staging'])writeFileSync(join(dir,section+'-report.html'),'<html><head><title>Reference review</title></head><body><h1>Reference review</h1></body></html>');
 const before=Object.fromEntries(Object.keys(fixture).map(key=>[key,readFileSync(join(dir,key+'.json'),'utf8')]));
 const catalog=imageCatalog(dir);assert.equal(catalog.length,6);assert.equal(catalog.find(x=>x.kind==='frame').missing.length,3);
 await assert.rejects(generateImage(dir,'frame:E01-01:1',{config}),/Tạo ảnh tham chiếu trước/);assert.equal(requests.length,0);
 for(const asset of ['character:C01','scene:S01','prop:P01'])await generateImage(dir,asset,{config});
 assert.equal(requests[0].path,'/v1/images/generations');assert.equal(requests[0].auth,'Bearer fake-local-key');
 assert.equal(JSON.parse(requests[0].body).model,config.model);assert.equal(JSON.parse(requests[0].body).size,'1024x1536');
 assert.equal(imageCatalog(dir).find(x=>x.kind==='frame').blocked,null);
 const frame=await generateImage(dir,'frame:E01-01:1',{config});assert.equal(frame.references.length,3);
 assert.equal(requests.at(-1).path,'/v1/images/generations');assert.equal(requests.at(-1).type,'application/json');
 const images=JSON.parse(requests.at(-1).body).images;assert.equal(images.length,3);assert.ok(images.every(image=>image.startsWith('data:image/png;base64,')));
 await requestImage({...catalog[0],references:[{path:join(dir,frame.file)}]},{config:{...config,referenceMode:'multipart'}});
 assert.equal(requests.at(-1).path,'/v1/images/edits');assert.match(requests.at(-1).type,/multipart\/form-data/);
 assert.ok(requests.at(-1).body.includes(Buffer.from('name="image[]"')));
 assert.ok(existsSync(join(dir,'frames/E01-01/f1.png')));assert.ok(existsSync(join(dir,'images/Mai-sheet.png')));
 await generateImage(dir,'lighting:S01:1',{config});await generateImage(dir,'state:P01:1',{config});
 const first=imageCatalog(dir).find(x=>x.kind==='character').image;
 await generateImage(dir,'character:C01',{config});
 const second=imageCatalog(dir).find(x=>x.kind==='character').image;
 assert.notEqual(second.file,first.file);assert.ok(existsSync(join(dir,first.file)));assert.equal(second.history[0].file,first.file);
 assert.equal(imageCatalog(dir).find(x=>x.kind==='frame').stale,true,'regenerating a character invalidates its old keyframe');
 await generateImage(dir,'frame:E01-01:1',{config});assert.equal(imageCatalog(dir).find(x=>x.kind==='frame').stale,false);
 // Active English editions share saved media and retain the canonical source documents.
 const edition=join(dir,'editions/en-0000000000000001');
 for(const [key,value] of Object.entries(fixture))writeJSON(join(edition,key+'.json'),value);
 const editionArt=readJSON(join(edition,'art.json'));editionArt.scenes[0].name='Post office';writeJSON(join(edition,'art.json'),editionArt);
 writeJSON(join(edition,'project.json'),{lang:'en',stages:{}});
 const originalManifest=readJSON(join(dir,'project.json'));writeJSON(join(dir,'project.json'),{...originalManifest,activeEdition:'editions/en-0000000000000001'});
 await generateImage(dir,'scene:S01',{config});
 assert.ok(existsSync(join(edition,'images/Post-office-sheet.png')));assert.ok(existsSync(join(dir,'images/Bưu-điện-sheet.png')));
 assert.equal(readJSON(join(edition,'project.json')).stages.images,readJSON(join(dir,'project.json')).stages.images);
 writeJSON(join(dir,'project.json'),originalManifest);rmSync(join(dir,'editions'),{recursive:true,force:true});
 const changed=structuredClone(fixture.cast);changed.characters[0].image.prompt+=' A blue scarf.';writeJSON(join(dir,'cast.json'),changed);
 assert.equal(imageCatalog(dir).find(x=>x.kind==='character').stale,true);writeJSON(join(dir,'cast.json'),fixture.cast);
 const count=requests.length;
 await assert.rejects(generateImage(dir,'../../escape',{config}),/Không tìm thấy/);assert.equal(requests.length,count);
 const saved=imageCatalog(dir).find(x=>x.kind==='character').image.file;
 await assert.rejects(generateImage(dir,'character:C01',{config,request:async()=>Buffer.from('<html>not an image</html>')}),/PNG/);
 assert.equal(imageCatalog(dir).find(x=>x.kind==='character').image.file,saved,'invalid image does not overwrite previous image');
 const abort=new AbortController();
 await assert.rejects(generateImage(dir,'character:C01',{config,signal:abort.signal,request:async()=>{abort.abort();return solidPng(48,48)}}));
 assert.equal(readJSON(join(dir,'.ai/images-job.json')).status,'cancelled');
 mode='error';await assert.rejects(requestImage(catalog[0],{config}),e=>e.message.includes('401')&&!e.message.includes('DO_NOT_EXPOSE'));mode='ok';
 for(const [key,bytes] of Object.entries(before))assert.equal(readFileSync(join(dir,key+'.json'),'utf8'),bytes,'approved documents stay unchanged');
 // Exercise a real detached worker and lock through the HTTP handler.
 process.env.SHUOHAO_AI_BASE_URL=config.baseUrl;process.env.SHUOHAO_AI_API_KEY=config.key;process.env.SHUOHAO_IMAGE_MODEL=config.model;
 const json=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body))};
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:'+server.address().port);
  try{if(!await handleImages(req,res,{url,json,readBody:async req=>{let raw='';for await(const chunk of req)raw+=chunk;return raw},projectDir:()=>({dir,slug:'test'}),isGenerating:()=>['queued','running'].includes(imageStatus(dir)?.status)}))json(res,404,{})}catch{json(res,500,{error:'test handler failure'})}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const url='http://127.0.0.1:'+server.address().port+'/api/projects/test/images';
 const cross=await fetch(url,{method:'POST',headers:{Origin:'https://bad.example'},body:JSON.stringify({assetId:'character:C01'})});assert.equal(cross.status,403);
 const started=await fetch(url,{method:'POST',body:JSON.stringify({assetId:'character:C01'})});assert.equal(started.status,202);
 const duplicate=await fetch(url,{method:'POST',body:JSON.stringify({assetId:'character:C01'})});assert.equal(duplicate.status,409);
 let final;
 for(let i=0;i<200;i++){
  const response=await fetch(url);final=await response.json();assert.ok(!JSON.stringify(final).includes(config.key));
  if(!['queued','running'].includes(final.job.status))break;await new Promise(done=>setTimeout(done,50));
 }
 assert.equal(final.job.status,'completed',final.job.error);assert.equal(existsSync(join(dir,'.ai/run.lock')),false);
 mode='slow';
 assert.equal((await fetch(url,{method:'POST',body:JSON.stringify({assetId:'character:C01'})})).status,202);
 for(let i=0;i<200;i++){const state=await fetch(url).then(r=>r.json());if(state.job.status==='running'&&state.job.transport?.phase==='waiting')break;await new Promise(done=>setTimeout(done,25));}
 assert.equal((await fetch(url+'/cancel',{method:'POST',body:'{}'})).status,202);
 let cancelled;
 for(let i=0;i<200;i++){cancelled=await fetch(url).then(r=>r.json());if(!['queued','running'].includes(cancelled.job.status))break;await new Promise(done=>setTimeout(done,25));}
 assert.equal(cancelled.job.status,'cancelled');assert.equal(cancelled.job.error,null);assert.equal(existsSync(join(dir,'.ai/run.lock')),false);mode='ok';

 for(const key of ['SHUOHAO_AI_BASE_URL','SHUOHAO_AI_API_KEY','SHUOHAO_IMAGE_MODEL'])delete process.env[key];
 if(process.env.SHUOHAO_IMAGE_FIXTURE_DIR){assert.equal(existsSync(process.env.SHUOHAO_IMAGE_FIXTURE_DIR),false);cpSync(dir,process.env.SHUOHAO_IMAGE_FIXTURE_DIR,{recursive:true});console.log('Browser fixture: '+process.env.SHUOHAO_IMAGE_FIXTURE_DIR)}
 console.log('PASS: character/scene/prop/variant/keyframe generation, 9router JSON and multipart reference inputs, version history, stale detection, source preservation, invalid-image handling, cancellation, redacted provider errors, origin protection, duplicate suppression and detached worker lock.');
}finally{
 for(const key of ['SHUOHAO_AI_BASE_URL','SHUOHAO_AI_API_KEY','SHUOHAO_IMAGE_MODEL'])delete process.env[key];
 if(server){server.closeAllConnections();await new Promise(done=>server.close(done))}
 provider.closeAllConnections();await new Promise(done=>provider.close(done));rmSync(dir,{recursive:true,force:true});
}

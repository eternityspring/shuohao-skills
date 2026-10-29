// Real browser downloads against an existing local project; read-only, no AI requests.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require(process.env.SHUOHAO_PLAYWRIGHT_MODULE || 'playwright');
const base=(process.env.SHUOHAO_PREVIEW_URL || 'http://127.0.0.1:8765').replace(/\/$/,'');
const slug=process.env.SHUOHAO_PROJECT_SLUG || 'THE-QUIRKY-KINGDOM';
const output=fs.mkdtempSync(path.join(os.tmpdir(),'studio-json-export-'));
const parts=['outline','cast','art','script','staging','storyboard'];
const extra=['reading','production','split'];
const {filename}=require('../web/json-export.js');
(async()=>{
 const response=await fetch(base+'/api/projects/'+encodeURIComponent(slug));assert.ok(response.ok);
 const detail=await response.json(),raw={};
 for(const key of [...parts,...extra])if(detail.files[key])raw[key]=await fetch(base+'/api/projects/'+encodeURIComponent(slug)+'/file?name='+key+'.json').then(r=>r.json());
 assert.ok(parts.every(key=>raw[key]),'Use a saved project with all six parts');
 const before=JSON.stringify(raw);
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHUOHAO_CHROMIUM || '/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({acceptDownloads:true});const errors=[],posts=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')posts.push(r.method()+' '+r.url())});
  await page.route('**/api/ai/config',route=>route.fulfill({json:{configured:false,models:[]}}));
  async function open(route,lang='vi'){
   await page.goto(base+'/?lang='+lang+'#/'+route);
   await page.waitForFunction(()=>window.shuohaoLanguage && !document.documentElement.classList.contains('sh-locale-loading'));
   await page.locator('[data-export-json="all"]').waitFor();
   if(route.startsWith('report/'))await page.waitForFunction(file=>document.querySelector('#frame')?.getAttribute('src')?.endsWith('/'+file),route.split('/').at(-1));
  }
  async function download(button,section,lang){
   const event=page.waitForEvent('download');await button.click();const item=await event;
   assert.equal(item.suggestedFilename(),filename(section,slug,lang));
   const data=JSON.parse(fs.readFileSync(await item.path(),'utf8'));assert.equal(data.lang,lang);
   assert.ok(Buffer.byteLength(item.suggestedFilename())<255);
   results.push({section,lang,filename:item.suggestedFilename()});return data;
  }
  for(const lang of ['vi','en','zh']){
   for(const section of parts){
    await open('report/'+slug+'/'+section+'-report.html',lang);
    await page.waitForFunction(()=>{const w=document.querySelector('#frame')?.contentWindow;return w?.shuohaoLanguage && !w.document.documentElement.classList.contains('sh-locale-loading')});
    const data=await download(page.frameLocator('#frame').locator('.expo'),section,lang);
    assert.equal(data.episodes?.length ?? data.characters?.length ?? data.scenes?.length,raw[section].episodes?.length ?? raw[section].characters?.length ?? raw[section].scenes?.length);
   }
   const all=await download(page.locator('[data-export-json="all"]'),'all',lang);
   assert.equal(all.kind,'shuohao-project');assert.equal(all.project.slug,slug);assert.ok(all.sourceText?.length);
   for(const section of [...parts,...extra]){
    if(!raw[section]){assert.equal(all[section],null);continue}
    assert.equal(all[section].lang,lang);
    const expected=await page.evaluate(({doc})=>window.shuohaoLanguage.exportJson(doc),{doc:raw[section]});
    assert.deepEqual(all[section],expected,section+' is the full localized document');
   }
   await open('report/'+slug+'/production-report.html',lang);
   await page.waitForFunction(()=>document.querySelector('#frame')?.contentDocument?.querySelector('#download'));
   const dossier=await download(page.frameLocator('#frame').locator('#download'),'production',lang);
   assert.ok(dossier.storyboard.length);
   console.log('PASS: six report downloads and complete bundle in '+lang);
  }
  for(const section of parts){
   await open('project/'+slug+'/'+section);
   const data=await download(page.locator('[data-export-json="'+section+'"]'),section,'vi');
   assert.deepEqual(data,await page.evaluate(doc=>window.shuohaoLanguage.exportJson(doc),raw[section]));
  }
  await open('project/'+slug+'/files');
  await page.locator('#page [data-export-json="cast"]').waitFor();
  await download(page.locator('#page [data-export-json="cast"]'),'cast','vi');
  // Existing editor cache must not hide newer saved data on a later aggregate download.
  const outlineURL='**/api/projects/'+slug+'/file?name=outline.json';
  await page.route(outlineURL,route=>route.fulfill({json:{...raw.outline,summary:'Bản đã lưu mới nhất'}}));
  const fresh=await download(page.locator('[data-export-json="all"]'),'all','vi');
  assert.equal(fresh.outline.summary,'Bản đã lưu mới nhất');await page.unroute(outlineURL);
  // A missing optional part is explicit null; an actual read failure must not produce a partial file.
  const summaryURL='**/api/projects/'+slug;
  await page.route(summaryURL,route=>route.fulfill({json:{...detail,files:{...detail.files,art:0}}}));
  const partial=await download(page.locator('[data-export-json="all"]'),'all','vi');assert.equal(partial.art,null);
  await page.unroute(summaryURL);
  let failedDownloads=0;const countFailure=()=>failedDownloads++;page.on('download',countFailure);
  await page.route('**/api/projects/'+slug+'/file?name=storyboard.json',route=>route.fulfill({status:500,json:{error:'Lỗi đọc dữ liệu thử nghiệm'}}));
  await page.locator('[data-export-json="all"]').click();
  await page.locator('#toast').filter({hasText:'Lỗi đọc dữ liệu thử nghiệm'}).waitFor();
  assert.equal(failedDownloads,0);assert.equal(await page.locator('[data-export-json="all"]').isEnabled(),true);
  page.off('download',countFailure);await page.unroute('**/api/projects/'+slug+'/file?name=storyboard.json');
  // Header download uses the report's live staging state, including unsaved edits.
  await open('report/'+slug+'/staging-report.html');
  await page.waitForFunction(()=>document.querySelector('#frame')?.contentDocument?.querySelector('.step'));
  const report=page.frameLocator('#frame');
  const frame=page.frames().find(f=>f.parentFrame() && new URL(f.url()).pathname.endsWith('/staging-report.html'));
  await frame.waitForFunction(()=>typeof doc !== 'undefined' && window.shuohaoLanguage && !document.documentElement.classList.contains('sh-locale-loading'));
  const old=await frame.evaluate(()=>doc.scenes[0].extras);
  await report.locator('.scene').first().locator('.step').filter({hasText:'+'}).click();
  const staged=await download(page.locator('[data-export-json="staging"]'),'staging','vi');assert.equal(staged.scenes[0].extras,old+1);
  console.log('PASS: fresh saved data, partial projects, read failures, and unsaved staging export.');
  await page.screenshot({path:path.join(output,'exports-desktop.png'),fullPage:false});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'export toolbar fits mobile');
  await page.screenshot({path:path.join(output,'exports-mobile.png'),fullPage:false});
  for(const section of Object.keys(raw)){
   const after=await fetch(base+'/api/projects/'+encodeURIComponent(slug)+'/file?name='+section+'.json').then(r=>r.json());assert.deepEqual(after,raw[section],'downloads never write project files');
  }
  assert.equal(JSON.stringify(raw),before);assert.deepEqual(posts,[],'export never starts a generation job or writes data');assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({downloads:results.length,allParts:true,locales:['vi','en','zh'],distinctFilenames:true,freshData:true,partialProject:true,readErrors:true,stagingEdits:true,mobile:true,posts,errors,artifacts:output}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

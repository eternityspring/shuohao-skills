// Run after the integration self-test creates SHUOHAO_ENGLISH_FIXTURE_DIR. No new model calls.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {chromium}=require(process.env.SHUOHAO_PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.SHUOHAO_PREVIEW_URL || 'http://127.0.0.1:8765';
const slug=process.env.SHUOHAO_ENGLISH_SLUG || '__english-language-review';
assert.ok(slug.startsWith('__'),'Use a disposable integration fixture');
const root=path.resolve(__dirname,'..','projects',slug),output=fs.mkdtempSync(path.join(os.tmpdir(),'studio-english-browser-'));
(async()=>{
 const original=JSON.parse(fs.readFileSync(path.join(root,'script.json'),'utf8'));
 const originalLine=original.episodes.flatMap(e=>e.scenes.flatMap(s=>s.flow)).find(b=>b.line).line;
 const originalBytes=fs.readFileSync(path.join(root,'script.json'),'utf8');
 const sourceResponse=await fetch(base+'/api/projects/'+slug+'/english/source',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(sourceResponse.status,200);
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHUOHAO_CHROMIUM || '/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});let passed=false;
 try{
  const page=await browser.newPage({acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/ai/config',route=>route.fulfill({json:{configured:true,models:['offline-test'],model:'offline-test'}}));
  let submitted;
  await page.route('**/api/ai/projects',route=>{submitted=route.request().postDataJSON();return route.fulfill({status:202,json:{slug,job:{status:'completed'}}})});
  await page.goto(base+'/?lang=vi#/new');await page.locator('#ai-dialogue').selectOption('en');
  await page.locator('#script').fill('Mai đặt chiếc chìa khóa lên bậu cửa. An hỏi: Chìa khóa của bà à?');
  await page.locator('#ai-generate').click();await page.waitForURL('**#/project/'+slug+'/overview');
  assert.equal(submitted.dialogueLanguage,'en');assert.equal(submitted.lang,'vi');
  await page.locator('#english-convert').click();
  await page.locator('#english-source').waitFor({timeout:30000});
  assert.equal(await page.locator('#sh-language').inputValue(),'en');
  const detail=await fetch(base+'/api/projects/'+slug).then(r=>r.json());assert.equal(detail.edition,'en');assert.equal(detail.english.status,'completed');
  const script=await fetch(base+'/api/projects/'+slug+'/file?name=script.json').then(r=>r.json());
  const line=script.episodes.flatMap(e=>e.scenes.flatMap(s=>s.flow)).find(b=>b.line);
  assert.equal(line.subtitle,originalLine);assert.equal(line.originalLine,originalLine);assert.equal(line.dialogueLang,'en');
  await page.goto(base+'/?lang=en#/project/'+slug+'/script');
  await page.locator('#page .original-subtitle').first().waitFor();
  assert.equal(await page.locator('#page .original-subtitle').first().innerText(),originalLine);
  await page.goto(base+'/?lang=en#/report/'+slug+'/script-report.html');
  await page.waitForFunction(()=>{const f=document.querySelector('#frame');return f?.contentWindow?.shuohaoLanguage && !f.contentDocument.documentElement.classList.contains('sh-locale-loading')});
  const report=page.frameLocator('#frame');
  assert.equal(await report.locator('.said .original-subtitle').first().innerText(),originalLine);
  const before=await report.locator('.said').first().innerText();
  for(const lang of ['vi','zh','en']){
   await page.locator('#sh-language').selectOption(lang);
   assert.equal(await report.locator('.said').first().innerText(),before,'locale never rewrites speech or subtitles');
   const event=page.waitForEvent('download');await page.locator('[data-export-json="all"]').click();
   const file=await event,data=JSON.parse(fs.readFileSync(await file.path(),'utf8'));
   const beat=data.script.episodes.flatMap(e=>e.scenes.flatMap(s=>s.flow)).find(b=>b.line);
   assert.equal(beat.line,line.line);assert.equal(beat.subtitle,originalLine);assert.equal(data.script.dialogueLang,'en');
   assert.equal(data.subtitles.cues[0].subtitle,originalLine);
   assert.equal(data.cast.characters[0].image.prompt,script.source ? (await fetch(base+'/api/projects/'+slug+'/file?name=cast.json').then(r=>r.json())).characters[0].image.prompt : '');
  }
  const pending=page.waitForEvent('download');await page.locator('a[download$="-phu-de-song-ngu.srt"]').click();
  const srt=await pending;const text=fs.readFileSync(await srt.path(),'utf8');assert.ok(text.includes(line.line+'\n'+originalLine));assert.match(text,/\d\d:\d\d:\d\d,\d\d\d -->/);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'fits '+width);
   await page.screenshot({path:path.join(output,'english-'+width+'.png'),fullPage:false});
  }
  await page.locator('#english-source').click();
  await page.waitForFunction(()=>!document.querySelector('#english-source'));
  assert.equal((await fetch(base+'/api/projects/'+slug).then(r=>r.json())).edition,'source');
  assert.equal(fs.readFileSync(path.join(root,'script.json'),'utf8'),originalBytes);
  assert.deepEqual(errors,[]);passed=true;
  console.log(JSON.stringify({englishChoiceBeforeRun:true,postRunConversion:true,existingEditionReused:true,englishDialogue:true,originalSubtitles:true,allLocaleExports:true,srt:true,desktop:true,mobile:true,sourceRestored:true,errors,artifacts:output}));
 }finally{await browser.close();if(passed)fs.rmSync(root,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});

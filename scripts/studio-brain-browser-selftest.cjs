// Real Studio routing + director report at desktop/mobile sizes. No model requests.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const {chromium}=require(process.env.SHUOHAO_PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const {productionFixture}=await import(pathToFileURL(path.join(root,'scripts/fixtures/production-story.mjs')));
 const {buildDossier}=await import(pathToFileURL(path.join(root,'scripts/studio-brain.mjs')));
 const ctx=productionFixture();const slug='__brain-browser-'+process.pid;const dir=path.join(root,'projects',slug);
 const output=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'studio-brain-browser-'));
 fs.mkdirSync(dir,{recursive:true});
 for(const key of ['reading','outline','cast','art','script','staging','storyboard'])fs.writeFileSync(path.join(dir,key+'.json'),JSON.stringify(ctx[key]));
 fs.writeFileSync(path.join(dir,'project.json'),JSON.stringify({slug,source:ctx.reading.source,episodes:[1],stages:Object.fromEntries(['outline','cast','art','script','staging','storyboard'].map(s=>[s,'done']))}));
 fs.writeFileSync(path.join(dir,'kichban.md'),ctx.source);buildDossier(dir);
 const port=Number(process.env.SHUOHAO_TEST_PORT||4461),base='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['preview/pipeline/studio.mjs','--port',String(port),'--no-open'],{cwd:root,stdio:'pipe'});
 let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
 let browser;
 try {
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/projects')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,50))}assert.ok(ready,serverLog);
  browser=await chromium.launch({headless:true,executablePath:process.env.SHUOHAO_CHROMIUM || '/usr/bin/google-chrome',args:['--no-sandbox']});
  const page=await browser.newPage({acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/ai/config',route=>route.fulfill({json:{configured:false,models:[],model:'test'}}));
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000});
   await page.goto(base+'/?lang=vi#/new');
   await page.getByText('Bộ não đạo diễn đọc hiểu kịch bản trước, khóa DNA nhân vật, diễn xuất, ánh sáng và trạng thái nối shot cho cả sáu phần.').waitFor();
   await page.goto(base+'/?lang=vi#/project/'+slug);
   await page.locator('a[href="#/report/'+slug+'/production-report.html"]').first().click();
   const frame=page.frameLocator('#frame');
   await frame.locator('#storyboard .shot').waitFor();
   assert.equal(await frame.locator('#storyboard .shot details').count(),8);
   assert.match(await frame.locator('h1').innerText(),/Hồ sơ đạo diễn/);
   assert.match(await frame.locator('#storyboard .shot h3').innerText(),/00:00.0–00:03.0/);
   await frame.locator('#storyboard .shot details').nth(7).locator('summary').click();
   assert.ok(await frame.getByText(ctx.cast.characters[0].production.visualDNA,{exact:false}).count()>0);
   const download=page.waitForEvent('download');await frame.locator('#download').click();
   const file=await download;const target=path.join(output,'production-'+width+'.json');await file.saveAs(target);
   assert.equal(JSON.parse(fs.readFileSync(target)).reading.facts[0].quote,ctx.reading.facts[0].quote);
   const overflow=await frame.locator('body').evaluate(el=>el.scrollWidth>innerWidth+2);assert.equal(overflow,false,'report fits viewport');
   await page.screenshot({path:path.join(output,'studio-'+width+'.png'),fullPage:true});
   await page.goto(base+'/?lang=vi#/project/'+slug+'/files');
   await page.getByText('reading.json',{exact:true}).waitFor();await page.getByText('production.json',{exact:true}).waitFor();
   // A legacy project must not expose a missing new report in its stage view.
  }
  for(const [lang,label] of [['en','Director dossier'],['zh','导演制作档案']]) {
   await page.goto(base+'/?lang='+lang+'#/project/'+slug);
   await page.locator('a[href="#/report/'+slug+'/production-report.html"]').first().waitFor();
   await page.waitForFunction(([s,l])=>document.querySelector('a[href="#/report/'+s+'/production-report.html"]')?.textContent.includes(l),[slug,label]);
   await page.locator('a[href="#/report/'+slug+'/production-report.html"]').first().click();
   await page.frameLocator('#frame').locator('h1').filter({hasText:label}).waitFor();
  }
  assert.deepEqual(errors,[]);console.log('PASS: Studio director dossier links, eight shot fields, source-preserving JSON export, files view, vi/en/zh labels, desktop/mobile without overflow. Artifacts: '+output);
 }finally{if(browser)await browser.close();server.kill();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});

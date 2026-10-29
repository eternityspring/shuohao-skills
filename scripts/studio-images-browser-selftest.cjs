// UI checks use a disposable fixture and intercept writes; no image model calls.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {chromium}=require(process.env.SHUOHAO_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SHUOHAO_PREVIEW_URL||'http://127.0.0.1:8765';
const slug='__image-controls-review',root=path.resolve(__dirname,'..','projects',slug);
const output=fs.mkdtempSync(path.join(os.tmpdir(),'studio-images-browser-'));
(async()=>{
 const saved=JSON.parse(fs.readFileSync(path.join(root,'reference-images.json'),'utf8'));
 const actual=await fetch(base+'/api/projects/'+slug+'/images').then(r=>r.json());
 assert.ok(actual.items.length===6);assert.ok(actual.items.find(x=>x.kind==='character').image);
 const originalScript=fs.readFileSync(path.join(root,'script.json'),'utf8');
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHUOHAO_CHROMIUM||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});let passed=false;
 try{
  const page=await browser.newPage({acceptDownloads:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let submissions=0,pending=false,polls=0,lastAsset;
  await page.route('**/api/projects/'+slug+'/images',async route=>{
   if(route.request().method()==='POST'){
    submissions++;lastAsset=route.request().postDataJSON().assetId;pending=true;polls=0;
    return route.fulfill({status:202,json:{job:{status:'queued',assetId:lastAsset}}});
   }
   if(pending){polls++;if(polls>1)pending=false;return route.fulfill({json:{...actual,busy:pending,job:{status:pending?'running':'completed',assetId:lastAsset,transport:pending?{phase:'waiting'}:null}}})}
   return route.continue();
  });
  await page.goto(base+'/?lang=vi#/project/'+slug+'/cast');
  const slot=page.locator('[data-image-slot="character:C01"]');await slot.locator('[data-image-generate]').waitFor();
  assert.equal(await slot.locator('img').count(),1);assert.equal(await slot.locator('[data-image-generate]').isEnabled(),true);
  await slot.locator('[data-image-generate]').click();
  await slot.locator('[data-image-cancel]').waitFor();assert.equal(await slot.locator('[data-image-generate]').isDisabled(),true);
  await slot.locator('[data-image-cancel]').waitFor({state:'detached',timeout:15000});assert.equal(submissions,1);assert.equal(lastAsset,'character:C01');
  const prompt=await slot.locator('pre').innerText();await page.locator('#sh-language').selectOption('en');
  assert.equal(await slot.locator('pre').innerText(),prompt);assert.match(await slot.locator('[data-image-generate]').innerText(),/Regenerate/);
  const download=page.waitForEvent('download');await slot.locator('a[download]').last().click();const image=await download;assert.ok(fs.readFileSync(await image.path()).subarray(1,4).equals(Buffer.from('PNG')));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'fits '+width);
   await page.screenshot({path:path.join(output,'cast-'+width+'.png'),fullPage:true});
  }
  await page.goto(base+'/?lang=vi#/project/'+slug+'/art');await page.locator('[data-image-slot="scene:S01"] [data-image-generate]').waitFor();
  for(const id of ['scene:S01','prop:P01','lighting:S01:1','state:P01:1'])assert.equal(await page.locator('[data-image-slot="'+id+'"] [data-image-generate]').count(),1);
  await page.goto(base+'/?lang=vi#/project/'+slug+'/storyboard');await page.locator('[data-image-slot="frame:E01-01:1"] [data-image-generate]').waitFor();
  await page.goto(base+'/?lang=vi#/report/'+slug+'/cast-report.html');await page.locator('#image-gallery [data-image-generate]').waitFor();assert.equal(await page.locator('#image-gallery [data-image-generate]').count(),1);
  const exported=page.waitForEvent('download');await page.locator('[data-export-json="all"]').click();const json=await exported,bundle=JSON.parse(fs.readFileSync(await json.path(),'utf8'));
  assert.equal(bundle.references.assets['character:C01'].file,saved.assets['character:C01'].file);
  assert.equal(bundle.references.assets['character:C01'].prompt,saved.assets['character:C01'].prompt);
  assert.equal(fs.readFileSync(path.join(root,'script.json'),'utf8'),originalScript);assert.deepEqual(errors,[]);passed=true;
  console.log(JSON.stringify({characterControls:true,artAndVariants:true,keyframeControls:true,reportGallery:true,oneClickPolling:true,pngDownload:true,lockedEnglishPrompt:true,bundleReferences:true,desktop:true,mobile:true,errors,artifacts:output}));
 }finally{await browser.close();if(passed)fs.rmSync(root,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});

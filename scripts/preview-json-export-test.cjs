const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {chromium} = require(process.env.SHUOHAO_PLAYWRIGHT_MODULE || 'playwright');
const base=(process.env.SHUOHAO_PREVIEW_URL || 'http://127.0.0.1:8765').replace(/\/$/,'');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'shuohao-json-export-'));
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SHUOHAO_CHROMIUM?{executablePath:process.env.SHUOHAO_CHROMIUM}:{}),args:['--no-sandbox']});
 try {
  const page=await browser.newPage({acceptDownloads:true});
  const errors=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));
  async function download(button,filename){
   const pending=page.waitForEvent('download');
   await button.click();
   const item=await pending;
   const file=path.join(output,filename);
   await item.saveAs(file);
   return {data:JSON.parse(fs.readFileSync(file,'utf8')),filename:item.suggestedFilename()};
  }
  await page.goto(base+'/report.html?lang=vi',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.shuohaoTranslations?.length>0);
  const panes=await page.locator('.rp-pane').evaluateAll(nodes=>nodes.map(n=>n.id));
  assert.equal(panes.length,5);
  for(const [index,pane] of panes.entries()){
   await page.locator('.rp-rail .rp-nv').nth(index).click();
   const raw=await page.locator('#'+pane+' script[type="application/json"]').evaluate(n=>JSON.parse(n.textContent));
   const exports={};
   for(const lang of ['vi','en','zh']){
    await page.locator('#sh-language').selectOption(lang);
    const item=await download(page.locator('#'+pane+' .expo'),pane+'-'+lang+'.json');
    const data=item.data;
    assert.equal(data.lang,lang);
    const stage={characters:'cast'}[pane.replace('pane-','')] || pane.replace('pane-','');
    const expected=await page.evaluate(({stage,source,lang})=>window.shuohaoJsonExport.filename(stage,window.shuohaoLanguage.translate(source),lang),{stage,source:raw.source,lang});
    assert.equal(item.filename,expected);
    assert.equal(data.source,{vi:'Bến đò',en:'The Ferry',zh:'渡口'}[lang]);
    assert.equal(data.episodes?.length??data.characters?.length??data.scenes?.length,raw.episodes?.length??raw.characters?.length??raw.scenes?.length);
    // Every ID, enum, path and numeric value must survive the real download unchanged.
    await page.evaluate(({raw,actual})=>{
     const check=(a,b,key='')=>{
      if(a===null||typeof a==='number'||typeof a==='boolean') {if(a!==b)throw Error('Changed scalar: '+key);}
      else if(Array.isArray(a)){if(a.length!==b.length)throw Error('Changed array: '+key);a.forEach((v,i)=>check(v,b[i],key));}
      else if(typeof a==='object'){for(const [k,v] of Object.entries(a))check(v,b[k],k);}
      else if(['id','sceneId','sceneIds','characterIds','propIds','beatIds','tier','weight','importance','adaptMode','size','camera','stability','aspectRatio','recipe','sheetImage'].includes(key)||/^(?:[A-Z]+\d+(?:[-_.][A-Za-z0-9]+)*|VO)$/.test(a)){if(a!==b)throw Error('Changed machine value: '+key+' '+a);}
     };check(raw,actual);
    },{raw,actual:data});
    if(lang==='vi') {
     const leftovers=[];
     const scan=(value,key='',at='')=>{
      if(['line','originalLine','subtitle','quote','evidence','sourceText'].includes(key)||/(?:prompt|promptNegative|sheet|visualDNA|styleDNA|h3Description|soundscapeEn|musicEn)$/i.test(key))return;
      if(Array.isArray(value))value.forEach((item,index)=>scan(item,key,at+'['+index+']'));
      else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>scan(v,k,at+'.'+k));
      else if(typeof value==='string'&&/[\u3400-\u9fff]/.test(value)&&!['adaptMode','file','sheetImage','path','url'].includes(key))leftovers.push(at);
     };
     scan(data);
     assert.deepEqual(leftovers,[],'Vietnamese export contains no untranslated Chinese prose');
    }
    exports[lang]=data;
    results.push({pane,lang,file:item.filename,source:data.source});
   }
   assert.notDeepEqual(exports.vi,exports.zh);
   const vi=exports.vi;
   if(pane==='pane-outline')assert.match(vi.episodes[0].synopsis,/Thẩm Tri Vi/);
   if(pane==='pane-characters')assert.equal(vi.characters[0].name,'Thẩm Tri Vi');
   if(pane==='pane-art')assert.equal(vi.scenes[0].image.prompt,raw.scenes[0].image.prompt);
   if(pane==='pane-script')assert.notEqual(vi.episodes[0].scenes[0].flow[0].action,raw.episodes[0].scenes[0].flow[0].action);
   if(pane==='pane-storyboard')assert.equal(vi.episodes[0].segments[0].h3Prompt,raw.episodes[0].segments[0].h3Prompt);
   const unchanged=await page.locator('#'+pane+' script[type="application/json"]').evaluate(n=>JSON.parse(n.textContent));
   assert.deepEqual(unchanged,raw);
  }
  await page.goto(base+'/staging.html?lang=vi',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.shuohaoTranslations?.length>0);
  const before=await page.evaluate(()=>JSON.parse(JSON.stringify(doc)));
  const scene=page.locator('.scene').first();
  await scene.locator('.step').filter({hasText:'+'}).click();
  await scene.locator('.where').fill('Cạnh cửa vào');
  await scene.locator('.where').dispatchEvent('change');
  const edited=await page.evaluate(()=>JSON.parse(JSON.stringify(doc)));
  assert.equal(edited.scenes[0].extras,before.scenes[0].extras+1);
  const staged={};
  for(const lang of ['vi','en','zh','vi']){
   await page.locator('#sh-language').selectOption(lang);
   const {data,filename}=await download(page.locator('.expo'),'staging-'+lang+'.json');
   assert.equal(data.lang,lang);
   assert.equal(filename,await page.evaluate(({source,lang})=>window.shuohaoJsonExport.filename('staging',window.shuohaoLanguage.translate(source),lang),{source:edited.source,lang}));
   assert.equal(data.scenes[0].extras,edited.scenes[0].extras);
   assert.equal(data.scenes[0].extrasWhere,'Cạnh cửa vào');
   for(let i=0;i<data.scenes.length;i++){
    for(const p of data.scenes[i].places){
     if(p.item)assert.ok(data.locations.find(l=>l.sceneId===data.scenes[i].sceneId).items.some(i=>i.name===p.item),'Translated item reference resolves');
     assert.ok(data.scenes[i].cast.some(c=>c.id===p.id&&c.name===p.name),'Translated cast name matches placement');
    }
   }
   staged[lang]=data;
   results.push({pane:'staging',lang,file:filename,editedExtras:data.scenes[0].extras});
  }
  assert.deepEqual(staged.vi.locations[0].items[0].plan,edited.locations[0].items[0].plan);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(doc))),edited,'Switches and downloads leave live state intact');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({downloads:results.length,errors,artifacts:output},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

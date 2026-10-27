const {chromium}=require(process.env.SHUOHAO_PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const path=require('node:path');
const output=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'shuohao-i18n-'));
const base=(process.env.SHUOHAO_PREVIEW_URL || 'http://127.0.0.1:8765').replace(/\/$/,'');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SHUOHAO_CHROMIUM ? {executablePath:process.env.SHUOHAO_CHROMIUM} : {}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
 const errors=[],pages=[],missing=new Set();
 await page.goto(base+'/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.shuohaoTranslations?.length>0);
 const defaultLocale=await page.locator('#sh-language').inputValue();
 page.on('pageerror',e=>errors.push(e.message));
 for(const path of ['/', '/report.html', '/staging.html', '/character-refs.html']){
  const response=await page.goto(base+path+'?lang=vi',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.shuohaoTranslations?.length>0&&!document.documentElement.classList.contains('sh-locale-loading'));
  const source=await page.evaluate(()=>({title:document.title,locale:document.documentElement.lang,selector:!!document.querySelector('#sh-language'),text:document.body.innerText.slice(0,450)}));
  source.languageSwitches = [];
  for (const language of ['en', 'zh', 'vi']) {
   await page.locator('#sh-language').selectOption(language);
   await page.waitForFunction(value => document.documentElement.lang === value, language);
   source.languageSwitches.push({language, title:await page.title()});
  }
  if(path==='/report.html'){
   const tabs=page.locator('.rp-rail .rp-nv');
   for(let i=0;i<await tabs.count();i++)await tabs.nth(i).click();
   const paneBefore=await page.locator('.rp-pane.rp-on').getAttribute('id');
   await page.locator('#sh-language').selectOption('en');
   await page.waitForFunction(()=>document.documentElement.lang==='en');
   source.englishTitle=await page.title();
   source.panePreserved=paneBefore===await page.locator('.rp-pane.rp-on').getAttribute('id');
   await page.locator('#sh-language').selectOption('zh');
   source.chineseTitle=await page.title();
   await page.locator('#sh-language').selectOption('vi');
   await page.locator('#rp-allbtn').click();
  }
  if(path==='/staging.html'){
   const token=page.locator('.token').first();
   if(await token.count())await token.click();
   const plus=page.locator('.step').filter({hasText:'+'}).first();
   if(await plus.count())await plus.click();
   const exportBefore=page.waitForEvent('download');await page.locator('.expo').click();
   const before=await exportBefore;await before.saveAs(output+'/staging-before.json');
   await page.locator('#sh-language').selectOption('en');await page.locator('#sh-language').selectOption('vi');
   const exportAfter=page.waitForEvent('download');await page.locator('.expo').click();
   const after=await exportAfter;await after.saveAs(output+'/staging-after.json');
   source.dynamicControlsLocalized=!(await page.locator('.pick').first().innerText()).includes('Facing') && !(await page.locator('.live').first().innerText()).includes('but not where they are');
   source.stagingStatePreserved=fs.readFileSync(output+'/staging-before.json','utf8')===fs.readFileSync(output+'/staging-after.json','utf8');
  }
  await page.waitForTimeout(180);
  const leftovers=await page.evaluate(()=>{
   const found=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
   while(n=w.nextNode())if(!n.parentElement.closest('script,style,[data-no-translate]')&&/[\u3400-\u9fff]/.test(n.data))found.push(n.data.trim());
   for(const e of document.querySelectorAll('[title],[alt],[placeholder],[aria-label]'))if(!e.closest('[data-no-translate]'))for(const a of ['title','alt','placeholder','aria-label'])if(/[\u3400-\u9fff]/.test(e.getAttribute(a)||''))found.push(e.getAttribute(a));
   return [...new Set(found)].filter(Boolean);
  });
  leftovers.forEach(s=>missing.add(s));
  source.remainingChinese=leftovers.length;source.examples=leftovers.slice(0,12);
  source.desktopOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(path==='/report.html')await page.locator('#rp-allbtn').click();
  await page.screenshot({path:output+'/'+(path==='/'?'index':path.slice(1,-5))+'-vi.png',fullPage:false});
  if(path==='/'){
   await page.setViewportSize({width:390,height:844});
   source.mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   await page.screenshot({path:output+'/index-mobile-vi.png',fullPage:true});
   await page.setViewportSize({width:1440,height:1000});
  }
  pages.push({path,http:response.status(),...source});
 }
 await page.goto(base+'/report.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.shuohaoTranslations?.length>0);
 const persistedLocale=await page.locator('#sh-language').inputValue();
 fs.writeFileSync(output+'/missing-strings.json',JSON.stringify([...missing],null,2));
 const result={pages,errors,defaultLocale,persistedLocale};fs.writeFileSync(output+'/browser-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));console.log('Artifacts: '+output);
 await browser.close();
 if(defaultLocale!=='vi'||persistedLocale!=='vi'||errors.length||pages.some(p=>p.http!==200||p.remainingChinese>0||p.locale!=='vi'||!p.selector||p.desktopOverflow||p.mobileOverflow||p.panePreserved===false||p.stagingStatePreserved===false||p.dynamicControlsLocalized===false))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});

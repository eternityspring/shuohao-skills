// Real Chrome + actual Studio UI. All API calls intercepted; no user data or AI calls.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,existsSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const base=process.env.SHUOHAO_TEST_URL||'http://127.0.0.1:8765';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=mkdtempSync(join(tmpdir(),'one-click-chrome-'));
const stages=['outline','cast','art','script','staging','storyboard'],slug='__one-click-browser';
let job={status:'running',current:'cast',options:{model:'offline-test',productionProfile:'studio-brain-v1'},reading:{status:'passed'},stages:Object.fromEntries(stages.map(s=>[s,{status:s==='outline'?'passed':s==='cast'?'running':'pending'}])),transport:{phase:'waiting'}};
let chrome,ws,closeBrowser,posts=0,cancels=0,polls=0,resumePosts=0,failPoll=false;
try {
 chrome=spawn('/usr/bin/google-chrome',['--headless=new','--disable-gpu','--no-sandbox','--no-first-run','--disable-dev-shm-usage','--remote-debugging-port=0','--remote-allow-origins=*','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 const portFile=join(profile,'DevToolsActivePort');for(let i=0;i<100&&!existsSync(portFile);i++)await sleep(100);
 assert.ok(existsSync(portFile),'Chrome starts');
 const port=readFileSync(portFile,'utf8').split('\n')[0];
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true})});
 let id=0;const pending=new Map(),errors=[];
 const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout '+method))},20000);pending.set(key,msg=>{clearTimeout(timer);msg.error?reject(Error(msg.error.message)):resolve(msg.result)});ws.send(JSON.stringify({id:key,method,params}))});
 closeBrowser=()=>send('Browser.close');
 const detail=()=>({slug,source:'Kiểm tra chạy một lần',origin:'ai-9router',episodes:[1],params:{},stages:Object.fromEntries(stages.map(s=>[s,job.stages[s].status==='passed'?'done':'none'])),ai:job,files:{},video:[]});
 ws.addEventListener('message',event=>{
  const msg=JSON.parse(event.data);if(msg.id&&pending.has(msg.id)){pending.get(msg.id)(msg);pending.delete(msg.id)}
  if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text);
  if(msg.method==='Fetch.requestPaused'){
   const {requestId,request}=msg.params,path=new URL(request.url).pathname;
   const fulfill=body=>send('Fetch.fulfillRequest',{requestId,responseCode:200,body:Buffer.from(JSON.stringify(body)).toString('base64'),responseHeaders:[{name:'Content-Type',value:'application/json'}]}).catch(e=>errors.push(e.message));
   if(path==='/api/ai/config')fulfill({configured:true,models:['offline-test'],model:'offline-test'});
   else if(path==='/api/ai/projects'){posts++;fulfill({slug,job})}
   else if(path==='/api/projects')fulfill({projects:[detail()]});
   else if(path==='/api/projects/'+slug)fulfill(detail());
   else if(path==='/api/projects/'+slug+'/ai/cancel'){cancels++;job={...job,status:'cancelled',error:null,transport:null};fulfill({ok:true,job})}
   else if(path==='/api/projects/'+slug+'/ai'){
    if(request.method==='POST')resumePosts++;
    polls++;
    if(failPoll){failPoll=false;send('Fetch.failRequest',{requestId,errorReason:'ConnectionClosed'}).catch(e=>errors.push(e.message))}
    else fulfill({job});
   }
   else if(path==='/api/scenarios')fulfill({scenarios:[]});
   else {errors.push('Unexpected API '+request.method+' '+path);fulfill({})}
  }
 });
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value};
 const until=async(expression,limit=150)=>{for(let i=0;i<limit;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('UI not ready: '+expression)};
 const paint=()=>evaluate('clearTimeout(window.__aiPoll);paintAIJob('+JSON.stringify(job)+','+JSON.stringify(slug)+');true');
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'}]});
 await send('Page.navigate',{url:base+'/?lang=vi#/new'});
 await until('document.querySelector("#ai-generate") && !document.querySelector("#ai-generate").disabled');
 await evaluate(`document.getElementById('script').value='Một người thợ tìm lại lá thư của mẹ trong hộp gỗ, đọc xong và quyết định trở về nhà.';document.getElementById('ai-generate').click();document.getElementById('ai-generate')?.click();true`);
 await until('document.querySelector("#ai-waiting")');assert.equal(posts,1,'one click, no duplicate submissions');
 assert.equal(await evaluate('Boolean(document.querySelector("#ai-continue"))'),false);
 assert.equal(await evaluate('Boolean(document.querySelector("#ai-job [role=alert],#ai-job .ai-errors"))'),false);
 // Stale error history must stay hidden during valid ongoing work.
 job.error='Old timeout';job.errors=[{at:'2026-10-29',stage:'cast',message:'Old timeout'}];
 await paint();assert.equal(await evaluate('Boolean(document.querySelector("#ai-job [role=alert],#ai-job .ai-errors"))'),false);
 job.stages.storyboard={...job.stages.storyboard,status:'running',completed:2,total:31,concurrency:1,continuityMode:'sequential-v1',activeSegments:['E01-03']};
 await paint();await until('document.getElementById("ai-storyboard-progress")?.textContent.includes("2/31")');
 assert.ok((await evaluate('document.getElementById("ai-storyboard-progress").textContent')).includes('E01-03'));
 const locales=[];
 for(const [lang,label] of [['vi','Đang chờ phản hồi AI'],['en','Waiting for the AI response'],['zh','正在等待 AI 响应']]){
  await evaluate('window.shuohaoLanguage.set('+JSON.stringify(lang)+',false);true');await paint();
  await until('document.getElementById("ai-waiting")?.textContent.includes('+JSON.stringify(label)+')');
  const progressLabel={vi:'Đoạn phân cảnh đã kiểm tra',en:'Storyboard segments checked',zh:'已验证分镜段'}[lang];
  await until('document.getElementById("ai-storyboard-progress")?.textContent.includes('+JSON.stringify(progressLabel)+')');
  const orderLabel={vi:'Đang viết theo mạch phim',en:'Writing in story order',zh:'正在按故事顺序编写'}[lang];
  await until('document.getElementById("ai-storyboard-progress")?.textContent.includes('+JSON.stringify(orderLabel)+')');locales.push(lang);
 }
 await evaluate('window.shuohaoLanguage.set("vi",false);true');
 job.transport.phase='retrying';await paint();await until('document.getElementById("ai-waiting")?.textContent.includes("đang tự thử lại")');
 assert.equal(await evaluate('Boolean(document.querySelector("#ai-job .ai-errors"))'),false);
 // Service recovery remains a neutral pending job, with a scheduled retry.
 job.transport={phase:'recovering',attempt:7,nextAttemptAt:new Date(Date.now()+60000).toISOString()};await paint();
 await until('document.getElementById("ai-waiting")?.textContent.includes("9router tạm thời chưa sẵn sàng")');
 assert.ok((await evaluate('document.getElementById("ai-waiting").textContent')).includes('Tự thử lại lúc'));
 assert.equal(await evaluate('Boolean(document.querySelector("#ai-job .ai-errors,#ai-job [role=alert]"))'),false);
 // Temporary poll failure reconnects automatically without a red error toast.
 failPoll=true;await evaluate('clearTimeout(window.__aiPoll);pollAI('+JSON.stringify(slug)+');true');
 await until('document.getElementById("ai-connection-wait")');
 assert.equal(await evaluate('Boolean(document.querySelector(".toast.bad"))'),false);
 const before=polls;await until('!document.getElementById("ai-connection-wait")',100);assert.ok(polls>before,'automatic reconnection poll');
 // All stages can complete through polling alone, without any resume POST.
 job.error=null;for(const stage of stages){job.current=stage;job.stages[stage]={status:'passed'};await evaluate('clearTimeout(window.__aiPoll);pollAI('+JSON.stringify(slug)+');true');await until('Number(document.getElementById("ai-job")?.dataset.passed)>='+JSON.stringify(stages.indexOf(stage)+1))}
 job.status='completed';job.current=null;await evaluate('clearTimeout(window.__aiPoll);pollAI('+JSON.stringify(slug)+');true');
 await until('!document.getElementById("ai-waiting") && document.querySelector("#ai-job a.cta")');assert.equal(posts,1);
 // A real failure shows a collapsed, escaped detail log.
 job.status='failed';job.current='reading';job.error='Không đọc được JSON <img src=x onerror=alert(1)>';
 job.errors=[{at:'2026-10-29',stage:'reading',message:job.error}];await paint();
 await until('document.querySelector("#ai-job .ai-errors")');
 assert.equal(await evaluate('document.querySelector("#ai-job .ai-errors").open'),false);
 assert.equal(await evaluate('document.querySelectorAll("#ai-job img").length'),0);
 assert.ok((await evaluate('document.querySelector("#ai-job [role=alert]").textContent')).includes('Không đọc được JSON'));
 // A failed tab keeps watching without closing an expanded error detail.
 await evaluate('document.querySelector(".ai-errors").open=true;true');const oldPolls=polls;
 for(let i=0;i<80&&polls===oldPolls;i++)await sleep(100);
 assert.ok(polls>oldPolls,'failed view still polls status');
 assert.equal(await evaluate('document.querySelector(".ai-errors")?.open'),true,'unchanged error details stay open');
 // An external resume clears the stale failure automatically, without a new POST.
 job.status='running';job.error=null;job.transport={phase:'waiting'};
 await until('document.getElementById("ai-stop") && !document.querySelector("#ai-job [role=alert]")',100);
 assert.equal(resumePosts,0,'passive status polling never starts an AI job');
 // Cancellation stays neutral and does not expose historical errors.
 await evaluate('document.getElementById("ai-stop").click();true');
 await until('!document.getElementById("ai-stop")');assert.equal(cancels,1);
 assert.equal(await evaluate('Boolean(document.querySelector("#ai-job .ai-errors,#ai-job [role=alert]"))'),false);
 // Long real error text remains readable on mobile.
 job.status='failed';job.error='Không đọc được dữ liệu';job.errors[0].message='x'.repeat(1500);await paint();
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
 await evaluate('document.querySelector(".ai-errors").open=true;true');await sleep(150);
 assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+2'),false,'no mobile overflow');
 const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync('/tmp/shuohao-one-click-browser.png',Buffer.from(shot.data,'base64'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({singleSubmission:posts===1,locales,neutralWait:true,automaticReconnect:true,allStagesWithoutResume:true,sequentialStoryboardProgress:true,terminalErrorsOnly:true,serviceRecovery:true,failedViewAutoRefresh:true,cancellation:true,mobile:true,browserErrors:errors,screenshot:'/tmp/shuohao-one-click-browser.png'}));
} finally {
 await closeBrowser?.().catch(()=>{});ws?.close();
 if(chrome && chrome.exitCode===null){const stopped=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill();await Promise.race([stopped,sleep(2000)])}
 await sleep(500);rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}

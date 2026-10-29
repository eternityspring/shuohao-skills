// Native HTTP contract: long waits, transient retries, bounded failures, safe errors and cancellation.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { completionText, transportOptions } from './ai-transport.mjs';
import { requestJSON } from './ai-project.mjs';

let handler, count=0, checks=0;
const payload={choices:[{message:{content:'{"ok":true}'},finish_reason:'stop'}]};
const server=createServer((req,res)=>{count++;req.resume();handler(req,res,count)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const config={baseUrl:'http://127.0.0.1:'+server.address().port+'/v1',key:'PRIVATE_TEST_KEY',model:'test',retryDelayMs:1};
const messages=[{role:'user',content:'test'}];
const reply=(res,data=payload)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data))};
async function test(name,run){count=0;await run();checks++;console.log('PASS '+name)}
const failsWith=(code)=>error=>error.code===code&&!error.message.includes(config.key)&&!error.message.includes('secret provider body');
try {
 await test('default has no request deadline; explicit transport controls validated',async()=>{
  assert.deepEqual(transportOptions(),{timeoutMs:0,maxRetries:3,retryDelayMs:3000,availabilityWaitMs:0,availabilityRetryMs:60000});
  assert.deepEqual(transportOptions({timeoutMs:'45',maxRetries:'0',retryDelayMs:'5'}),{timeoutMs:45,maxRetries:0,retryDelayMs:5,availabilityWaitMs:0,availabilityRetryMs:60000});
  assert.equal(transportOptions({timeoutMs:-1}).timeoutMs,0);
 });
 await test('waits for delayed headers AND delayed response body with no configured deadline',async()=>{
  const phases=[];handler=async(req,res)=>{
   assert.equal(req.url,'/v1/chat/completions');assert.equal(req.headers.authorization,'Bearer '+config.key);
   await delay(80);if(res.destroyed)return;res.writeHead(200,{'Content-Type':'application/json'});res.flushHeaders();
   await delay(80);if(!res.destroyed)res.end(JSON.stringify(payload));
  };
  const start=Date.now();assert.equal(await completionText(messages,{config,onStatus:p=>phases.push(p?.phase??null)}),'{"ok":true}');
  assert.ok(Date.now()-start>=150);assert.deepEqual(phases,['waiting','receiving',null]);assert.equal(count,1);
 });
 for(const status of [408,429,500,502,503,504])await test('HTTP '+status+' automatically retries without exposing provider errors',async()=>{
  const phases=[];handler=(req,res,n)=>{if(n===1){res.writeHead(status,{'Retry-After':'0'});res.end('secret provider body '+config.key)}else reply(res)};
  assert.equal(await completionText(messages,{config,onStatus:p=>phases.push(p?.phase)}),'{"ok":true}');assert.equal(count,2);
  assert.ok(phases.includes('retrying'));assert.equal(phases.at(-1),undefined);
 });
 await test('connection reset retries automatically',async()=>{
  handler=(req,res,n)=>n===1?req.socket.destroy():reply(res);
  assert.equal(await completionText(messages,{config}),'{"ok":true}');assert.equal(count,2);
 });
 await test('interrupted response retries automatically',async()=>{
  handler=(req,res,n)=>{if(n!==1)return reply(res);res.writeHead(200);res.write('{"choices":');setTimeout(()=>res.destroy(),5)};
  assert.equal(await completionText(messages,{config}),'{"ok":true}');assert.equal(count,2);
 });
 for(const status of [401,403])await test('HTTP '+status+' fails once and redacts provider body',async()=>{
  handler=(req,res)=>{res.writeHead(status);res.end('secret provider body '+config.key)};
  await assert.rejects(completionText(messages,{config}),failsWith('HTTP_'+status));assert.equal(count,1);
 });
 for(const malformed of ['broken JSON','null','{"choices":[]}','{"choices":[{"message":{"content":[null]}}]}'])await test('malformed/empty envelope retries: '+malformed,async()=>{
  handler=(req,res,n)=>{if(n===1){res.writeHead(200);res.end(malformed)}else reply(res)};
  assert.equal(await completionText(messages,{config}),'{"ok":true}');assert.equal(count,2);
 });
 await test('explicit configured timeout exhausts the configured retry count',async()=>{
  handler=()=>{};
  await assert.rejects(completionText(messages,{config:{...config,timeoutMs:30,maxRetries:1}}),failsWith('AI_TIMEOUT'));assert.equal(count,2);
 });
 await test('manual cancellation interrupts pending header wait without retry',async()=>{
  const controller=new AbortController();handler=()=>{};
  const task=completionText(messages,{config,signal:controller.signal});setTimeout(()=>controller.abort(),30);
  await assert.rejects(task,e=>e.name==='AbortError');assert.equal(count,1);
 });
 await test('manual cancellation interrupts pending response body without retry',async()=>{
  const controller=new AbortController();handler=(req,res)=>{res.writeHead(200);res.flushHeaders();setTimeout(()=>controller.abort(),20)};
  await assert.rejects(completionText(messages,{config,signal:controller.signal}),e=>e.name==='AbortError');assert.equal(count,1);
 });
 await test('manual cancellation interrupts retry backoff without another request',async()=>{
  const controller=new AbortController();handler=(req,res)=>{res.writeHead(503);res.end()};
  await assert.rejects(completionText(messages,{config:{...config,retryDelayMs:5000},signal:controller.signal,onStatus:p=>{if(p?.phase==='retrying')controller.abort()}}),e=>e.name==='AbortError');assert.equal(count,1);
 });
 await test('exhausted transient failures produce one actionable error',async()=>{
  handler=(req,res)=>{res.writeHead(503);res.end('secret provider body '+config.key)};
  await assert.rejects(completionText(messages,{config:{...config,maxRetries:2,availabilityWaitMs:-1}}),failsWith('HTTP_503'));assert.equal(count,3);
 });
 await test('persistent 503 recovers beyond the fast retry burst using the same messages',async()=>{
  const phases=[];handler=(req,res,n)=>{if(n<=6){res.writeHead(503);res.end('secret provider body '+config.key)}else reply(res)};
  assert.equal(await completionText(messages,{config:{...config,maxRetries:1,availabilityRetryMs:1},onStatus:p=>phases.push(p)}),'{"ok":true}');assert.equal(count,7);
  assert.ok(phases.some(p=>p?.phase==='recovering'));assert.equal(phases.at(-1),null);
  assert.ok(!JSON.stringify(phases).includes(config.key));
 });
 await test('manual cancellation interrupts service recovery without another request',async()=>{
  const controller=new AbortController();handler=(req,res)=>{res.writeHead(503);res.end()};
  await assert.rejects(completionText(messages,{config:{...config,maxRetries:0,availabilityRetryMs:5000},signal:controller.signal,onStatus:p=>{if(p?.phase==='recovering')controller.abort()}}),e=>e.name==='AbortError');assert.equal(count,1);
 });
 await test('finite availability budget ends recovery cleanly',async()=>{
  const phases=[];handler=(req,res)=>{res.writeHead(503);res.end()};const start=Date.now();
  await assert.rejects(completionText(messages,{config:{...config,maxRetries:0,availabilityRetryMs:5,availabilityWaitMs:50},onStatus:p=>phases.push(p)}),failsWith('HTTP_503'));
  assert.ok(phases.some(p=>p?.phase==='recovering'));assert.ok(Date.now()-start<3000);assert.ok(count>=1);
 });
 await test('Retry-After longer than a minute is respected and remains cancellable',async()=>{
  const controller=new AbortController();let scheduled;
  handler=(req,res)=>{res.writeHead(503,{'Retry-After':'75'});res.end()};
  await assert.rejects(completionText(messages,{config,signal:controller.signal,onStatus:p=>{if(p?.nextAttemptAt){scheduled=Date.parse(p.nextAttemptAt)-Date.now();controller.abort()}}}),e=>e.name==='AbortError');
  assert.ok(scheduled>=74000);assert.equal(count,1);
 });
 await test('HTTP 500 stays bounded under the default availability policy',async()=>{
  handler=(req,res)=>{res.writeHead(500);res.end()};
  await assert.rejects(completionText(messages,{config:{...config,maxRetries:1}}),failsWith('HTTP_500'));assert.equal(count,2);
 });
 await test('invalid generated JSON is classified for automatic stage repair',async()=>{
  handler=(req,res)=>reply(res,{choices:[{message:{content:'{"broken":'}}]});
  await assert.rejects(requestJSON(messages,{config}),failsWith('AI_JSON_INVALID'));assert.equal(count,1);
 });
 await test('truncated generation is not silently accepted',async()=>{
  handler=(req,res)=>reply(res,{choices:[{message:{content:'{"broken":'},finish_reason:'length'}]});
  await assert.rejects(completionText(messages,{config}),failsWith('OUTPUT_LENGTH'));assert.equal(count,1);
 });
 await test('valid AI JSON reaches the orchestrator',async()=>{
  handler=(req,res)=>reply(res);assert.deepEqual(await requestJSON(messages,{config}),{ok:true});assert.equal(count,1);
 });
 if(Number(process.env.SHUOHAO_TEST_LONG_WAIT_MS)>300000)await test('headers can arrive after five minutes with the default configuration',async()=>{
  handler=async(req,res)=>{await delay(Number(process.env.SHUOHAO_TEST_LONG_WAIT_MS));if(!res.destroyed)reply(res)};
  assert.equal(await completionText(messages,{config}),'{"ok":true}');assert.equal(count,1);
 });
 console.log('Passed '+checks+' transport scenarios. Local fake provider only; no external AI calls.');
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}

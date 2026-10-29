// Long model calls use Node HTTP directly: no hidden five-minute fetch header timeout.
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { setTimeout as delay } from 'node:timers/promises';

export class AITransportError extends Error {
  constructor(message,{retryable=false,code='AI_TRANSPORT',retryAfterMs=0}={}) {
    super(message);this.name='AITransportError';this.retryable=retryable;this.code=code;this.retryAfterMs=retryAfterMs;
  }
}
export function transportOptions(config={}) {
  const integer=(value,fallback,min,max)=>value==null || value==='' ? fallback : Number.isSafeInteger(Number(value)) && Number(value)>=min && Number(value)<=max ? Number(value) : fallback;
  return {timeoutMs:integer(config.timeoutMs,0,0,2147483647),maxRetries:integer(config.maxRetries,3,0,10),retryDelayMs:integer(config.retryDelayMs,3000,0,60000),availabilityWaitMs:integer(config.availabilityWaitMs,0,-1,2147483647),availabilityRetryMs:integer(config.availabilityRetryMs,60000,1,3600000)};
}
// Availability failures may outlast a short retry burst. Keep the same request
// pending, at a lower cadence, rather than failing a mostly completed project.
const availabilityError=error=>/^(?:HTTP_(?:408|425|429|502|503|504|522|524)|CONNECTION_ERROR|RESPONSE_INTERRUPTED)$/.test(error.code);
export async function withTransportRetry(operation,{config={},signal,onStatus=()=>{}}={}) {
  const {maxRetries,retryDelayMs,availabilityWaitMs,availabilityRetryMs}=transportOptions(config);
  let unavailableSince=null;
  for(let attempt=1;;attempt++) {
    signal?.throwIfAborted();
    const maxAttempts=attempt<=maxRetries+1?maxRetries+1:null;
    onStatus({phase:'waiting',attempt,maxAttempts,startedAt:new Date().toISOString()});
    try {
      const result=await operation({attempt,onResponse:()=>onStatus({phase:'receiving',attempt,maxAttempts})});
      onStatus(null);return result;
    } catch(error) {
      if(signal?.aborted || !error.retryable)throw error;
      const unavailable=availabilityError(error);
      if(unavailable && unavailableSince===null)unavailableSince=Date.now();
      const recovering=attempt>maxRetries;
      if(recovering && (!unavailable || availabilityWaitMs===-1 || (availabilityWaitMs>0 && Date.now()-unavailableSince>=availabilityWaitMs)))throw error;
      const backoff=Math.min(60000,retryDelayMs*2**Math.min(attempt-1,10));
      let waitMs=Math.min(2147483647,Math.max(recovering?availabilityRetryMs:0,backoff,error.retryAfterMs || 0));
      if(recovering && availabilityWaitMs>0)waitMs=Math.min(waitMs,Math.max(1,availabilityWaitMs-(Date.now()-unavailableSince)));
      // A waiting provider is progress. Do not append transient failures to the
      // project's terminal error log or start another segment in parallel.
      onStatus({phase:recovering?'recovering':'retrying',attempt,maxAttempts:recovering?null:maxRetries+1,code:error.code,nextAttemptAt:new Date(Date.now()+waitMs).toISOString(),...(recovering?{unavailableSince:new Date(unavailableSince).toISOString()}:{} )});
      await delay(waitMs,undefined,{signal});
      if(recovering && availabilityWaitMs>0 && Date.now()-unavailableSince>=availabilityWaitMs)throw error;
    }
  }
}
function completionOnce(messages,{config,signal,onResponse}) {
  return new Promise((resolve,reject)=>{
    const {timeoutMs}=transportOptions(config);
    const url=new URL(config.baseUrl.replace(/\/+$/,'')+'/chat/completions');
    if(!['http:','https:'].includes(url.protocol))throw new AITransportError('Địa chỉ 9router phải dùng HTTP hoặc HTTPS.');
    const body=JSON.stringify({model:config.model,messages,stream:false,max_tokens:20000});
    const abort=timeoutMs?AbortSignal.timeout(timeoutMs):null;
    const combined=signal&&abort?AbortSignal.any([signal,abort]):signal||abort||undefined;
    let settled=false;
    const fail=error=>{if(!settled){settled=true;reject(error)}};
    const request=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{method:'POST',agent:false,signal:combined,headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},response=>{
      const status=response.statusCode;
      if(status<200 || status>=300) {
        const retryable=[408,425,429,500,502,503,504,522,524].includes(status);
        const retryHeader=response.headers['retry-after'];
        const seconds=Number(retryHeader);
        const retryAfterMs=Number.isFinite(seconds)?seconds*1000:Math.max(0,Date.parse(retryHeader)-Date.now()) || 0;
        response.destroy();
        fail(new AITransportError('9router trả lỗi HTTP '+status+'.',{retryable,code:'HTTP_'+status,retryAfterMs}));return;
      }
      onResponse();
      response.setEncoding('utf8');let raw='',bytes=0;
      response.on('data',chunk=>{
        bytes+=Buffer.byteLength(chunk);
        if(bytes>8*1024*1024){response.destroy();fail(new AITransportError('Phản hồi 9router quá lớn để đọc an toàn.'));return}
        raw+=chunk;
      });
      response.on('error',()=>fail(new AITransportError('Kết nối bị ngắt khi đang nhận phản hồi AI.',{retryable:true,code:'RESPONSE_INTERRUPTED'})));
      response.on('end',()=>{
        if(settled)return;
        let data;
        try{data=JSON.parse(raw)}catch{fail(new AITransportError('9router trả phản hồi không đầy đủ hoặc không phải JSON.',{retryable:true,code:'INVALID_RESPONSE'}));return}
        if(!data || typeof data!=='object' || Array.isArray(data)){fail(new AITransportError('9router trả cấu trúc phản hồi không hợp lệ.',{retryable:true,code:'INVALID_RESPONSE'}));return}
        if(data.error){fail(new AITransportError('9router báo lỗi khi gọi model.',{retryable:false,code:'PROVIDER_ERROR'}));return}
        const choice=data.choices?.[0];
        if(choice?.finish_reason==='length'){fail(new AITransportError('Phản hồi AI chạm giới hạn độ dài; phần này chưa được lưu thành kết quả hợp lệ.',{code:'OUTPUT_LENGTH'}));return}
        const content=choice?.message?.content;
        const text=Array.isArray(content)?content.map(x=>typeof x?.text==='string'?x.text:'').join(''):content;
        if(typeof text!=='string'||!text.trim()){fail(new AITransportError('AI không trả nội dung để đọc.',{retryable:true,code:'EMPTY_RESPONSE'}));return}
        settled=true;resolve(text);
      });
    });
    request.on('error',()=>{
      if(signal?.aborted){fail(signal.reason || new DOMException('Đã dừng biên soạn.','AbortError'));return}
      fail(abort?.aborted
        ?new AITransportError('Đã hết thời gian chờ 9router theo cấu hình server.',{retryable:true,code:'AI_TIMEOUT'})
        :new AITransportError('Không kết nối được 9router hoặc kết nối đã bị ngắt.',{retryable:true,code:'CONNECTION_ERROR'}));
    });
    request.end(body);
  });
}
export function completionText(messages,{config,signal,onStatus}={}) {
  if(!config?.key)throw new AITransportError('Chưa cấu hình khóa 9router ở server. Đặt NINE_ROUTER_API_KEY hoặc SHUOHAO_AI_API_KEY.');
  return withTransportRetry(({onResponse})=>completionOnce(messages,{config,signal,onResponse}),{config,signal,onStatus});
}

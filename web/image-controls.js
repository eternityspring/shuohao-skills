/* Shared Studio image controls. API keys and provider requests stay on the server. */
(() => {
 'use strict';
 let generation=0,timer;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const running=job=>['queued','running'].includes(job?.status);
 async function api(path,options){
  const response=await fetch(path,{cache:'no-store',headers:{'Content-Type':'application/json'},...options});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Không gọi được API tạo ảnh.');return data;
 }
 function stop(){generation++;clearTimeout(timer)}
 async function mount(host,slug,{kinds,gallery=false,onDone=()=>{}}={}){
  stop();const token=generation,endpoint='/api/projects/'+encodeURIComponent(slug)+'/images';let data,lastStatus;
  const valid=()=>token===generation&&host.isConnected;
  const link=file=>'/project/'+encodeURIComponent(slug)+'/'+file.split('/').map(encodeURIComponent).join('/');
  function card(item){
   const working=running(data.job),own=working&&data.job.assetId===item.assetId,error=data.job?.assetId===item.assetId?data.job.error:null;
   const status=own?(data.job.transport?.phase==='receiving'?'Đang nhận ảnh…':'Đang chờ ảnh từ 9router…'):item.image?(item.stale?'Ảnh cần cập nhật theo prompt hoặc ảnh tham chiếu mới.':'Đã lưu ảnh tham chiếu.'):'';
   return `${item.image?`<a class="reference-preview" href="${link(item.image.file)}" download><img src="${link(item.image.file)}" alt="${esc(item.label)}" loading="lazy"></a>`:''}
    <div class="row"><button class="btn secondary" data-image-generate="${esc(item.assetId)}" ${working||data.busy||!data.configured||item.blocked?'disabled':''}>${item.image?'Tạo lại ảnh':item.kind==='character'?'Tạo ảnh nhân vật':item.kind==='frame'?'Tạo keyframe':'Tạo ảnh tham chiếu'}</button>${own?'<button class="btn ghost" data-image-cancel>Dừng tạo ảnh</button>':''}${item.image?`<a class="btn ghost" href="${link(item.image.file)}" download>Tải ảnh PNG</a>`:''}</div>
    ${status?`<p class="hint" role="status">${esc(status)}</p>`:''}
    ${item.blocked?`<p class="hint">${esc(item.blocked)}</p>`:''}
    ${data.busy&&!working?'<p class="hint">Dự án đang có một lượt AI khác. Vui lòng chờ hoàn tất.</p>':''}
    ${item.missing?.length?`<div class="chips">${item.missing.map(ref=>`<a class="chip" href="#/project/${encodeURIComponent(slug)}/${ref.assetId.startsWith('character:')?'cast':'art'}">${esc(ref.label)} →</a>`).join('')}</div>`:''}
    ${error?`<div class="warn" role="alert">${esc(error)}</div>`:''}
    <details class="image-prompt"><summary>Prompt ảnh (tiếng Anh)</summary><pre data-no-translate>${esc(item.prompt)}</pre></details>`;
  }
  function paint(){
   if(!valid())return;
   if(gallery){
    const items=data.items.filter(item=>!kinds||kinds.includes(item.kind));
    host.hidden=!items.length;
    host.innerHTML=`<details class="reference-gallery" ${items.length<12?'open':''}><summary><b>Ảnh tham chiếu qua 9router</b> · ${items.filter(item=>item.image&&!item.stale).length}/${items.length}</summary><p class="hint">Tạo từng ảnh bằng prompt tiếng Anh đã lưu. Keyframe dùng ảnh tham chiếu đã tạo để giữ nhất quán.</p><div class="reference-grid">${items.map(item=>`<article class="reference-card"><h3>${esc(item.label)}</h3><div data-image-slot="${esc(item.assetId)}"></div></article>`).join('')}</div></details>`;
   }
   host.querySelectorAll('[data-image-slot]').forEach(slot=>{
    const item=data.items.find(item=>item.assetId===slot.dataset.imageSlot);
    slot.innerHTML=item?card(item):'<p class="hint">Chưa có prompt ảnh cho mục này.</p>';
   });
   host.querySelectorAll('[data-image-generate]').forEach(button=>button.onclick=async()=>{
    button.disabled=true;
    try{const reply=await api(endpoint,{method:'POST',body:JSON.stringify({assetId:button.dataset.imageGenerate})});if(!valid())return;data.job=reply.job;paint();schedule()}
    catch(error){if(valid()){const slot=button.closest('[data-image-slot]');let alert=slot.querySelector('[role=alert]');if(!alert){alert=document.createElement('div');alert.className='warn';alert.setAttribute('role','alert');slot.appendChild(alert)}alert.textContent=error.message;button.disabled=false}}
   });
   host.querySelectorAll('[data-image-cancel]').forEach(button=>button.onclick=async()=>{
    button.disabled=true;try{await api(endpoint+'/cancel',{method:'POST',body:'{}'});schedule()}catch(error){button.disabled=false;button.textContent=error.message}
   });
   if(!data.configured){const notice=document.createElement('p');notice.className='warn';notice.textContent='Chưa cấu hình khóa 9router ở server.';host.prepend(notice)}
  }
  function schedule(){clearTimeout(timer);if(valid())timer=setTimeout(refresh,2200)}
  async function refresh(){
   try{
    const next=await api(endpoint);if(!valid())return;data=next;
    const status=data.job?.status;if(lastStatus&&lastStatus!==status&&!running(data.job))onDone();lastStatus=status;
    paint();if(running(data.job)||data.busy)schedule();
   }catch(error){if(!valid())return;let notice=host.querySelector('.image-connection-error');if(!notice){notice=document.createElement('p');notice.className='warn image-connection-error';host.prepend(notice)}notice.textContent=error.message;schedule()}
  }
  await refresh();
 }
 globalThis.shuohaoImages={mount,stop};
})();

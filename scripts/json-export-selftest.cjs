const assert = require('node:assert/strict');
const {localize,filename} = require('../web/json-export.js');
const source = {
  source:'渡口', lang:'zh', summary:'雾中的渡口',
  characters:[{id:'C01',name:'沈知微',tier:'lead',importance:'protagonist',aliases:['姑娘']}],
  locations:[{sceneId:'S01',name:'渡口栈桥',readFrom:'prompt',items:[{name:'长桌',plan:[.1,.2,.7,.8],on:false}]}],
  scenes:[{cast:[{id:'C01',name:'沈知微'}],places:[{id:'C01',name:'沈知微',item:'长桌',side:'north',posture:'stand',facing:'south',along:.4,present:true}],extras:2,extrasWhere:'门边'}],
  image:{prompt:'雾中的渡口',file:'images/渡口.png',sheetImage:'渡口-sheet.png',url:'https://example.test/渡口.png',sha256:'abc123'},
  params:{adaptMode:'抽核'}, references:['C01','S01','images/渡口.png'],
  arbitrary:{numeric:2,flag:false,nil:null,empty:'',custom:'雾中的渡口',source:'inferred'},
};
const original=JSON.stringify(source);
const dictionary={渡口:'Bến đò',雾中的渡口:'Bến đò trong sương',沈知微:'Thẩm Tri Vi',姑娘:'Cô gái',渡口栈桥:'Cầu tàu bến đò',长桌:'Bàn dài',门边:'cạnh cửa'};
// Deliberately offers translations for technical values to catch accidental rewriting.
const translate=value=>dictionary[value]||({north:'bắc',south:'nam',stand:'đứng',lead:'chính',抽核:'Chắt lọc',prompt:'mô tả',C01:'BROKEN',abc123:'BROKEN'}[value])||value;
const vi=localize(source,'vi',translate);
assert.equal(vi.source,'Bến đò');
assert.equal(vi.lang,'vi');
assert.equal(vi.image.prompt,source.image.prompt,'Production prompts are independent of interface language');
assert.equal(vi.characters[0].name,'Thẩm Tri Vi');
assert.deepEqual(vi.characters[0].aliases,['Cô gái']);
assert.equal(vi.scenes[0].places[0].name,vi.scenes[0].cast[0].name);
assert.equal(vi.scenes[0].places[0].item,vi.locations[0].items[0].name);
assert.deepEqual(vi.locations[0].items[0].plan,source.locations[0].items[0].plan);
assert.deepEqual(vi.references,source.references);
assert.equal(vi.image.file,source.image.file);
assert.equal(vi.image.sheetImage,source.image.sheetImage);
assert.equal(vi.image.url,source.image.url);
assert.equal(vi.image.sha256,source.image.sha256);
assert.equal(vi.params.adaptMode,'抽核');
assert.equal(vi.characters[0].tier,'lead');
assert.equal(vi.characters[0].id,'C01');
assert.equal(vi.locations[0].readFrom,'prompt');
assert.equal(vi.scenes[0].places[0].side,'north');
assert.equal(vi.scenes[0].places[0].facing,'south');
assert.equal(vi.scenes[0].places[0].posture,'stand');
assert.equal(vi.arbitrary.source,'inferred');
assert.equal(vi.arbitrary.nil,null);
assert.equal(vi.arbitrary.flag,false);
assert.equal(vi.arbitrary.numeric,2);
assert.equal(vi.arbitrary.custom,'Bến đò trong sương');

assert.deepEqual(localize({ui:{prompt:'雾中的渡口',line:'门边'},image:{prompt:'雾中的渡口'}},'vi',translate),{ui:{prompt:'Bến đò trong sương',line:'cạnh cửa'},image:{prompt:'雾中的渡口'},lang:'vi'},'UI labels translate while production content stays fixed');
assert.equal(JSON.stringify(source),original);
vi.locations[0].items[0].plan[0]=9;
assert.equal(source.locations[0].items[0].plan[0],.1,'Export owns its arrays');
assert.equal(localize({source:'渡口'},'en',()=> 'The Ferry').lang,'en');
assert.equal(localize({source:'渡口'},'zh',v=>v).source,'渡口');
assert.throws(()=>localize(source,'fr',translate));
const bundle={schemaVersion:1,kind:'shuohao-project',project:{slug:'THE-QUIRKY-KINGDOM',lang:'zh',stages:{outline:'passed'}},outline:source,cast:{lang:'zh',source:'渡口'},split:{summary:'雾中的渡口'}};
const copy=localize(bundle,'vi',translate);
assert.equal(copy.project.lang,'vi');assert.equal(copy.split.lang,'vi');assert.equal(copy.outline.lang,'vi');assert.equal(copy.cast.lang,'vi');
assert.equal(copy.project.slug,bundle.project.slug);assert.equal(copy.kind,bundle.kind);assert.deepEqual(copy.project.stages,bundle.project.stages);
assert.equal(copy.outline.characters[0].id,'C01');assert.equal(bundle.outline.lang,'zh');
const stages=['outline','cast','art','script','staging','storyboard','reading','production','all'];
for(const language of ['vi','en','zh']) {
 const names=stages.map(stage=>filename(stage,'HỒ SƠ/THIẾT KẾ: '.repeat(40)+'🚀',language));
 assert.equal(new Set(names).size,stages.length,'long names retain a distinct section suffix');
 for(const name of names){assert.ok(Buffer.byteLength(name)<255);assert.ok(!/[\\/:*?"<>|]/.test(name));assert.ok(name.endsWith('-'+language+'.json'));}
}
assert.equal(filename('outline','THE-QUIRKY-KINGDOM','vi'),'THE-QUIRKY-KINGDOM-dan-y-vi.json');
assert.equal(filename('storyboard','THE-QUIRKY-KINGDOM','en'),'THE-QUIRKY-KINGDOM-storyboard-en.json');
assert.equal(filename('all','THE-QUIRKY-KINGDOM','vi'),'THE-QUIRKY-KINGDOM-toan-bo-vi.json');
assert.throws(()=>filename('all','demo','fr'));assert.throws(()=>filename('unknown','demo','vi'));
assert.deepEqual(localize({line:'Hello',subtitle:'Xin chào',originalLine:'Xin chào',dialogueLang:'en',subtitleLang:'vi',motionPrompt:'Slowly open the door.'},'zh',()=> 'BROKEN'),{line:'Hello',subtitle:'Xin chào',originalLine:'Xin chào',dialogueLang:'en',subtitleLang:'vi',motionPrompt:'Slowly open the door.',lang:'zh'});
console.log('JSON export policy: localized documents and bundles, stable references, bounded distinct section filenames, no source mutations passed.');

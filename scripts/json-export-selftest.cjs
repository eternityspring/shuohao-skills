const assert = require('node:assert/strict');
const {localize} = require('../web/json-export.js');
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
assert.equal(vi.image.prompt,'Bến đò trong sương');
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

assert.equal(JSON.stringify(source),original);
vi.locations[0].items[0].plan[0]=9;
assert.equal(source.locations[0].items[0].plan[0],.1,'Export owns its arrays');
assert.equal(localize({source:'渡口'},'en',()=> 'The Ferry').lang,'en');
assert.equal(localize({source:'渡口'},'zh',v=>v).source,'渡口');
assert.throws(()=>localize(source,'fr',translate));
console.log('JSON export policy: localized content, stable references and technical data, no source mutations passed.');

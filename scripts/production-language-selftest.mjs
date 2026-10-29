import assert from 'node:assert/strict';
import {translationUnits,translatedDocuments,checkTranslations,subtitleTracks,dialogueBudgets,validatePromptLanguage} from './production-language.mjs';
const docs={
 reading:{lang:'vi',facts:[{id:'F01',quote:'Mai mở cửa.',meaning:'Mai mở cánh cửa gỗ.'}]},
 cast:{lang:'vi',characters:[{id:'C01',name:'Mai',image:{prompt:'A child with a green shirt.'},production:{visualDNA:'A child with a green shirt.'},persona:{evidence:['Mai mở cửa.']}}]},
 art:{lang:'vi',scenes:[{id:'S01',name:'Căn phòng',lighting:[{state:'Sáng sớm'}]}],props:[{id:'P01',scale:'手持级',image:{prompt:'Chiếc chìa khóa bằng đồng trên nền trắng.'}}]},
 script:{lang:'vi',params:{charsPerSecond:16,maxLineChars:80},episodes:[{ep:1,scenes:[{sceneId:'S01',flow:[{speaker:'C01',line:'Chào bạn!',acting:{face:'Môi hé.'}},{action:'Mai mở cửa.'}]}]}]},
 storyboard:{lang:'vi',promptLang:'en',episodes:[{ep:1,segments:[{id:'E01-01',sceneIndex:1,cuts:[{beats:[1,1],seconds:3,camera:'Static Shot'}],h3Prompt:'Ignore the old composed prompt.'}]}]},
};
const before=JSON.stringify(docs),{units,names}=translationUnits(docs);
assert.ok(units.some(x=>x.kind==='dialogue'&&x.text==='Chào bạn!'));
assert.ok(units.some(x=>x.kind==='prompt'&&x.text.includes('nền trắng')));
assert.ok(!units.some(x=>x.text==='A child with a green shirt.'));
assert.ok(!units.some(x=>['F01','C01','S01','P01','手持级','Static Shot','Mai'].includes(x.text)));
const values={'Chào bạn!':'Hello there!','Mai mở cánh cửa gỗ.':'Mai opens the wooden door.','Căn phòng':'The room','Sáng sớm':'Early morning','Chiếc chìa khóa bằng đồng trên nền trắng.':'A brass key, handheld scale, on a pure white background.','Môi hé.':'Lips part slightly.'};
const reply={translations:units.map(x=>({id:x.id,text:values[x.text] || 'Mai opens the door.'}))};
assert.deepEqual(checkTranslations(reply,units,names),[]);
const translations=Object.fromEntries(reply.translations.map(x=>[x.id,x.text]));
const en=translatedDocuments(docs,translations),line=en.script.episodes[0].scenes[0].flow[0];
assert.ok(validatePromptLanguage(docs).length);assert.deepEqual(validatePromptLanguage(en),[]);
assert.equal(line.line,'Hello there!');assert.equal(line.subtitle,'Chào bạn!');assert.equal(line.originalLine,'Chào bạn!');assert.equal(line.subtitleLang,'vi');
assert.equal(en.cast.characters[0].name,'Mai');assert.equal(en.reading.facts[0].quote,'Mai mở cửa.');assert.equal(en.art.props[0].scale,'手持级');
assert.equal(en.script.episodes[0].scenes[0].sceneId,'S01');assert.equal(en.storyboard.episodes[0].segments[0].cuts[0].seconds,3);
assert.equal(en.cast.characters[0].image.prompt,docs.cast.characters[0].image.prompt);assert.equal(JSON.stringify(docs),before);
assert.ok(checkTranslations({translations:[]},units,names).length);
assert.ok(checkTranslations({translations:[...reply.translations,reply.translations[0]]},units,names).length);
assert.ok(checkTranslations({translations:reply.translations.map(x=>({...x,text:'Chưa dịch'}))},units,names).length);
const d=units.find(x=>x.kind==='dialogue');assert.ok(checkTranslations({translations:[{id:d.id,text:'A'.repeat(100)}]},[d],names).length);
assert.equal(dialogueBudgets(docs).get('Chào bạn!'),48);
const tracks=subtitleTracks(en.script,en.storyboard);assert.equal(tracks.cues.length,1);assert.equal(tracks.cues[0].from,0);assert.equal(tracks.cues[0].to,3);
assert.match(tracks.bilingual,/00:00:00,000 --> 00:00:03,000\nHello there!\nChào bạn!/);
console.log('PASS: English translation field policy, prompt DNA, dialogue budgets, exact original subtitles, source evidence, stable structure, complete replies, and bilingual SRT.');

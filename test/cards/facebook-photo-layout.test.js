import test from 'node:test';
import assert from 'node:assert/strict';
import {facebookNativePayload} from '../../src/providers/facebook.js';
import {parseInstagramCard} from '../../src/providers/instagram.js';
import {parseSocialUrl} from '../../src/previews.js';
const url='https://www.facebook.com/photo?fbid=1806517487514738';
const embed={url,title:'This is a Clue',description:'A caption',author:{name:'Example Person',url:'https://www.facebook.com/example.person/'},image:{url:'https://scontent-test.xx.fbcdn.net/photo.jpg'}};
test('Facebook photo and Instagram share component ordering and author/media/caption spacing',()=>{
 const fb=facebookNativePayload(url,[embed]).components[1];
 const ig=parseInstagramCard('<script id="discord:component-embed">'+JSON.stringify({component:{type:17,components:[{type:10,content:'Example Person @example.person'},{type:10,content:'A caption'},{type:12,items:[{media:{url:'https://oginstagram.com/offload/ABC/1'}}]}]}})+'</script>',parseSocialUrl('https://www.instagram.com/p/ABC/'));
 assert.deepEqual(fb.components.map(x=>x.type),ig.components.map(x=>x.type));
 assert.deepEqual(fb.components.filter(x=>x.type===14),ig.components.filter(x=>x.type===14));
 assert.equal(fb.components[0].content.split('\n')[1],'**Example Person** @\u200bexample.person');
 assert.equal(fb.components[1].items[0].media.url,embed.image.url);
 assert.match(fb.components.at(-1).content,/Facebook/);
});
test('Facebook photo captions preserve shared 300-codepoint cap, links, and literal punctuation',()=>{
 let card=facebookNativePayload(url,[{...embed,description:'😀'.repeat(301)}]).components[1];
 assert.equal(card.components[2].content,'😀'.repeat(300)+'…');
 card=facebookNativePayload(url,[{...embed,description:'- See https://example.org/page?utm_source=qa'}]).components[1];
 assert.equal(card.components[2].content,'\\- See <https://example.org/page>');
});
test('Facebook photo author handles require a valid explicit profile URL and never come from the title',()=>{
 for(const author of [undefined,{name:'A Display Name'},{name:'A Display Name',url:'https://evil.test/example.person'},{name:'A Display Name',url:'https://www.facebook.com/profile.php?id=123'},{name:'A Display Name',url:'https://www.facebook.com/groups/'}]){
  const card=facebookNativePayload(url,[{...embed,author}]).components[1];
  assert.ok(!card.components.some(x=>x.content?.includes('@\u200b')));
 }
 assert.equal(facebookNativePayload('https://www.facebook.com/reel/123',[embed]),null);
});

test('Facebook photo keeps native caption/title out of the author line',()=>{
 const input={...embed,title:'Caption text that must not become the heading',description:'Separate caption',author:{name:'This is a clue',url:'https://www.facebook.com/thisisaclue'}};
 const card=facebookNativePayload(url,[input]).components[1];
 assert.match(card.components[0].content,/Facebook Photo/);
 assert.equal(card.components[0].content.split('\n')[1],'**This is a clue** @\u200bthisisaclue');
 assert.equal(card.components[2].content,'Separate caption');
 assert.ok(!card.components[0].content.split('\n')[1].includes('caption'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {simpleCard,simplePayload,metadataFromFx,validMedia} from '../../src/simple-cards.js';
import {cleanCardLinks} from '../../src/repost.js';
const blue='https://bsky.app/profile/example.com/post/abc123';
const twitter='https://twitter.com/example/status/123';
const video='https://pds-cache.fxbsky.app/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreidda33y6agfdeougm6qfu2oejammaaocmy42pdz3eeeuwpzst3m2u';
function metadata(platform,media=[]) {
 return metadataFromFx({code:200,status:{text:'Main text '.repeat(50)+'https://example.com',author:{name:'Display',screen_name:'handle',avatar_url:'https://example.com/avatar.png'},media:{all:media.map(url=>({url}))},quote:{text:'Quote '.repeat(60),url:platform==='twitter'?twitter:blue,author:{name:'Quoted',screen_name:'quote'},media:{all:[{url:media[0]}]}}}},platform);
}
test('Bluesky shares Twitter text, author, quote, gallery and divider layout',()=>{
 for(const size of [0,1,2]) {
  const cards=['twitter','bluesky'].map(platform=>simpleCard({platform,url:platform==='twitter'?twitter:blue},metadata(platform,Array.from({length:size},(_,i)=>`https://${platform==='twitter'?'pbs.twimg.com':'cdn.bsky.app'}/image${i}.jpg`))));
  const [a,b]=cards.map(c=>c.components);
  assert.deepEqual(a.map(c=>c.type),b.map(c=>c.type));
  assert.match(a[0].content,/Twitter Post/);assert.match(b[0].content,/Bluesky Post/);
  assert.deepEqual(a.slice(1,-1).map(c=>c.type===12?{type:12,count:c.items.length}:c),b.slice(1,-1).map(c=>c.type===12?{type:12,count:c.items.length}:c));
  assert.equal(b.filter(c=>c.type===12).length,size?1:0); // No quoted media gallery.
  assert.equal(b.find(c=>c.content?.startsWith('Main text')).content.replace(/\u200b/g,''),metadata('bluesky').caption.replace('https://example.com','<https://example.com/>'));
  assert.match(b.find(c=>c.content?.startsWith('> ')).content,/…$/);
  assert.ok(!JSON.stringify(b).includes('avatar.png'));
 }
});
test('Bluesky accepts only the exact observed helper video route',()=>{
 assert.equal(validMedia(video,'bluesky'),true);assert.equal(validMedia(video,'twitter'),false);
 for(const bad of [video.replace('https:','http:'),video.replace('pds-cache.fxbsky.app','pds-cache.fxbsky.app.evil.test'),video.replace('pds-cache.fxbsky.app','user@pds-cache.fxbsky.app'),video.replace('pds-cache.fxbsky.app','pds-cache.fxbsky.app:443'),video+'?redirect=https://evil.test',video+'#fragment','https://pds-cache.fxbsky.app/arbitrary'])assert.equal(validMedia(bad,'bluesky'),false,bad);
});
test('Bluesky helper main video reaches gallery without downloading media; quote video remains omitted',async()=>{
 const calls=[];
 const payload=await simplePayload(blue+'?UTM_source=share',{bluesky:'fxembed'},[],async url=>{
  calls.push(url);return new Response(JSON.stringify({code:200,status:{text:'Video caption',author:{name:'Person'},media:{videos:[{url:video}]},quote:{url:blue,text:'Quote',media:{videos:[{url:video}]}}}}),{headers:{'Content-Type':'application/json'}});
 });
 assert.deepEqual(calls,['https://api.fxbsky.app/2/status/example.com/abc123']);
 const galleries=payload.components[1].components.filter(c=>c.type===12);assert.equal(galleries.length,1);assert.equal(galleries[0].items[0].media.url,video);
 assert.equal(cleanCardLinks(blue+'?UTM_source=share&utm_custom=x'),blue);
});
test('Bluesky and Twitter reject protected/tombstone posts and oversized cards equally',async()=>{
 for(const platform of ['twitter','bluesky']) {
  assert.equal(metadataFromFx({code:200,status:{author:{protected:true}}},platform),null);
  assert.equal(metadataFromFx({code:200,status:{type:'tombstone'}},platform),null);
  await assert.rejects(simplePayload(platform==='twitter'?twitter:blue,{[platform]:'fxembed'},[],async()=>new Response(JSON.stringify({code:200,status:{text:'x'.repeat(6000)}}),{headers:{'Content-Type':'application/json'}})),/Card text budget/);
 }
});

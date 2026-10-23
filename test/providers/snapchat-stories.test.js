import test from 'node:test';
import assert from 'node:assert/strict';
import {savedStoryUrl,savedStoryMetadata,snapchatAttachment} from '../../src/providers/snapchat.js';
import {simplePayload} from '../../src/simple-cards.js';
const id='7a40551a-aa92-45c3-bea3-1d2bb09371ac';
const url=`https://www.snapchat.com/@cubs/highlight/${id}/embed`;
const mp4=Buffer.from('000000186674797069736f6d0000020069736f6d6d703431','hex');
const props=()=>({linkPreview:{canonicalUrl:url},publicUserProfile:{username:'cubs',title:'Cubs'},highlight:{highlightId:{value:id},storyTitle:{value:'Saved Story'},snapList:Array.from({length:19},(_,i)=>({snapMediaType:1,snapUrls:{mediaUrl:`https://cf-st.sc-cdn.net/d/${i}`,overlayUrl:null}}))}});
const html=p=>`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:p}})}</script>`;
test('Saved Story is bound to canonical URL, highlight ID and author, with bounded selection',()=>{
 const p=props();assert.equal(savedStoryUrl(url.replace('@','%40')+'?utm_source=qa').url,url);
 const m=savedStoryMetadata(html(p),url);assert.equal(m.entries.length,10);assert.equal(m.total,19);assert.equal(m.name,'Cubs');assert.equal(m.username,'cubs');
 for(const change of [p=>p.linkPreview.canonicalUrl=url.replace('cubs','other'),p=>p.highlight.highlightId.value='wrong',p=>p.publicUserProfile.username='other',p=>p.highlight.snapList=[],p=>p.highlight.snapList[0].snapUrls.mediaUrl='https://evil.test/d/a',p=>p.highlight.snapList[0].snapUrls.overlayUrl='overlay']){const p=props();change(p);assert.equal(savedStoryMetadata(html(p),url),null);}
 assert.equal(savedStoryMetadata('<html>expired</html>',url),null);
});
test('saved Story uploads first ten in one card with count and full-Story link',async()=>{
 const p=await simplePayload(url,{snapchat:'card'},[],async u=>u===url?new Response(html(props()),{headers:{'content-type':'text/html'}}):new Response(mp4,{headers:{'content-type':'video/mp4'}}));
 assert.equal(p.files.length,10);assert.equal(p.components.length,2);
 const card=p.components.find(c=>c.type===17);
 assert.deepEqual(card.components[1],{type:10,content:'**Cubs** @\u200bcubs'});
 assert.deepEqual(card.components.at(-2),{type:14,divider:true,spacing:1});
 assert.ok(card.components.findIndex(c=>c.type===12)<card.components.length-2);
 assert.match(card.components.at(-3).content,/Showing 10 of 19/);
 assert.match(JSON.stringify(p.components),/Showing 10 of 19 Snaps/);assert.doesNotMatch(JSON.stringify(p.components),/preview unavailable/);
 const fail=await simplePayload(url,{snapchat:'card'},[],async u=>u===url?new Response(html(props()),{headers:{'content-type':'text/html'}}):new Response('',{status:403}));
 assert.equal(fail.files,undefined);assert.match(JSON.stringify(fail.components),/Story preview unavailable/);
});
test('saved Story image bytes require matching allowed format and host',async()=>{
 const png=Buffer.from('89504e470d0a1a0a00000000','hex');
 const data=await snapchatAttachment('https://cf-st.sc-cdn.net/d/a',async()=>new Response(png,{headers:{'content-type':'image/png'}}),{remaining:1024},'story-image');assert.equal(data.ext,'png');
 assert.equal(await snapchatAttachment('https://cf-st.sc-cdn.net/other',()=>assert.fail('No request'),undefined,'story-image'),null);
 assert.equal(await snapchatAttachment('https://cf-st.sc-cdn.net/d/a',async()=>new Response(mp4,{headers:{'content-type':'image/png'}}),undefined,'story-image'),null);
});

test('individual public Story selection is bound to route query and never returns neighboring Snaps',async()=>{
 const {publicStorySnapMetadata,publicStorySnapUrl}=await import('../../src/providers/snapchat.js');
 const snapId='sWO_duZfSV-aKluMi_U4sgAAgd3R0d2N2c2p2AaFg7Nn3AaFg7LaVAAAAAA';
 const url=`https://www.snapchat.com/@djkhaled305/${snapId}`;
 assert.equal(publicStorySnapUrl(`https://story.snapchat.com/u/djkhaled305/${snapId}`).url,url);
 const selected={snapId:{value:snapId},snapMediaType:1,snapUrls:{mediaUrl:'https://cf-st.sc-cdn.net/d/selected'}};
 const data={page:'/at/[username]/[snapId]',query:{username:'@djkhaled305',snapId},props:{pageProps:{showSnapExpiredToast:false,userProfile:{publicProfileInfo:{username:'djkhaled305',title:'DJ Khaled'}},story:{storyType:5,storyId:{value:'djkhaled305'},snapList:[{...selected,snapId:{value:'neighbor'}},selected]}}}};
 const encode=d=>`<script id="__NEXT_DATA__">${JSON.stringify(d)}</script>`;
 assert.equal(publicStorySnapMetadata(encode(data),url).entries.length,1);
 for(const alter of [d=>d.query.snapId='other',d=>d.props.pageProps.showSnapExpiredToast=true,d=>d.props.pageProps.story.storyType=3,d=>d.props.pageProps.story.snapList.push(selected),d=>d.props.pageProps.userProfile.publicProfileInfo.username='other']){const copy=structuredClone(data);alter(copy);assert.equal(publicStorySnapMetadata(encode(copy),url),null);}
});

test('Story HTML gets a scoped 2 MiB streaming limit, other providers retain 512 KiB',async()=>{
 const padded=' '.repeat(600000)+html(props());
 const p=await simplePayload(url,{snapchat:'card'},[],async u=>u===url?new Response(padded,{headers:{'content-type':'text/html'}}):new Response(mp4,{headers:{'content-type':'video/mp4'}}));
 assert.equal(p.files.length,10);
 let cancelled=false;
 const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(1100000));},cancel(){cancelled=true;}});
 const large=await simplePayload(url,{snapchat:'card'},[],async(u,opts)=>{assert.equal(opts.redirect,'error');assert.ok(opts.signal);return new Response(stream,{headers:{'content-type':'text/html'}});});
 assert.equal(large.files,undefined);assert.equal(cancelled,true);
 const pin='https://www.pinterest.com/pin/123/';
 const ordinary=await simplePayload(pin,{pinterest:'card'},[],async()=>new Response(' '.repeat(600000)+`<meta property="og:url" content="${pin}"><meta property="og:title" content="Must not parse"><meta property="og:image" content="https://i.pinimg.com/test.jpg">`,{headers:{'content-type':'text/html'}}));
 assert.doesNotMatch(JSON.stringify(ordinary),/Must not parse/);
});

test('Snapchat headings distinguish Spotlight from Story',async()=>{
 const {cardHeading}=await import('../../src/card-format.js');
 assert.match(cardHeading({platform:'snapchat',url:'https://www.snapchat.com/@example/spotlight/'+'A'.repeat(24)}),/Snapchat Spotlight/);
 assert.match(cardHeading({platform:'snapchat',url}),/Snapchat Story/);
});

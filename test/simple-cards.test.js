import test from 'node:test';
import assert from 'node:assert/strict';
import {simplePayload,simpleCard,metadataFromHtml,metadataFromFx,validMedia} from '../src/simple-cards.js';
import {parseSocialUrl} from '../src/previews.js';
import {readConfig} from '../src/config.js';
import {shortCaption} from '../src/instagram-card.js';
const html=body=>new Response(body,{headers:{'Content-Type':'text/html'}});
test('new routes are exact HTTPS hosts and preserve no tracking parameters',()=>{
 for(const url of ['https://medal.tv/games/roblox/clips/abc?utm_source=share','https://streamable.com/abc123','https://imgur.com/gallery/abcdefg','https://i.imgur.com/abcdefg.mp4','https://ifunny.co/video/abc123','https://vimeo.com/123456','https://giphy.com/gifs/cat-abc123','https://tenor.com/view/cat-gif-123'])assert.ok(parseSocialUrl(url),url);
 for(const url of ['https://medal.tv.evil.test/games/a/clips/b','https://medal.tv@evil.test/games/a/clips/b','https://streamable.com/account','https://imgur.com/user/name','https://i.imgur.com/../private','http://ifunny.co/video/abc'])assert.equal(parseSocialUrl(url),null,url);
 assert.equal(parseSocialUrl('https://medal.tv/games/roblox/clips/abc?utm_source=share').url,'https://medal.tv/games/roblox/clips/abc');
});
test('OG media prefers one direct video source and rejects foreign hosts',()=>{
 const metadata=metadataFromHtml('<meta property="og:video:type" content="video/mp4"><meta property="og:video" content="https://cdn-cf-east.streamable.com/video/mp4/abc.mp4"><meta property="og:video:secure_url" content="https://api-f.streamable.com/api/v1/videos/abc/mp4"><meta property="og:image" content="https://cdn-cf-east.streamable.com/image/abc.jpg">','streamable');assert.equal(metadata.media.length,1);
 for(const url of ['https://video.twimg.com.evil.test/a.mp4','https://user:password@video.twimg.com/a.mp4','http://video.twimg.com/a.mp4','https://127.0.0.1/a'])assert.equal(validMedia(url,'twitter'),false);
 assert.equal(metadataFromFx({code:200,status:{author:{protected:true}}},'twitter'),null);
});
test('custom card keeps name bold, handle plain, caption after media and Twitter text above 250 characters',()=>{
 const card=simpleCard({platform:'twitter'},{name:'Person',username:'test',media:['https://video.twimg.com/a.mp4'],caption:'a'.repeat(251)});assert.equal(card.components[0].content,'**Person** @\u200btest');assert.equal(card.components[1].type,12);assert.equal([...card.components[2].content].length,251);assert.match(card.components.at(-1).content,/via <@1557858203897823304>/);assert.equal(shortCaption('a'.repeat(251)).at(-1),'…');
});
test('unapproved helpers are never requested; native players remain intact',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('offline');};
 const payload=await simplePayload('https://twitter.com/test/status/123',readConfig({}).modes,[],fetcher);assert.equal(calls,0);assert.match(JSON.stringify(payload),/Media preview unavailable/);
 assert.equal(await simplePayload('https://youtu.be/aqz-KE-bpKQ',readConfig({}).modes,[],fetcher),null);
});
test('public Medal and Imgur metadata use the simple layout and original link once',async()=>{
 const url='https://medal.tv/games/roblox/clips/abc';let target;
 const result=await simplePayload(url,readConfig({}).modes,[],async(u,opts)=>{target=u;assert.equal(opts.redirect,'error');return html('<meta property="og:video:type" content="video/mp4"><meta property="og:video" content="https://medal.tv/api/content/abc/socialVideoUrl"><meta property="og:title" content="Good clip - Clipped Roblox with Medal.tv">');});
 assert.equal(target,url);assert.equal(result.components[0].content,url);assert.equal(result.components[1].components[1].type,12);assert.equal(result.components[1].components[0].content,'### [Good clip ↗](<https://medal.tv/games/roblox/clips/abc>)');
 const direct=await simplePayload('https://i.imgur.com/abcdefg.mp4',readConfig({}).modes,[],()=>{throw Error('must not fetch media');});assert.equal(direct.components[1].components[1].items[0].media.url,'https://i.imgur.com/abcdefg.mp4');
});
test('provider errors and oversized bodies yield an honest fallback without throwing',async()=>{
 const modes=readConfig({PROVIDER_SHARING_APPROVED:'yes'}).modes;
 for(const response of [new Response('error',{status:503}),html('x'.repeat(524289))]){const p=await simplePayload('https://twitter.com/test/status/123',modes,[],async()=>response);assert.match(JSON.stringify(p),/Media preview unavailable/);}
});

test('Medal uses its published direct CDN video instead of its redirect endpoint',()=>{
 const m=metadataFromHtml('<script type="application/ld+json">'+JSON.stringify({'@type':'VideoObject',name:'Clip',author:{name:'Person'},contentUrl:'https://cdn.medal.tv/mediac/abc.mp4?auth=public-signature'})+'</script>','medal');
 assert.equal(m.name,'Person');assert.equal(m.media[0],'https://cdn.medal.tv/mediac/abc.mp4?auth=public-signature');
});

test('Reddit author line includes subreddit below title and does not repeat as caption',()=>{
 const card=simpleCard({platform:'reddit',url:'https://www.reddit.com/r/cats/comments/abc/a_cat'},{title:'A cat',name:'Poster',caption:'A cat',media:['https://i.redd.it/cat.jpg']});
 assert.equal(card.components[0].content,'### [A cat ↗](<https://www.reddit.com/r/cats/comments/abc/a_cat>)');assert.equal(card.components[1].content,'**r/cats**');assert.equal(card.components[2].type,12);assert.equal(card.components.length,4);
});

test('Facebook photo metadata preserves identity and uses only validated thumbnails',async()=>{
 const url='https://www.facebook.com/photo?fbid=1806517487514738&set=a.638414764325022';
 assert.equal(parseSocialUrl(url).url,'https://www.facebook.com/photo.php?fbid=1806517487514738&set=a.638414764325022');
 const media='https://scontent-den2-1.xx.fbcdn.net/photo.jpg';
 const m=metadataFromHtml(`<meta property="og:image" content="${media}"><meta property="og:video:type" content="video/mp4"><meta property="og:video" content="https://scontent-den2-1.xx.fbcdn.net/video.mp4">`,'facebook');assert.deepEqual(m.media,[media]);
 for(const raw of ['https://scontent-den2-1.xx.fbcdn.net.evil.test/photo.jpg','https://evil.fbcdn.net/photo.jpg','http://scontent-den2-1.xx.fbcdn.net/photo.jpg'])assert.equal(validMedia(raw,'facebook'),false);
 assert.equal(metadataFromHtml('<meta property="og:image" content="'+media+'">Log in to continue','facebook'),null);
 const p=await simplePayload(url,readConfig({}).modes,[],async()=>html(`<meta property="og:image" content="${media}">`));assert.equal(p,null);
});

test('Twitter retains full text and places a quote in an indented block',()=>{
 const m=metadataFromFx({code:200,tweet:{text:'a'.repeat(1500),author:{name:'Person'},quote:{text:'Quoted text',url:'https://twitter.com/person/status/456',author:{name:'Quoted author',screen_name:'person'}}}},'twitter');
 const card=simpleCard({platform:'twitter'},m);assert.ok(card.components.some(c=>c.content==='a'.repeat(1500)));assert.ok(card.components.some(c=>c.content?.includes('> Quoted text')&&!c.content.includes('https://twitter.com/person/status/456')));
});
test('oversized Twitter cards preserve the original/helper route instead of truncating',async()=>{
 const p=await simplePayload('https://twitter.com/test/status/123',readConfig({PROVIDER_SHARING_APPROVED:'yes'}).modes,[],async()=>new Response(JSON.stringify({code:200,tweet:{text:'a'.repeat(6000),author:{name:'Person'}}}),{headers:{'Content-Type':'application/json'}}));assert.equal(p,null);
});

test('quoted Twitter text is capped at 250 characters while main text stays full',()=>{
 const card=simpleCard({platform:'twitter'},{caption:'m'.repeat(1200),quote:{name:'Quoted author',username:'quoted',text:'q'.repeat(251),url:'https://twitter.com/quoted/status/456'}});
 assert.ok(card.components.some(c=>c.content==='m'.repeat(1200)));
 const quote=card.components.find(c=>c.content?.includes('**Quoted author**')).content;
 assert.ok(quote.endsWith('> '+'q'.repeat(249)+'…'));
 assert.ok(!quote.includes('https://twitter.com/quoted/status/456'));
 const exact=simpleCard({platform:'twitter'},{quote:{text:'😀'.repeat(250),url:'https://twitter.com/quoted/status/456'}}).components.find(c=>c.content?.includes('Quoted post')).content;
 assert.ok(exact.includes('😀'.repeat(250)));assert.ok(!exact.includes('…'));
});

test('Reddit extracts actual helper author and renders plain handle under title',()=>{
 const m=metadataFromHtml('<meta property="og:title" content="Flock down!"><meta property="og:site_name" content="u/whiplashsaxifrage on r/GoldenCO - stats">','reddit');
 const card=simpleCard({platform:'reddit',url:'https://www.reddit.com/r/GoldenCO/comments/1wzioal/flock_down'},m);
 assert.equal(card.components[1].content,'**r/GoldenCO** u/whiplashsaxifrage');
 assert.ok(card.components[0].content.startsWith('### [Flock down! ↗]'));
});

test('Facebook reels show only requested notice and photos stay native',async()=>{
 const modes=readConfig({}).modes;let calls=0;const fetcher=async()=>{calls++;throw Error('must not fetch');};
 const p=await simplePayload('https://www.facebook.com/reel/123',modes,[],fetcher);
 assert.deepEqual(p.components[1].components,[{type:10,content:'Facebook reel preview unavailable. Open the link above to watch.'}]);
 assert.equal(await simplePayload('https://www.facebook.com/photo?fbid=123',modes,[],fetcher),null);assert.equal(calls,0);
});

test('Reddit bare video URL without media is not a caption',()=>{const m=metadataFromHtml('<meta property="og:description" content="https://v.redd.it/78lucvocveo31">','reddit');assert.equal(m.caption,'');assert.deepEqual(m.media,[]);});

test('Reddit unavailable video links to validated video page',()=>{const link={platform:'reddit',url:'https://www.reddit.com/r/aww/comments/d8d6kb/test'};const m=metadataFromHtml('<meta property="og:description" content="https://v.redd.it/78lucvocveo31">','reddit');assert.ok(simpleCard(link,m).components.some(c=>c.content==='[View video on Reddit ↗](<https://v.redd.it/78lucvocveo31>)'));assert.ok(simpleCard(link,{videoPage:'https://evil.test/'}).components.some(c=>c.content==='Media preview unavailable.'));});

test('Reddit website-only posts omit thumbnail and offer destination link',()=>{const m=metadataFromHtml('<meta property="og:description" content="https://shademap.app"><meta property="og:image" content="https://external-preview.redd.it/thumb.jpg">','reddit');assert.deepEqual(m.media,[]);const c=simpleCard({platform:'reddit',url:'https://www.reddit.com/r/test/comments/abc/post'},m);assert.ok(c.components.some(x=>x.content==='[Visit website ↗](<https://shademap.app/>)'));assert.ok(!c.components.some(x=>x.type===12||x.content==='Media preview unavailable.'));});

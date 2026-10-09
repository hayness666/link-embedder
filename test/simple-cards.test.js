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
test('custom card keeps name bold, handle plain, caption after media and 250 characters',()=>{
 const card=simpleCard({platform:'twitter'},{name:'Person',username:'test',media:['https://video.twimg.com/a.mp4'],caption:'a'.repeat(251)});assert.equal(card.components[0].content,'**Person** @\u200btest');assert.equal(card.components[1].type,12);assert.equal([...card.components[2].content].length,250);assert.match(card.components.at(-1).content,/via <@1557858203897823304>/);assert.equal(shortCaption('a'.repeat(251)).at(-1),'…');
});
test('unapproved helpers are never requested; native players remain intact',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('offline');};
 const payload=await simplePayload('https://twitter.com/test/status/123',readConfig({}).modes,[],fetcher);assert.equal(calls,0);assert.match(JSON.stringify(payload),/Media preview unavailable/);
 assert.equal(await simplePayload('https://youtu.be/aqz-KE-bpKQ',readConfig({}).modes,[],fetcher),null);
});
test('public Medal and Imgur metadata use the simple layout and original link once',async()=>{
 const url='https://medal.tv/games/roblox/clips/abc';let target;
 const result=await simplePayload(url,readConfig({}).modes,[],async(u,opts)=>{target=u;assert.equal(opts.redirect,'error');return html('<meta property="og:video:type" content="video/mp4"><meta property="og:video" content="https://medal.tv/api/content/abc/socialVideoUrl"><meta property="og:title" content="Good clip - Clipped Roblox with Medal.tv">');});
 assert.equal(target,url);assert.equal(result.components[0].content,url);assert.equal(result.components[1].components[1].type,12);assert.equal(result.components[1].components[2].content,'Good clip');
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

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
test('custom card keeps name bold, handle plain, Twitter caption before media and text above 250 characters',()=>{
 const card=simpleCard({platform:'twitter'},{name:'Person',username:'test',media:['https://video.twimg.com/a.mp4'],caption:'a'.repeat(251)});assert.equal(card.components.filter(c=>c.type!==14)[0].content,'**Person** @\u200btest');assert.equal(card.components.filter(c=>c.type!==14)[2].type,12);assert.equal([...card.components.filter(c=>c.type!==14)[1].content].length,251);assert.match(card.components.filter(c=>c.type!==14).at(-1).content,/via \[Link Embedder\]\(<https:\/\/discord\.com\/users\/1557858203897823304>\)/);assert.equal(shortCaption('a'.repeat(251)).at(-1),'…');
});
test('unapproved helpers are never requested; native players remain intact',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('offline');};
 const payload=await simplePayload('https://twitter.com/test/status/123',readConfig({}).modes,[],fetcher);assert.equal(calls,0);assert.match(JSON.stringify(payload),/Media preview unavailable/);
 const companion=await simplePayload('https://youtu.be/aqz-KE-bpKQ',readConfig({}).modes,[],fetcher);assert.equal(companion.flags,32768);assert.match(JSON.stringify(companion),/YouTube/);
});
test('public Medal and Imgur metadata use the simple layout and original link once',async()=>{
 const url='https://medal.tv/games/roblox/clips/abc';let target;
 const result=await simplePayload(url,readConfig({}).modes,[],async(u,opts)=>{target=u;assert.equal(opts.redirect,'error');return html('<meta property="og:video:type" content="video/mp4"><meta property="og:video" content="https://medal.tv/api/content/abc/socialVideoUrl"><meta property="og:title" content="Good clip - Clipped Roblox with Medal.tv">');});
 assert.equal(target,url);assert.equal(result.components[0].content,url);assert.equal(result.components[1].components.filter(c=>c.type!==14)[1].type,12);assert.equal(result.components[1].components.filter(c=>c.type!==14)[0].content,'**[Good clip](<https://medal.tv/games/roblox/clips/abc>)**');
 const direct=await simplePayload('https://i.imgur.com/abcdefg.mp4',readConfig({}).modes,[],()=>{throw Error('must not fetch media');});assert.equal(direct.components[1].components.filter(c=>c.type!==14)[1].items[0].media.url,'https://i.imgur.com/abcdefg.mp4');
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
 assert.equal(card.components.filter(c=>c.type!==14)[0].content,'**[A cat](<https://www.reddit.com/r/cats/comments/abc/a_cat>)**');assert.equal(card.components.filter(c=>c.type!==14)[1].content,'**r/cats**');assert.equal(card.components.filter(c=>c.type!==14)[2].type,12);assert.equal(card.components.filter(c=>c.type!==14).length,4);
});

test('Facebook photo metadata preserves identity and uses only validated thumbnails',async()=>{
 const url='https://www.facebook.com/photo?fbid=1806517487514738&set=a.638414764325022';
 assert.equal(parseSocialUrl(url).url,'https://www.facebook.com/photo.php?fbid=1806517487514738');
 const media='https://scontent-den2-1.xx.fbcdn.net/photo.jpg';
 const m=metadataFromHtml(`<meta property="og:image" content="${media}"><meta property="og:video:type" content="video/mp4"><meta property="og:video" content="https://scontent-den2-1.xx.fbcdn.net/video.mp4">`,'facebook');assert.deepEqual(m.media,[media]);
 for(const raw of ['https://scontent-den2-1.xx.fbcdn.net.evil.test/photo.jpg','https://evil.fbcdn.net/photo.jpg','http://scontent-den2-1.xx.fbcdn.net/photo.jpg'])assert.equal(validMedia(raw,'facebook'),false);
 assert.equal(metadataFromHtml('<meta property="og:image" content="'+media+'">Log in to continue','facebook'),null);
 const p=await simplePayload(url,readConfig({}).modes,[],async()=>html(`<meta property="og:image" content="${media}">`));assert.equal(p,null);
});

test('Twitter retains full text and places a quote in an indented block',()=>{
 const m=metadataFromFx({code:200,tweet:{text:'a'.repeat(1500),author:{name:'Person'},quote:{text:'Quoted text',url:'https://twitter.com/person/status/456',author:{name:'Quoted author',screen_name:'person'}}}},'twitter');
 const card=simpleCard({platform:'twitter'},m);assert.ok(card.components.filter(c=>c.type!==14).some(c=>c.content==='a'.repeat(1500)));assert.ok(card.components.filter(c=>c.type!==14).some(c=>c.content?.includes('> Quoted text')&&!c.content.includes('https://twitter.com/person/status/456')));
});
test('oversized Twitter cards preserve the original/helper route instead of truncating',async()=>{
 const p=await simplePayload('https://twitter.com/test/status/123',readConfig({PROVIDER_SHARING_APPROVED:'yes'}).modes,[],async()=>new Response(JSON.stringify({code:200,tweet:{text:'a'.repeat(6000),author:{name:'Person'}}}),{headers:{'Content-Type':'application/json'}}));assert.equal(p,null);
});

test('quoted Twitter text is capped at 250 characters while main text stays full',()=>{
 const card=simpleCard({platform:'twitter'},{caption:'m'.repeat(1200),quote:{name:'Quoted author',username:'quoted',text:'q'.repeat(251),url:'https://twitter.com/quoted/status/456'}});
 assert.ok(card.components.filter(c=>c.type!==14).some(c=>c.content==='m'.repeat(1200)));
 const quote=card.components.filter(c=>c.type!==14).find(c=>c.content?.includes('**Quoted author**')).content;
 assert.ok(quote.endsWith('> '+'q'.repeat(249)+'…'));
 assert.ok(!quote.includes('https://twitter.com/quoted/status/456'));
 const exact=simpleCard({platform:'twitter'},{quote:{text:'😀'.repeat(250),url:'https://twitter.com/quoted/status/456'}}).components.find(c=>c.content?.includes('Quoted post')).content;
 assert.ok(exact.includes('😀'.repeat(250)));assert.ok(!exact.includes('…'));
});

test('Reddit extracts actual helper author and renders plain handle under title',()=>{
 const m=metadataFromHtml('<meta property="og:title" content="Flock down!"><meta property="og:site_name" content="u/whiplashsaxifrage on r/GoldenCO - stats">','reddit');
 const card=simpleCard({platform:'reddit',url:'https://www.reddit.com/r/GoldenCO/comments/1wzioal/flock_down'},m);
 assert.equal(card.components.filter(c=>c.type!==14)[1].content,'**r/GoldenCO** u/whiplashsaxifrage');
 assert.ok(card.components.filter(c=>c.type!==14)[0].content.startsWith('**[Flock down!]'));
});

test('Facebook reels show only requested notice and photos stay native',async()=>{
 const modes=readConfig({}).modes;let calls=0;const fetcher=async()=>{calls++;throw Error('must not fetch');};
 const p=await simplePayload('https://www.facebook.com/reel/123',modes,[],fetcher);
 assert.deepEqual(p.components[1].components.filter(c=>c.type!==14),[{type:10,content:'Reel preview unavailable.'}]);
 assert.equal(await simplePayload('https://www.facebook.com/photo?fbid=123',modes,[],fetcher),null);assert.equal(calls,0);
});

test('Reddit bare video URL without media is not a caption',()=>{const m=metadataFromHtml('<meta property="og:description" content="https://v.redd.it/78lucvocveo31">','reddit');assert.equal(m.caption,'');assert.deepEqual(m.media,[]);});

test('Reddit unavailable video links to validated video page',()=>{const link={platform:'reddit',url:'https://www.reddit.com/r/aww/comments/d8d6kb/test'};const m=metadataFromHtml('<meta property="og:description" content="https://v.redd.it/78lucvocveo31">','reddit');assert.ok(simpleCard(link,m).components.some(c=>c.content==='[View video on Reddit ↗](<https://v.redd.it/78lucvocveo31>)'));assert.ok(simpleCard(link,{videoPage:'https://evil.test/'}).components.some(c=>c.content==='Media preview unavailable.'));});

test('Reddit website-only posts omit thumbnail and offer destination link',()=>{const m=metadataFromHtml('<meta property="og:description" content="https://shademap.app"><meta property="og:image" content="https://external-preview.redd.it/thumb.jpg">','reddit');assert.deepEqual(m.media,[]);const c=simpleCard({platform:'reddit',url:'https://www.reddit.com/r/test/comments/abc/post'},m);assert.ok(c.components.some(x=>x.content==='<https://shademap.app/>'));assert.ok(!c.components.some(x=>x.type===12||x.content==='Media preview unavailable.'));});

test('all native families receive a custom card without inventing media',async()=>{for(const url of ['https://www.amazon.com/dp/B07812QWNH','https://www.youtube.com/watch?v=aqz-KE-bpKQ','https://vimeo.com/123456','https://ifunny.co/picture/test123','https://giphy.com/gifs/test123','https://tenor.com/view/test123']){const p=await simplePayload(url,readConfig({}).modes,[],async()=>new Response('',{status:403}));assert.equal(p.flags,32768,url);assert.ok(p.components[1].components.filter(c=>c.type!==14).some(c=>c.content?.startsWith('**[')),url);assert.ok(!p.components[1].components.filter(c=>c.type!==14).some(c=>c.type===12),url);}});
test('YouTube companion uses official author and title without extracting player HTML',async()=>{const p=await simplePayload('https://www.youtube.com/watch?v=aqz-KE-bpKQ',readConfig({}).modes,[],async(url,options)=>{assert.ok(url.startsWith('https://www.youtube.com/oembed?'));assert.equal(options.redirect,'error');return new Response(JSON.stringify({title:'Film',author_name:'Channel',author_url:'https://www.youtube.com/@channel',html:'<iframe>untrusted</iframe>'}),{headers:{'content-type':'application/json'}});});const s=JSON.stringify(p);assert.match(s,/Film/);assert.match(s,/Channel/);assert.ok(!s.includes('iframe'));assert.ok(!p.components[1].components.filter(c=>c.type!==14).some(c=>c.type===12));});

test('custom layout has a bold linked title without arrows, title spacing and one footer divider',()=>{
 const c=simpleCard({platform:'reddit',url:'https://www.reddit.com/r/test/comments/abc/post'},{title:'Real title',caption:'Caption'});
 assert.equal(c.components[0].content,'**[Real title](<https://www.reddit.com/r/test/comments/abc/post>)**');
 assert.deepEqual(c.components[1],{type:14,divider:false,spacing:1});
 assert.deepEqual(c.components.at(-2),{type:14,divider:true,spacing:1});
 assert.equal(c.components.filter(x=>x.type===14&&x.divider).length,1);
});

test('Amazon reuses matching native product title and image for its custom repost',async()=>{
 const url='https://www.amazon.com/dp/B07812QWNH';
 const p=await simplePayload(url,readConfig({}).modes,[{url,title:'Product name',thumbnail:{url:'https://m.media-amazon.com/images/I/product.jpg'}}],async()=>new Response('',{status:403}));
 const c=p.components[1];assert.match(c.components[0].content,/Product name/);assert.equal(c.components.find(x=>x.type===12).items[0].media.url,'https://m.media-amazon.com/images/I/product.jpg');
});

test('Twitter uses Post on Twitter and orders main text, media, then quote',()=>{
 const card=simpleCard({platform:'twitter',url:'https://twitter.com/person/status/123'}, {caption:'Main post',media:['https://video.twimg.com/a.mp4'],quote:{text:'Quoted post body',url:'https://twitter.com/person/status/456'}});
 assert.match(card.components[0].content,/Post on Twitter/);
 const main=card.components.findIndex(c=>c.content==='Main post');
 const media=card.components.findIndex(c=>c.type===12);
 const quote=card.components.findIndex(c=>c.content?.includes('Quoted post body'));
 assert.ok(main < media && media < quote);
});

test('Twitter Space links from public post metadata get a safe linked section',()=>{
 const data={code:200,status:{text:'Coming up https://x.com/i/spaces/1MnxnMDeQLeJO',media:{}}};
 const metadata=metadataFromFx(data,'twitter');
 assert.deepEqual(metadata.spaces,['https://twitter.com/i/spaces/1MnxnMDeQLeJO']);
 const card=simpleCard({platform:'twitter',url:'https://twitter.com/XSpaces/status/1805728835285270781'},metadata);
 assert.ok(card.components.some(c=>c.content?.includes('**[Twitter Space](<https://twitter.com/i/spaces/1MnxnMDeQLeJO>)**')));
 for(const url of ['https://x.com.evil.test/i/spaces/1MnxnMDeQLeJO','https://user@x.com/i/spaces/1MnxnMDeQLeJO','http://x.com/i/spaces/1MnxnMDeQLeJO']) {
  const bad=metadataFromFx({code:200,status:{text:url}},'twitter'); assert.deepEqual(bad.spaces,[]);
 }
});

test('direct Spaces links use a formatted card without calling the post endpoint',async()=>{
 const url='https://twitter.com/i/spaces/1MnxnMDeQLeJO';
 assert.equal(parseSocialUrl('https://x.com/i/spaces/1MnxnMDeQLeJO?utm_source=share').url,url);
 assert.equal(parseSocialUrl(url).kind,'space');
 for(const bad of ['https://x.com.evil.test/i/spaces/1MnxnMDeQLeJO','https://x.com/i/spaces/short','https://x.com/i/spaces/1MnxnMDeQLeJO/extra']) assert.equal(parseSocialUrl(bad),null);
 const modes=readConfig({PROVIDER_SHARING_APPROVED:'yes'}).modes;
 const payload=await simplePayload(url,modes,[],async()=>{throw new Error('Must not fetch a Space through the post endpoint');});
 const card=payload.components[1];
 assert.match(card.components[0].content,/Twitter Space/);
 assert.ok(card.components.some(c=>c.content===`[Open Space](<${url}>)`));
 assert.ok(!JSON.stringify(card).includes('Audio playback is not available'));
 assert.ok(!JSON.stringify(card).includes('Media preview unavailable')); 
 assert.ok(card.components.some(c=>c.type===14&&c.divider));
 assert.equal(card.components.some(c=>c.type===12),false);
 const named=await simplePayload(url,modes,[{url,title:'Public discussion',author:{name:'Host'}}]);
 assert.match(named.components[1].components[0].content,/Public discussion/);
});

test('Twitter Lists and Communities get safe resource cards without post API requests',async()=>{
 const modes=readConfig({PROVIDER_SHARING_APPROVED:'yes'}).modes;
 for(const [route,kind,label] of [['lists','list','Twitter List'],['communities','community','Twitter Community']]) {
  const url=`https://twitter.com/i/${route}/123456789`;
  assert.deepEqual(parseSocialUrl(`https://x.com/i/${route}/123456789?utm_source=share`),{platform:'twitter',kind,url});
  for(const bad of [`https://x.com.evil.test/i/${route}/123`,`https://x.com/i/${route}/not-an-id`,`https://x.com/i/${route}/123/members`]) assert.equal(parseSocialUrl(bad),null);
  let calls=0;
  const payload=await simplePayload(url,modes,[],async()=>{calls++;throw new Error('No post lookup');});
  assert.equal(calls,0);
  const card=payload.components[1];
  assert.ok(card.components[0].content.includes(label));
  assert.ok(card.components.some(c=>c.content?.includes('login or membership')));
  assert.ok(card.components.some(c=>c.type===14&&c.divider));
  const named=await simplePayload(url,modes,[{url,title:'Real public title'}]);
  assert.match(named.components[1].components[0].content,/Real public title/);
  const unrelated=await simplePayload(url,modes,[{url:'https://twitter.com/i/lists/999',title:'Unrelated'}]);
  assert.ok(!unrelated.components[1].components[0].content.includes('Unrelated'));
 }
});

test('Netflix cards reuse matching public metadata without fetching playback',async()=>{
 const url='https://www.netflix.com/watch/26797528';
 assert.equal(parseSocialUrl(url+'?trackId=264104230&tctx=tracking').url,url);
 assert.equal(readConfig({}).modes.netflix,'card');
 assert.equal(parseSocialUrl('https://www.netflix.com.evil.test/watch/26797528'),null);
 const image='https://occ-0-116-114.1.nflxso.net/test.jpg';
 const payload=await simplePayload(url,readConfig({}).modes,[{url,title:'Verified title',description:'Public description',image:{url:image}}],async()=>{throw new Error('No playback fetch');});
 assert.match(payload.components[1].components[0].content,/Verified title/);
 assert.equal(payload.components[1].components.find(c=>c.type===12).items[0].media.url,image);
 assert.equal(validMedia('https://occ-0-116-114.1.nflxso.net.evil.test/test.jpg','netflix'),false);
});

test('Prime Video storefront and detail cards use matching metadata without playback requests',async()=>{
 const url='https://www.primevideo.com/region/na/storefront/merch/IncludedwithPrime';
 assert.equal(parseSocialUrl(url+'?xdsso=1&ref_=atv_auth_red_aft').url,url);
 assert.equal(parseSocialUrl('https://www.primevideo.com/detail/B012345678').kind,'title');
 assert.equal(parseSocialUrl('https://www.primevideo.com.evil.test/detail/B012345678'),null);
 assert.equal(parseSocialUrl('https://www.primevideo.com/account'),null);
 const payload=await simplePayload(url,readConfig({}).modes,[],async()=>{throw new Error('No playback request');});
 assert.match(payload.components[1].components[0].content,/Prime Video Storefront/);
 assert.equal(payload.components[1].accent_color,0x00a8e1);
 const named=await simplePayload(url,readConfig({}).modes,[{url,title:'Included with Prime',image:{url:'https://m.media-amazon.com/images/test.jpg'}}]);
 assert.match(named.components[1].components[0].content,/Included with Prime/);
 assert.equal(named.components[1].components.find(c=>c.type===12).items.length,1);
});


test('social text cards share Twitter ordering, full main text and capped quotes', () => {
 for (const [platform,url,media] of [
  ['threads','https://www.threads.com/@meta/post/ABC','https://scontent-test.xx.fbcdn.net/photo.jpg'],
  ['bluesky','https://bsky.app/profile/example.com/post/abc','https://cdn.bsky.app/photo.jpg'],
  ['mastodon','https://mastodon.social/@example/123',null]
 ]) {
  const card=simpleCard({platform,url},{name:'Author',username:'author',caption:'m'.repeat(300),media:media?[media]:[],quote:{name:'Quote',text:'q'.repeat(300),url}});
  const body=card.components.findIndex(c=>c.content==='m'.repeat(300));
  assert.ok(body>=0);
  if(media) assert.ok(body<card.components.findIndex(c=>c.type===12));
  const quote=card.components.findIndex(c=>c.content?.startsWith('> **Quote**'));
  assert.ok(quote>body);assert.ok(card.components[quote].content.includes('…'));
 }
});
test('Threads unavailable card matches Facebook photo fallback structure',()=>{
 const threads=simpleCard({platform:'threads',url:'https://www.threads.com/@meta/post/ABC'});
 const facebook=simpleCard({platform:'facebook',kind:'photo',url:'https://www.facebook.com/photo?fbid=123'});
 assert.deepEqual(threads.components.map(c=>c.type),facebook.components.map(c=>c.type));
 assert.ok(threads.components.some(c=>c.content==='Media preview unavailable.'));
});


test('Prime Video public title metadata requires matching canonical identity',async()=>{
 const url='https://www.primevideo.com/region/na/detail/0OBDS97ED82GWIQB4ICY88JTFF';
 const body='<title>Prime Video: Ruby Sparks</title><link rel="canonical" href="https://www.primevideo.com/detail/0OBDS97ED82GWIQB4ICY88JTFF"><meta name="description" content="A public synopsis"><meta property="og:image" content="https://m.media-amazon.com/images/poster.jpg">';
 const payload=await simplePayload(url,readConfig({}).modes,[],async(request,options)=>{assert.equal(request,url);assert.equal(options.redirect,'error');return html(body);});
 assert.ok(JSON.stringify(payload).includes('Ruby Sparks'));
 assert.ok(JSON.stringify(payload).includes('poster.jpg'));
 assert.equal(metadataFromHtml(body,'primevideo','https://www.primevideo.com/detail/AAAAAAAAAA'),null);
 const fallback=await simplePayload(url,readConfig({}).modes,[],async()=>{throw Error('unavailable');});
 assert.ok(JSON.stringify(fallback).includes('View on Prime Video'));
});

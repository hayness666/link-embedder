import test from 'node:test';import assert from 'node:assert/strict';
import {createFacebedFacebookPreview as factory,facebedFacebookMetadata} from '../../src/providers/facebook-facebed-preview.js';
const createFacebedFacebookPreview=options=>factory({authorLookup:async()=>'',...options});
const photo='https://www.facebook.com/photo?fbid=1806517487514738',video='https://www.facebook.com/nasaearth/videos/lake/851551656699438',post='https://www.facebook.com/NASA/posts/look-up/1116021799893195';
const image='https://scontent.fhan5-8.fna.fbcdn.net/v/t39/photo.jpg?signature=keep',mp4='https://video.fhan5-2.fna.fbcdn.net/o1/v/t2/sample.mp4?signature=keep';
const html=(url,name,media,caption='Caption')=>`<meta property="og:url" content="${url}"><meta property="og:title" content="${name}"><meta property="og:description" content="${caption}">${media}`;
const p=html(photo,'This is a Clue',`<meta property="og:image" content="${image}">`),v=html('https://www.facebook.com/reel/851551656699438/','NASA Earth',`<meta property="og:video:type" content="video/mp4"><meta property="og:video" content="${mp4}">`),s=html('https://www.facebook.com/NASA/posts/1116021799893195','NASA',`<meta property="og:image" content="${image}">`,'Look up! https://spotthestation.nasa.gov/');
const res=t=>new Response(t,{headers:{'content-type':'text/html'}});
test('Facebed expanded sharing is disabled without exact source approval',async()=>{let calls=0;const fetcher=async()=>{calls++;return res(p);};assert.equal(await createFacebedFacebookPreview({fetcher})(photo),null);assert.equal(await createFacebedFacebookPreview({allowedSources:[post],fetcher})(photo),null);assert.equal(calls,0);});
test('observed photo/video/post aliases match exact IDs and do not invent missing handles',()=>{assert.equal(facebedFacebookMetadata(photo,p).handle,'');assert.equal(facebedFacebookMetadata(video,v).handle,'');assert.equal(facebedFacebookMetadata(post,s).handle,'NASA');assert.equal(facebedFacebookMetadata(photo,p.replace('1806517487514738','999')),null);assert.equal(facebedFacebookMetadata(post,s.replace('www.facebook.com','evil.test')),null);assert.equal(facebedFacebookMetadata(photo,p.replace(image,'https://evil.test/photo.jpg')),null);assert.equal(facebedFacebookMetadata(video,v.replace('video/mp4','text/html')),null);assert.equal(facebedFacebookMetadata(photo,p.replace('This is a Clue','Log in or sign up')),null);});
test('photo and link-post cards share image layout, separate authors and captions, and clickable source URLs',async()=>{for(const [url,body]of [[photo,p],[post,s]]){let calls=0;const payload=await createFacebedFacebookPreview({allowedSources:[url],fetcher:async(u,o)=>{calls++;assert.equal(new URL(u).hostname,'www.facebed.com');assert.equal(o.redirect,'error');return res(body);}})(url);assert.equal(calls,1);const c=payload.components[1].components;assert.ok(c.some(x=>x.type===12));assert.ok(c.some(x=>x.type===10&&x.content.startsWith('**')));assert.ok(!JSON.stringify(c).includes('Posted by'));if(url===post)assert.match(JSON.stringify(c),/<https:\/\/spotthestation.nasa.gov\/>/);}});
test('video card attaches validated MP4 and never calls original Facebook',async()=>{const bytes=Buffer.concat([Buffer.from([0,0,0,16]),Buffer.from('ftypisom0000')]);const calls=[];const payload=await createFacebedFacebookPreview({allowedSources:[video],fetcher:async(u,o)=>{calls.push(u);assert.equal(o.redirect,'error');return u.startsWith('https://www.facebed.com')?res(v):new Response(bytes,{headers:{'content-type':'video/mp4'}});}})(video);assert.equal(payload.files[0].name,'facebook-video.mp4');assert.ok(calls.every(u=>!u.startsWith('https://www.facebook.com')));assert.match(JSON.stringify(payload.components),/attachment:\/\/facebook-video.mp4/);});
test('redirects, oversized bodies, missing media, and CDN failures return null for original preservation',async()=>{for(const fetcher of [async()=>new Response(null,{status:302,headers:{location:'https://www.facebook.com/login'}}),async()=>new Response('x',{headers:{'content-type':'text/html','content-length':'524289'}}),async()=>res(p.replace('og:image','unused')),async()=>{throw Error('network');}])assert.equal(await createFacebedFacebookPreview({allowedSources:[photo],fetcher})(photo),null);
assert.equal(await createFacebedFacebookPreview({allowedSources:[video],fetcher:async u=>u.startsWith('https://www.facebed.com')?res(v):new Response(null,{status:403})})(video),null);});
test('existing handler integration reposts a useful approved card and preserves original on helper failure',async()=>{
 const {createHandler}=await import('../../src/handler.js');const {readConfig}=await import('../../src/config.js');
 for(const success of [true,false]){let sent=0;const preview=createFacebedFacebookPreview({allowedSources:[photo],fetcher:async()=>success?res(p):new Response(null,{status:403})});const handler=createHandler(readConfig({PROVIDER_SHARING_APPROVED:'yes',REPOST_AS_AUTHOR:'yes'}),{facebookPublicKinds:[],facebookPublicSources:[],canSend:()=>true,nativeFacebook:m=>preview(m.content),repost:async()=>sent++});await handler({id:'test',guildId:'1',channelId:'2',author:{bot:false},flags:{has:()=>false},content:photo,embeds:[]});assert.equal(sent,success?1:0);}
});
test('approved format sharing accepts new public IDs but excludes groups, stories, profiles, and unsafe hosts',async()=>{
 let requests=0;const preview=createFacebedFacebookPreview({allowedKinds:['photo','video','post'],fetcher:async()=>{requests++;return new Response(null,{status:403});}});
 for(const u of ['https://www.facebook.com/photo?fbid=222','https://www.facebook.com/NASA/videos/333','https://www.facebook.com/NASA/posts/pfbidABC123','https://www.facebook.com/permalink.php?story_fbid=444&id=555'])await preview(u);assert.equal(requests,4);
 for(const u of ['https://www.facebook.com/groups/123/posts/456','https://www.facebook.com/stories/123/456','https://www.facebook.com/NASA','https://www.facebook.com/login','https://www.facebook.com.evil.test/NASA/posts/123','http://www.facebook.com/NASA/posts/123','https://127.0.0.1/NASA/posts/123','https://www.facebook.com/reel/123'])await preview(u);assert.equal(requests,4);
 assert.throws(()=>createFacebedFacebookPreview({allowedKinds:['group']}));
});
test('pfbid post identity must match exactly and never guesses a numeric alias',()=>{const url='https://www.facebook.com/NASA/posts/pfbidABC123';const body=html(url,'NASA',`<meta property="og:image" content="${image}">`);assert.ok(facebedFacebookMetadata(url,body));assert.equal(facebedFacebookMetadata(url,body.replace('pfbidABC123','123')),null);});

test('Facebook display, helper, heading, and caption targets remove optional tracking while preserving identity and signed media',async()=>{
 const {cleanFacebookPhotoSets}=await import('../../src/providers/facebook.js');
 const {sourceText}=await import('../../src/card-format.js');
 const variants=[
 ['https://m.facebook.com/photo?fbid=1806517487514738&set=abc&UTM_SOURCE=qa&fbclid=x&ref=share#decoration','https://www.facebook.com/photo.php?fbid=1806517487514738'],
 ['https://m.facebook.com/NASA/posts/1116021799893195?utm_campaign=qa&unknown=decoration','https://www.facebook.com/NASA/posts/1116021799893195'],
 ['https://m.facebook.com/watch?v=851551656699438&ref=sharing','https://www.facebook.com/watch?v=851551656699438'],
 ['https://m.facebook.com/story.php?story_fbid=444&id=555&fbclid=x','https://www.facebook.com/story.php?story_fbid=444&id=555']
 ];
 for(const [raw,clean]of variants){assert.equal(cleanFacebookPhotoSets(`Before ${raw}. After`),`Before ${clean}. After`);assert.equal(sourceText(raw),`<${clean}>`);}
 const [raw,clean]=variants[0];let helper;
 const body=html(photo,'This is a Clue',`<meta property="og:image" content="${image}">`,'Read https://example.org/page?UTM_SOURCE=qa&fbclid=x&item=42');
 const payload=await createFacebedFacebookPreview({allowedKinds:['photo'],fetcher:async u=>{helper=u;return res(body);}})(`Before ${raw}. After`);
 assert.equal(helper,'https://www.facebed.com/photo.php?fbid=1806517487514738');
 assert.equal(payload.components[0].content,`Before ${clean}. After`);
 assert.ok(JSON.stringify(payload.components[1]).includes(clean));
 assert.ok(JSON.stringify(payload).includes('<https://example.org/page?item=42>'));
 assert.ok(JSON.stringify(payload).includes(image));
 assert.equal(sourceText('https://example.org/media?signature=keep&utm_source=signed'),'<https://example.org/media?signature=keep&utm_source=signed>');
});

test('substantive text-only posts render without empty media; blank and login shells remain untouched',async()=>{
 const url='https://www.facebook.com/richardcheese/posts/1682102129948925';
 const caption='Thanks to everyone who clicked Like on my previous test post (now deleted).';
 const make=body=>createFacebedFacebookPreview({allowedKinds:['post'],fetcher:async()=>res(body)})(url);
 const payload=await make(html(url,'Richard Cheese','',caption));
 const parts=payload.components[1].components;
 assert.ok(!parts.some(x=>x.type===12));
 assert.ok(parts.some(x=>x.content?.includes('Richard Cheese')&&x.content.includes('richardcheese')));
 assert.ok(parts.some(x=>x.content===caption));
 for(const text of ['', '  ', 'Log in to Facebook', 'Content is not available', 'See posts, photos and more on Facebook'])assert.equal(await make(html(url,'Richard Cheese','',text)),null);
 assert.equal(await make(html(url,'Richard Cheese','<meta property="og:image" content="https://evil.test/a.jpg">',caption)),null);
 assert.equal(await make(html(url.replace('1682102129948925','999'),'Richard Cheese','',caption)),null);
});
test('post text precedes its image while photo captions remain below; both use 300 Unicode code points',async()=>{
 for(const [url,name]of [[post,'NASA'],[photo,'This is a Clue']]){
 const payload=await createFacebedFacebookPreview({allowedKinds:['post','photo'],fetcher:async()=>res(html(url,name,`<meta property="og:image" content="${image}">`,'😀'.repeat(301)))})(url);
 const c=payload.components[1].components,media=c.findIndex(x=>x.type===12),caption=c.findIndex(x=>x.content==='😀'.repeat(300)+'…');
 assert.ok(caption>=0);assert.ok(url===post?caption<media:caption>media);
 assert.equal(c.filter(x=>x.type===14&&x.divider).length,1);
 }
});

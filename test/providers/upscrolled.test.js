import test from 'node:test';
import assert from 'node:assert/strict';
import {upscrolledUrl,upscrolledMetadata,fetchUpscrolled,upscrolledImage} from '../../src/providers/upscrolled.js';
import {parseSocialUrl} from '../../src/previews.js';
import {simplePayload} from '../../src/simple-cards.js';
import {cleanCardLinks} from '../../src/repost.js';
const id='5ec53de0-fd6e-11f0-8080-8001278c05c2',url=`https://upscrolled.com/@MelTheVCL/${id}`,share=`https://share.upscrolled.com/en/post/${id}`;
function post(){return {id,verb:'POST',actor:{id:'author',data:{Name:'Mel',Handle:'MelTheVCL',IsPrivate:false,IsActive:true}},object:{id,collection:'POST',data:{publisherId:'author',sensitiveContent:false,postType:'TEXT',caption:'Main text\n- signature',postsAttachment:[]}}};}
const html=p=>`<script>self.__next_f.push([1,${JSON.stringify('1:'+JSON.stringify({children:p})+'\n')}])</script>`;
const response=p=>new Response(html(p),{headers:{'content-type':'text/html'}});
test('UpScrolled canonical and share routes retain identity and discard decoration',()=>{
 for(const raw of [url,share]){assert.equal(parseSocialUrl(raw+'?utm_source=qa&foo=x#tracking').platform,'upscrolled');assert.equal(cleanCardLinks(raw+'?foo=x#tracking'),raw);}
 for(const raw of [url.replace('upscrolled.com','upscrolled.com.evil.test'),url.replace('/@','/profile/'),'https://upscrolled.com/@MelTheVCL'])assert.equal(upscrolledUrl(raw),null);
});
test('public structured metadata binds exact post and author and rejects private or sensitive data',()=>{
 assert.equal(upscrolledMetadata(html(post()),url).name,'Mel');
 for(const mutate of [p=>p.actor.data.IsPrivate=true,p=>p.object.data.sensitiveContent=true,p=>p.actor.data.Handle='other',p=>p.object.id='wrong',p=>p.object.data.publisherId='wrong',p=>p.verb='REPOST']){const p=post();mutate(p);assert.equal(upscrolledMetadata(html(p),url),null);}
 assert.equal(upscrolledMetadata('<html>Sign in</html>',url),null);
 assert.equal(upscrolledMetadata('x'.repeat(524289),url),null);
});
test('share fetch permits one exact-site same-ID redirect and refuses chains or unrelated destinations',async()=>{
 const calls=[];assert.equal((await fetchUpscrolled(share,async(u,o)=>{calls.push([u,o.redirect]);return calls.length===1?new Response(null,{status:302,headers:{location:url}}):response(post());})).username,'MelTheVCL');
 assert.deepEqual(calls,[[share,'manual'],[url,'error']]);
 for(const target of ['https://evil.test/'+id,url.replace(id,'00000000-0000-0000-0000-000000000000'),share])assert.equal(await fetchUpscrolled(share,async()=>new Response(null,{status:302,headers:{location:target}})),null);
 assert.equal(await fetchUpscrolled(url,async()=>new Response(null,{status:302,headers:{location:url}})),null);
});
test('video metadata exposes only a validated poster, never an invented MP4',()=>{
 const p=post();p.object.data.postType='VIDEO';p.object.data.postsAttachment=[{videoThumbnailUrl:'https://image.prod-ext.video.upscrolled.com/Abc123/thumbnail.jpg',videoHlsUrl:'https://stream.prod-ext.video.upscrolled.com/Abc123.m3u8'}];
 const m=upscrolledMetadata(html(p),url);assert.equal(m.externalVideoUrl,url);assert.equal(m.media.length,1);assert.ok(!m.media.some(u=>u.includes('m3u8')));
 assert.equal(upscrolledImage('https://uploads.video.upscrolled.com.evil.test/image.jpg'),false);
});
test('full custom card uses Twitter-style full text, both author names, icon, and shared separators',async()=>{
 const p=post();p.object.data.caption='Long text '.repeat(40)+'\n- attribution';
 const payload=await simplePayload(url,{upscrolled:'card'},[],async()=>response(p));
 const card=payload.components.find(c=>c.type===17);const text=card.components.map(c=>c.content||'').join('\n');
 assert.ok(text.includes('**Mel** @\u200bMelTheVCL'));assert.ok(text.includes('Long text '.repeat(40)));assert.ok(text.includes('\\- attribution'));assert.ok(text.includes('1558173239589478440'));
 assert.deepEqual(card.components.filter(c=>c.type===14).map(c=>[c.divider,c.spacing]),[[true,1]]);
});

test('UpScrolled video cards omit the extra CTA while retaining their linked heading and poster',async()=>{
 const p=post();p.object.data.postType='VIDEO';p.object.data.postsAttachment=[{videoThumbnailUrl:'https://image.prod-ext.video.upscrolled.com/Abc123/thumbnail.jpg'}];
 const payload=await simplePayload(url,{upscrolled:'card'},[],async()=>response(p));
 const card=payload.components.find(c=>c.type===17);const text=card.components.map(c=>c.content||'').join('\n');
 assert.ok(!text.includes('Watch Video'));assert.ok(!text.includes('playback is available'));
 assert.ok(text.includes(url));assert.ok(card.components.some(c=>c.type===12));assert.ok(text.includes('1558173239589478440'));
});

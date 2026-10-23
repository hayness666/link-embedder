const uuid = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
export function upscrolledUrl(raw) {
 try {
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.port||raw.length>2048)return null;
  const share=u.hostname==='share.upscrolled.com' && new RegExp(`^/en/post/(${uuid})/?$`,'i').exec(u.pathname);
  const post=u.hostname==='upscrolled.com' && new RegExp(`^/(?:@|%40)([A-Za-z0-9_]{1,50})/(${uuid})/?$`,'i').exec(u.pathname);
  if(share)return {id:share[1].toLowerCase(),url:`https://share.upscrolled.com/en/post/${share[1].toLowerCase()}`,share:true};
  if(post)return {id:post[2].toLowerCase(),handle:post[1],url:`https://upscrolled.com/@${post[1]}/${post[2].toLowerCase()}`,share:false};
 }catch{}
 return null;
}
export function upscrolledImage(raw) {
 try {const u=new URL(raw);return raw.length<=2048 && u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash &&
 ((u.hostname==='uploads.video.upscrolled.com' && /^\/[0-9a-f-]{36}\/Image_[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(u.pathname)) ||
 (u.hostname==='image.prod-ext.video.upscrolled.com' && /^\/[A-Za-z0-9]+\/thumbnail\.jpg$/.test(u.pathname)));}catch{return false;}
}
export function upscrolledMetadata(html, expectedUrl) {
 const expected=upscrolledUrl(expectedUrl);
 if(!expected||expected.share||Buffer.byteLength(html)>524288)return null;
 let flight='';
 try {
  for(const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g))flight+=JSON.parse(m[1]);
  const posts=[];let count=0;
  function visit(value,depth=0){
   if(++count>20000||depth>40)throw new Error('bound');
   if(!value||typeof value!=='object')return;
   if(!Array.isArray(value)&&value.id===expected.id&&value.actor&&value.object){posts.push(value);return;}
   for(const v of Object.values(value))visit(v,depth+1);
  }
  for(const line of flight.split('\n')){const json=line.slice(line.indexOf(':')+1);if(!/^[\[{]/.test(json))continue;try{visit(JSON.parse(json));}catch(e){if(e.message==='bound')return null;}}
  if(posts.length!==1)return null;
  const post=posts[0],author=post.actor.data,data=post.object.data;
  if(post.verb!=='POST'||post.object.id!==expected.id||post.object.collection!=='POST'||author.IsPrivate!==false||author.IsActive!==true||data.sensitiveContent!==false||author.Handle?.toLowerCase()!==expected.handle.toLowerCase()||data.publisherId!==post.actor.id||typeof author.Name!=='string'||typeof data.caption!=='string')return null;
  if(!['TEXT','IMAGE','VIDEO'].includes(data.postType))return null;
  const attachments=Array.isArray(data.postsAttachment)?data.postsAttachment:[];
  const media=attachments.map(a=>data.postType==='VIDEO'?a.videoThumbnailUrl:a.attachment).filter(upscrolledImage).slice(0,10);
  return {name:author.Name,username:author.Handle,caption:data.caption,media, ...(data.postType==='VIDEO'?{externalVideoUrl:expected.url}:{} )};
 }catch{return null;}
}
export async function fetchUpscrolled(raw,fetcher=fetch){
 const source=upscrolledUrl(raw);if(!source)return null;
 const signal=AbortSignal.timeout(8000);let reader;
 try {
  let current=source,r=await fetcher(current.url,{redirect:source.share?'manual':'error',signal});
  if(source.share){
   const next=upscrolledUrl(r.headers.get('location')||'');
   await r.body?.cancel().catch(()=>{});
   if(![301,302,307,308].includes(r.status)||!next||next.share||next.id!==source.id)return null;
   current=next;r=await fetcher(current.url,{redirect:'error',signal});
  }
  if(r.status!==200||r.redirected||(r.url&&r.url!==current.url)||!/text\/html/i.test(r.headers.get('content-type')||'')||Number(r.headers.get('content-length'))>524288){await r.body?.cancel().catch(()=>{});return null;}
  reader=r.body.getReader();let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>524288)return null;chunks.push(value);}
  return upscrolledMetadata(Buffer.concat(chunks).toString('utf8'),current.url);
 }catch{return null;}finally{await reader?.cancel().catch(()=>{});}
}

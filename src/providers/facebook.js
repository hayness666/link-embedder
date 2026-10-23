import { extractLinks, parseSocialUrl } from '../previews.js';
import { cardHeading, shortCaption, cardSeparator, plain, imageCardComponents } from '../card-format.js';
import { footer } from '../platform-brands.js';


export function facebookPhotoId(raw) {
  const link=parseSocialUrl(raw);
  if(link?.platform!=='facebook'||link.kind!=='photo')return null;
  const u=new URL(link.url);
  return u.searchParams.get('fbid')||u.pathname.split('/').filter(Boolean).at(-1);
}
function matchingFacebookSource(raw,link) {
  const candidate=parseSocialUrl(raw||'');
  if(candidate?.platform!=='facebook')return false;
  return link.kind==='photo' ? candidate.kind==='photo'&&facebookPhotoId(candidate.url)===facebookPhotoId(link.url) : candidate.url===link.url;
}
export function facebookNativePayload(content, embeds) {
  const links = extractLinks(content);
  if (links.length !== 1 || links[0].platform !== 'facebook' || links[0].kind === 'reel') return null;
  const link = links[0];
  const embed = embeds.find(e => matchingFacebookSource(e.url,link));
  if (!embed) return null;
  const title = typeof embed.title === 'string' ? embed.title.trim() : '';
  const description = typeof embed.description === 'string' ? embed.description.trim() : '';
  if (/log in|login|sign up|log into|content (?:isn't|is not) available/i.test(title) || /see posts, photos and more on facebook/i.test(description)) return null;
  let raw = embed.image?.url || embed.thumbnail?.url;
  if (raw) try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || raw.length > 4096
      || !(u.hostname.endsWith('.fbcdn.net') || ['media.discordapp.net','images-ext-1.discordapp.net','images-ext-2.discordapp.net'].includes(u.hostname))) return null;
  } catch { return null; }
  if (!raw && (!title || ['photo','video','story'].includes(link.kind))) return null;
  if (link.kind === 'photo') {
    const name=typeof embed.author?.name==='string'?plain(embed.author.name).slice(0,160):'';
    let handle='';
    try {
      const profile=embed.author?.url;
      if(typeof profile==='string'&&/^https:\/\/(?:www\.)?facebook\.com\//.test(profile)) {
        const u=new URL(profile),match=/^\/([A-Za-z0-9.]{5,50})\/?$/.exec(u.pathname);
        if(!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&match&&!/^\d+$/.test(match[1])&&!['photo','photos','reels','stories','watch','groups','events','pages','login','profile.php','share','marketplace'].includes(match[1].toLowerCase()))handle=match[1];
      }
    } catch { /* Unknown author handles are omitted. */ }
    const author=name||handle?`${name?`**${name}**`:''}${handle?`${name?' ':''}@\u200b${plain(handle)}`:''}`:'';
    return {flags:32768,allowedMentions:{parse:[],repliedUser:false},components:[{type:10,content},
      {type:17,accent_color:0x1877f2,components:imageCardComponents({heading:cardHeading(link),author,
        items:raw?[{media:{url:raw}}]:[],caption:description,footer:footer('facebook')})}]};
  }
  return { flags: 32768, allowedMentions: {parse: [], repliedUser: false}, components: [
    {type:10,content}, {type:17,accent_color:0x1877f2,components:[
      {type:10,content:cardHeading(link, title)},
      cardSeparator(),
      ...(raw ? [{type:12,items:[{media:{url:raw}}]}] : []),
      ...(embed.description ? [{type:10,content:shortCaption(embed.description)}] : []),
      cardSeparator(true),
      {type:10,content:footer('facebook')}
    ]}
  ]};
}

// Discord may attach the image later. Public photo/profile heads can fill missing author identity.
export async function waitForFacebookPreview(message, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), fetcher = fetch) {
  let current = message;
  for (const delay of [0, 1000, 2000, 3000]) {
    if (delay) {
      await pause(delay);
      try { current = await message.channel.messages.fetch({message:message.id,force:true,cache:false}); }
      catch { return null; }
      if (current.content !== message.content || current.editedTimestamp !== message.editedTimestamp || current.flags?.has(4)) return null;
    }
    const payload = facebookNativePayload(message.content, current.embeds || []);
    if (payload) {
      const link=extractLinks(message.content)[0];
      const embed=(current.embeds||[]).find(e=>matchingFacebookSource(e.url,link));
      if(link?.kind==='photo'&&(!embed?.author?.name||!embed?.author?.url)) {
        const author=await facebookPhotoAuthor(link.url,fetcher);
        if(author)return facebookNativePayload(message.content,[{url:embed.url,title:embed.title,description:embed.description,image:embed.image,thumbnail:embed.thumbnail,author}])||payload;
      }
      return payload;
    }
  }
  return publicFacebookPhoto(message.content,fetcher);
}

// Preserve prose and required content identity; normalize supported Facebook source links.
export function cleanFacebookPhotoSets(content) {
  return content.replace(/https:\/\/[^\s<>]+/gi, raw => {
    const suffix = /[.,!?;:)\]}]+$/.exec(raw)?.[0] || '';
    const link = parseSocialUrl(suffix ? raw.slice(0, -suffix.length) : raw);
    return link?.platform === 'facebook' ? link.url + suffix : raw;
  });
}

// Facebed exposes MP4 URLs on Facebook's video CDN. Never accept arbitrary hosts.
export function facebookReelVideo(raw) {
  try {
    const u = new URL(raw);
    return typeof raw === 'string' && raw.length <= 2048 && u.protocol === 'https:'
      && !u.username && !u.password && !u.port && !u.hash
      && /^video\.[a-z0-9-]+\.fna\.fbcdn\.net$/.test(u.hostname)
      && u.pathname.startsWith('/o1/v/') && u.pathname.endsWith('.mp4');
  } catch { return false; }
}

export async function facebookReelAttachment(url, fetcher, budget) {
  if (!facebookReelVideo(url) || budget.remaining <= 0) return null;
  let response;
  try {
    response = await fetcher(url, {redirect:'error',signal:AbortSignal.timeout(8000),headers:{Accept:'video/mp4'}});
    if (!response.ok || response.redirected || (response.url && response.url !== url)
      || !/^video\/mp4(?:;|$)/i.test(response.headers.get('content-type') || '')
      || Number(response.headers.get('content-length')) > budget.remaining) return null;
    const reader=response.body.getReader(), chunks=[]; let size=0;
    try {
      while (true) {
        const {done,value}=await reader.read(); if(done)break;
        // Shared request budget is decremented before accepting each chunk.
        if(value.byteLength>budget.remaining){budget.remaining=0;return null;}
        budget.remaining-=value.byteLength; size+=value.byteLength; chunks.push(value);
      }
    } finally { await reader.cancel().catch(()=>{}); }
    const data=Buffer.concat(chunks,size);
    return data.length>=12 && data.toString('ascii',4,8)==='ftyp' ? data : null;
  } catch { return null; }
  finally { if(response?.body&&!response.body.locked)await response.body.cancel().catch(()=>{}); }
}

function publicTags(html) {
  const decode=s=>s.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi,e=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[e.toLowerCase()]||String.fromCodePoint(Math.min(0x10ffff,e[2].toLowerCase()==='x'?parseInt(e.slice(3,-1),16):Number(e.slice(2,-1))))));
  return [...html.matchAll(/<(?:meta|link)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(([,k,,v])=>[k.toLowerCase(),decode(v)])));
}
export async function facebookPhotoAuthor(raw, fetcher=fetch) {
  const link=parseSocialUrl(raw);
  if(link?.platform!=='facebook'||link.kind!=='photo')return null;
  const original=new URL(link.url),id=original.searchParams.get('fbid')||original.pathname.split('/').filter(Boolean).at(-1);
  const signal=AbortSignal.timeout(8000);
  const photo=await publicFacebookHead(`https://www.facebook.com/photo?fbid=${id}`,fetcher,signal);
  const canonical=photo?.filter(t=>t.rel==='canonical');
  if(canonical?.length!==1)return null;
  let u;try{u=new URL(canonical[0].href);}catch{return null;}
  const match=/^\/([A-Za-z0-9.]{5,50})\/photos\/(?:[A-Za-z0-9._-]+\/)?(\d{1,30})\/?$/.exec(u.pathname);
  if(u.protocol!=='https:'||u.hostname!=='www.facebook.com'||u.username||u.password||u.port||u.search||u.hash||!match||match[2]!==id||/^\d+$/.test(match[1]))return null;
  const profile=`https://www.facebook.com/${match[1]}/`,tags=await publicFacebookHead(profile,fetcher,signal);
  if(tags?.filter(t=>t.rel==='canonical'&&t.href===profile).length!==1)return null;
  const names=tags.filter(t=>t.property==='og:title').map(t=>t.content);
  const name=names.length===1?names[0]?.trim():'';
  if(!name||name.length>160||/log in|sign up|unavailable|^facebook$/i.test(name))return null;
  return {name,url:profile};
}

async function publicFacebookHead(url, fetcher, signal) {
    let response;
    try {
      response=await fetcher(url,{redirect:'error',signal,headers:{Accept:'text/html'}});
      if(!response.ok||response.redirected||(response.url&&response.url!==url)||!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')||'') )return null;
      const reader=response.body.getReader(),chunks=[];let size=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>524288)return null;chunks.push(value);if(Buffer.concat(chunks).includes(Buffer.from('</head>')))break;}}
      finally{await reader.cancel().catch(()=>{});}
      return publicTags(Buffer.concat(chunks).toString('utf8'));
    }catch{return null;}
    finally{if(response?.body&&!response.body.locked)await response.body.cancel().catch(()=>{});}
  }

// Read the public page's explicit oEmbed reference, but never call Graph or an arbitrary URL.
export async function facebookReelAuthor(raw, fetcher=fetch) {
  const link=parseSocialUrl(raw);
  if(link?.platform!=='facebook'||link.kind!=='reel')return null;
  const id=new URL(link.url).pathname.split('/').at(-1),signal=AbortSignal.timeout(8000);
  const tags=await publicFacebookHead(link.url,fetcher,signal),owners=new Set();
  for(const tag of tags||[]) {
    if(tag.rel!=='alternate'||tag.type!=='application/json+oembed')continue;
    try {
      const endpoint=new URL(tag.href);
      if(endpoint.protocol!=='https:'||endpoint.hostname!=='graph.facebook.com'||endpoint.username||endpoint.password||endpoint.port||endpoint.hash||!/^\/v\d+\.\d+\/oembed_video$/.test(endpoint.pathname))continue;
      if(endpoint.searchParams.getAll('url').length!==1)continue;
      const source=new URL(endpoint.searchParams.get('url'));
      const m=/^\/([A-Za-z0-9.]{5,50})\/videos\/(?:[A-Za-z0-9._-]+\/)?(\d{1,30})\/?$/.exec(source.pathname);
      if(source.protocol!=='https:'||source.hostname!=='www.facebook.com'||source.username||source.password||source.port||source.search||source.hash||!m||m[2]!==id||/^\d+$/.test(m[1]))continue;
      owners.add(m[1]);
    } catch { /* Unsupported public reference, not permission to guess a profile. */ }
  }
  if(owners.size!==1)return null;
  const username=[...owners][0];
  const canonical=tags.filter(t=>t.rel==='canonical');
  if(canonical.length!==1)return null;
  try {
    const u=new URL(canonical[0].href);
    const match=/^\/([A-Za-z0-9.]{5,50})\/videos\/(?:[A-Za-z0-9._-]+\/)?(\d{1,30})\/?$/.exec(u.pathname);
    if(u.protocol!=='https:'||u.hostname!=='www.facebook.com'||u.username||u.password||u.port||u.search||u.hash||!match||match[1]!==username||match[2]!==id)return null;
  }catch{return null;}
  return {username};
}

export async function publicFacebookPhoto(content,fetcher=fetch){
 const links=extractLinks(content);if(links.length!==1||links[0].platform!=='facebook'||links[0].kind!=='photo')return null;
 const link=links[0],id=facebookPhotoId(link.url),signal=AbortSignal.timeout(8000);
 let tags=await publicFacebookHead(`https://www.facebook.com/photo?fbid=${id}`,fetcher,signal);
 const refs=tags?.filter(t=>t.rel==='canonical');if(refs?.length!==1)return null;
 let canonical;try{canonical=new URL(refs[0].href);}catch{return null;}
 const match=/^\/([A-Za-z0-9.]{5,50})\/photos\/(?:[A-Za-z0-9._-]+\/)?(\d{1,30})\/?$/.exec(canonical.pathname);
 if(canonical.protocol!=='https:'||canonical.hostname!=='www.facebook.com'||canonical.username||canonical.password||canonical.port||canonical.search||canonical.hash||!match||match[2]!==id)return null;
 tags=await publicFacebookHead(canonical.href,fetcher,signal);if(!tags)return null;
 const get=k=>tags.find(t=>t.property===k)?.content||'';
 if(photoIdFromTags(tags)!==id)return null;
 const image=get('og:image');let u;try{u=new URL(image);}catch{return null;}
 if(u.protocol!=='https:'||!/^scontent-[a-z0-9-]+\.xx\.fbcdn\.net$/.test(u.hostname)||!u.pathname.startsWith('/v/t')||u.username||u.password||u.port||u.hash||image.length>4096)return null;
 const embed={url:link.url,title:get('og:title'),description:get('og:description'),image:{url:image}};
 // Reject login shells before any optional profile request.
 const payload=facebookNativePayload(content,[embed]);if(!payload)return null;
 const profile=`https://www.facebook.com/${match[1]}/`,authorTags=await publicFacebookHead(profile,fetcher,signal);
 if(authorTags?.filter(t=>t.rel==='canonical'&&t.href===profile).length===1){
  const name=authorTags.find(t=>t.property==='og:title')?.content?.trim();
  if(name&&name.length<=160&&!/log in|sign up|unavailable|^facebook$/i.test(name))embed.author={name,url:profile};
 }
 return facebookNativePayload(content,[embed])||payload;
}
function photoIdFromTags(tags){const values=tags.filter(t=>t.property==='og:url');return values.length===1?facebookPhotoId(values[0].content):null;}

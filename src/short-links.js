import {parseSocialUrl} from './previews.js';
// Only known platform-owned short routes. Never follow arbitrary redirectors.
export function shortFamily(raw) {
 if(typeof raw!=='string'||raw.length>2048||!/^https:\/\/[a-z0-9.-]+(?:[/?#]|$)/i.test(raw)||/[\\\u0000-\u0020]/.test(raw))return null;
 let u;try{u=new URL(raw);}catch{return null;}if(u.username||u.password||u.port||u.protocol!=='https:')return null;
 const h=u.hostname.replace(/^www\./,''),p=u.pathname;
 if(['amzn.to','a.co'].includes(h)&&/^\/(?:d\/)?[A-Za-z0-9]{1,30}\/?$/.test(p))return 'amazon';
 if(['vm.tiktok.com','vt.tiktok.com'].includes(h)&&/^\/[A-Za-z0-9]{1,40}\/?$/.test(p)||h==='tiktok.com'&&/^\/t\/[A-Za-z0-9]{1,40}\/?$/.test(p))return 'tiktok';
 if(h==='instagram.com'&&/^\/share\/(?:reel\/|p\/)?[A-Za-z0-9_-]{1,100}\/?$/.test(p))return 'instagram';
 if(['facebook.com','m.facebook.com'].includes(h)&&/^\/share\/(?:r\/|v\/|p\/)?[A-Za-z0-9_-]{1,100}\/?$/.test(p)||['fb.watch','fb.me'].includes(h)&&/^\/[A-Za-z0-9_-]{1,100}\/?$/.test(p))return 'facebook';
 if(h==='redd.it'&&/^\/[a-z0-9]{1,15}\/?$/i.test(p)||h==='reddit.com'&&/^\/(?:r\/[A-Za-z0-9_]{1,30}\/)?s\/[A-Za-z0-9]{1,100}\/?$/.test(p))return 'reddit';
 if(h==='t.co'&&/^\/[A-Za-z0-9]{1,30}\/?$/.test(p))return 'twitter';
 return null;
}
const tokens=/```[\s\S]*?(?:```|$)|`[^`]*(?:`|$)|\|\|[\s\S]*?(?:\|\||$)|<[^>]*>|\[[^\]]*\]\([^)]*\)|https:\/\/[^\s<>]+/gi;
export function shortLinks(content) {
 const found=new Set();
 for(const [token]of content.slice(0,10000).matchAll(tokens)){
  const raw=token.replace(/[.,!?;:)\]}]+$/,'');if(token.startsWith('https://')&&shortFamily(raw))found.add(raw);if(found.size===3)break;
 }return [...found];
}
export async function resolveShortLink(raw,fetcher=fetch) {
 const family=shortFamily(raw);if(!family)return null;
 const seen=new Set();let current=raw;const signal=AbortSignal.timeout(6000);
 for(let hop=0;hop<4;hop++){
  if(seen.has(current)||shortFamily(current)!==family)return null;seen.add(current);
  let r;try{
   r=await fetcher(current,{method:'GET',redirect:'manual',signal,headers:{'User-Agent':'LinkEmbedder public link resolver'}});
   if(![301,302,303,307,308].includes(r.status))return null;
   const location=r.headers.get('location');if(!location)return null;
   const next=new URL(location,current).href;const canonical=parseSocialUrl(next);
   if(canonical && !shortFamily(next))return canonical.platform===family?canonical.url:null;
   if(shortFamily(next)!==family)return null;
   current=next;
  }catch{return null;}finally{if(r?.body)await r.body.cancel().catch(()=>{});}
 }return null;
}
export async function expandShortLinks(content,modes,fetcher=fetch,resolved=new Map()){
 const links=shortLinks(content).filter(u=>modes[shortFamily(u)]!=='off');
 const pairs=await Promise.all(links.map(async u=>[u,await resolveShortLink(u,fetcher)]));const map=new Map(pairs.filter(([,v])=>v));
 for(const [source,target] of map) resolved.set(source,target);
 return content.replace(tokens,token=>{if(!token.startsWith('https://'))return token;const raw=token.replace(/[.,!?;:)\]}]+$/,'');return map.has(raw)?map.get(raw)+token.slice(raw.length):token;});
}

// Public Reddit video links can identify the original post behind a crosspost.
export async function resolveRedditVideo(raw,fetcher=fetch) {
 if (!/^https:\/\/v\.redd\.it\/[a-z0-9]{1,30}\/?$/i.test(raw)) return null;
 const id=new URL(raw).pathname.replaceAll('/','');let current=raw;
 const signal=AbortSignal.timeout(6000);
 for(let hop=0;hop<2;hop++) {
  let r;try {
   r=await fetcher(current,{redirect:'manual',signal,headers:{'User-Agent':'LinkEmbedder public link resolver'}});
   if(![301,302,303,307,308].includes(r.status))return null;
   const location=r.headers.get('location');if(!location)return null;
   const next=new URL(location,current);const parsed=parseSocialUrl(next.href);
   if(parsed?.platform==='reddit')return parsed.url;
   if(next.href!==`https://www.reddit.com/video/${id}`)return null;
   current=next.href;
  }catch{return null;}finally{if(r?.body)await r.body.cancel().catch(()=>{});}
 }
 return null;
}

// Discord may resolve a public share link even when Reddit declines the bot host.
// Only accept Reddit's own preview URL from an embed matching that exact link.
export function expandRedditNativeShares(content, embeds = []) {
 const replacements = new Map();
 for (const raw of shortLinks(content)) {
  if (shortFamily(raw) !== 'reddit') continue;
  const candidates = new Set();
  for (const embed of embeds) {
   if (embed.url !== raw) continue;
   for (const media of [embed.image, embed.thumbnail]) {
    let u;try { u = new URL(media?.url); } catch { continue; }
    if (u.protocol !== 'https:' || u.hostname !== 'share.redd.it' || u.username || u.password || u.port) continue;
    const match = /^\/preview\/post\/([a-z0-9]{1,15})\/?$/i.exec(u.pathname);
    if (match) candidates.add(`https://www.reddit.com/comments/${match[1]}`);
   }
  }
  if (candidates.size === 1) replacements.set(raw, [...candidates][0]);
 }
 return content.replace(tokens, token => {
  if (!token.startsWith('https://')) return token;
  const raw = token.replace(/[.,!?;:)\]}]+$/, '');
  return replacements.has(raw) ? replacements.get(raw) + token.slice(raw.length) : token;
 });
}

// Only the resolver's successful Amazon mappings can associate source embeds.
export function amazonShareContext(content, embeds, resolved) {
 const amazon = new Map([...resolved].filter(([source,target]) => shortFamily(source)==='amazon' && parseSocialUrl(target)?.platform==='amazon'));
 const display = content.replace(tokens, token => {
  if(!token.startsWith('https://'))return token;
  const raw=token.replace(/[.,!?;:)\]}]+$/,'');
  return amazon.has(raw)?amazon.get(raw)+token.slice(raw.length):token;
 });
 return {display,embeds:embeds.map(embed => amazon.has(embed.url)
  ? {...(embed.toJSON?.() || embed),url:amazon.get(embed.url)} : embed)};
}

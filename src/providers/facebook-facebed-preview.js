import {createFacebookAuthorLookup} from './facebook-author-enrichment.js';
import {extractLinks,parseSocialUrl} from '../previews.js';
import {facebookPhotoId,facebookReelVideo,facebookReelAttachment,cleanFacebookPhotoSets} from './facebook.js';
import {cardHeading,imageCardComponents,plain} from '../card-format.js';
import {footer} from '../platform-brands.js';
function identity(raw){
 const link=parseSocialUrl(raw||'');if(link?.platform!=='facebook'||!['photo','video','post','reel'].includes(link.kind))return null;
 const u=new URL(link.url);if(/^\/(?:groups|stories|login|checkpoint|challenge)(?:[/.]|$)/i.test(u.pathname))return null;
 const id=link.kind==='photo'?facebookPhotoId(link.url):link.kind==='post'&&u.searchParams.has('story_fbid')?u.searchParams.get('story_fbid'):u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).at(-1);
 if(!/^(?:\d{1,30}|pfbid[A-Za-z0-9]{1,150})$/.test(id))return null;
 if(link.kind!=='post'&&!/^\d{1,30}$/.test(id))return null;
 return {...link,id};
}
export function eligibleFacebedFacebookLink(raw){const link=identity(raw);return link&&['photo','video','post'].includes(link.kind)?link:null;}

function imageAllowed(raw){try{const u=new URL(raw);return raw.length<=4096&&u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&/^(?:scontent\.[a-z0-9-]+\.fna|scontent-[a-z0-9-]+\.xx)\.fbcdn\.net$/.test(u.hostname)&&u.pathname.startsWith('/v/t');}catch{return false;}}
function decode(s){return s.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi,e=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[e.toLowerCase()]||String.fromCodePoint(Math.min(0x10ffff,e[2].toLowerCase()==='x'?parseInt(e.slice(3,-1),16):Number(e.slice(2,-1))))));}
export function facebedFacebookMetadata(raw,html){
 const expected=identity(raw);if(!expected||!['photo','video','post'].includes(expected.kind)||typeof html!=='string'||Buffer.byteLength(html)>524288)return null;
 const tags=new Map();for(const m of html.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)){const a=Object.fromEntries([...m[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(([,k,,v])=>[k.toLowerCase(),decode(v)]));if(a.property&&a.content!==undefined)tags.set(a.property,[...(tags.get(a.property)||[]),a.content]);}
 const get=k=>tags.get(k)?.length===1?tags.get(k)[0]:'';const actual=identity(get('og:url'));
 if(!actual||actual.id!==expected.id||!(actual.kind===expected.kind||(expected.kind==='video'&&actual.kind==='reel')))return null;
 const name=get('og:title').trim(),caption=get('og:description');if(!name||name.length>160||/log in|login|sign up|unavailable|^facebook$|facebed/i.test(name))return null;
 let handle='';const profile=/^\/([A-Za-z0-9.]{1,50})\/(?:posts|videos)\//.exec(new URL(actual.url).pathname);if(profile&&!/^\d+$/.test(profile[1]))handle=profile[1];
 const video=get('og:video:secure_url')||get('og:video'),image=get('og:image');
 if(expected.kind==='video'){if(get('og:video:type')!=='video/mp4'||!facebookReelVideo(video))return null;return {link:expected,name,handle,caption,video};}
 if(image){if(!imageAllowed(image))return null;return {link:expected,name,handle,caption,image};}
 if(expected.kind!=='post'||!caption.trim()||/^(?:log in|login|sign up|content (?:isn't|is not) available|this (?:page|content) (?:isn't|is not) available|see posts, photos and more on facebook)/i.test(caption.trim())||video)return null;
 return {link:expected,name,handle,caption};
}
async function fetchPreview(url,fetcher){let r;try{r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(8000),headers:{'User-Agent':'Discordbot (Link Embedder public preview)',Accept:'text/html, application/json, application/activity+json'}});if(!r.ok||r.redirected||(r.url&&r.url!==url)||!/^text\/html(?:;|$)/i.test(r.headers.get('content-type')||'')||Number(r.headers.get('content-length'))>524288)return null;const reader=r.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>524288)return null;chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}return Buffer.concat(chunks).toString('utf8');}catch{return null;}finally{if(r?.body&&!r.body.locked)await r.body.cancel().catch(()=>{});}}
// Explicit format/source approval is required; defaults remain disabled.
export function createFacebedFacebookPreview({allowedSources=[],allowedKinds=[],fetcher=fetch,authorLookup=createFacebookAuthorLookup({fetcher})}={}){
 if(!Array.isArray(allowedKinds)||allowedKinds.some(x=>!['photo','video','post'].includes(x)))throw new Error('Invalid Facebook public format allowlist.');
 const kinds=new Set(allowedKinds);
 const allowed=new Set(allowedSources.map(s=>eligibleFacebedFacebookLink(s)?.url).filter(Boolean));
 return async content=>{const links=extractLinks(content);if(links.length!==1)return null;const eligible=eligibleFacebedFacebookLink(links[0].url);if(!eligible||(!kinds.has(eligible.kind)&&!allowed.has(eligible.url)))return null;
 const u=new URL(links[0].url),url='https://www.facebed.com'+u.pathname+u.search;const html=await fetchPreview(url,fetcher);const meta=facebedFacebookMetadata(links[0].url,html);if(!meta)return null;
 const files=[],items=[];if(meta.video){const data=await facebookReelAttachment(meta.video,fetcher,{remaining:8388608});if(!data)return null;files.push({attachment:data,name:'facebook-video.mp4',contentType:'video/mp4'});items.push({media:{url:'attachment://facebook-video.mp4'}});}else if(meta.image)items.push({media:{url:meta.image}});
 if(!meta.handle){try{meta.handle=await authorLookup(meta);}catch{/* Optional enrichment must preserve the usable card. */}}
 const author=`**${plain(meta.name)}**${meta.handle?' @\u200b'+plain(meta.handle):''}`;
 const components=[{type:10,content:cleanFacebookPhotoSets(content)},{type:17,accent_color:0x1877f2,components:imageCardComponents({heading:cardHeading(meta.link),author,items,caption:meta.caption,captionBeforeMedia:meta.link.kind==='post',footer:footer('facebook')})}];
 const textSize=xs=>xs.reduce((n,x)=>n+(x.type===10?x.content.length:0)+(x.components?textSize(x.components):0),0);if(textSize(components)>4000)return null;
 return {flags:32768,allowedMentions:{parse:[],repliedUser:false},components,...(files.length?{files}:{})};
 };
}

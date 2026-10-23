import {facebookPhotoAuthor,facebookReelAuthor} from './facebook.js';

// Memory-only, bounded enrichment. An unavailable author never invalidates media.
export function createFacebookAuthorLookup({fetcher=fetch,now=Date.now,timeoutMs=1500}={}) {
 const cache=new Map();
 return async meta=>{
  if(meta.handle||!['photo','video'].includes(meta.link?.kind))return '';
  const key=`${meta.link.kind}:${meta.link.id}:${meta.name}`;
  const cached=cache.get(key);if(cached&&cached.until>now())return cached.handle;
  cache.delete(key);
  const controller=new AbortController();let timer;
  const boundedFetch=(url,options={})=>fetcher(url,{...options,signal:options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal});
  const work=async()=>{
   if(meta.link.kind==='photo'){
    const author=await facebookPhotoAuthor(meta.link.url,boundedFetch);
    if(!author||author.name.normalize('NFKC').trim()!==meta.name.normalize('NFKC').trim())return '';
    return /^https:\/\/www\.facebook\.com\/([A-Za-z0-9.]{5,50})\/$/.exec(author.url)?.[1]||'';
   }
   const author=await facebookReelAuthor(`https://www.facebook.com/reel/${meta.link.id}`,boundedFetch);
   return author?.username||'';
  };
  let handle='';try{
   handle=await Promise.race([work().catch(()=>''),new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve('');},timeoutMs);})]);
  }finally{clearTimeout(timer);controller.abort();}
  if(!/^[A-Za-z0-9.]{5,50}$/.test(handle)||/^\d+$/.test(handle))handle='';
  if(cache.size>=128)cache.delete(cache.keys().next().value);
  cache.set(key,{handle,until:now()+(handle?300000:30000)});
  return handle;
 };
}

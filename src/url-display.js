// Keep URLs literal: Discord can display URL-shaped masked labels as raw Markdown.
// Preserve functional trailing slashes instead of disguising or changing destinations.
export function displayUrl(url, autolink = true) { return autolink ? `<${url}>` : url; }

// Recognize the previous exact generated form only when restoring tracked edit text.
function legacyDisplayUrl(url, autolink = true) {
 const fallback=autolink?`<${url}>`:url;
 let u;try{u=new URL(url);}catch{return fallback;}
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||/[<>\\\s\u0000-\u001f]/u.test(url)||u.search||u.hash||!url.endsWith('/'))return fallback;
 const label=url.replace(/\/+$/,'').replace(/[\\*_~`|\[\]()]/g,c=>'\\'+c);
 return `[${label}](<${url}>)`;
}
const sourceTokens=/```[\s\S]*?(?:```|$)|`[^`]*(?:`|$)|\|\|[\s\S]*?(?:\|\||$)|<[^>]*>|\[(?:\\.|[^\]])*\]\([^\n]*?\)|https?:\/\/[^\s<>]+/gi;
export function displaySourceUrls(content){
 return content.replace(sourceTokens,token=>{
  if(!/^https?:\/\//i.test(token))return token;
  let raw=token.replace(/[.,!;:?]+$/,'');
  while(/[)\]}]$/.test(raw)){const end=raw.at(-1),start={')':'(',']':'[','}':'{'}[end];if(raw.split(end).length<=raw.split(start).length)break;raw=raw.slice(0,-1);}
  return displayUrl(raw,false)+token.slice(raw.length);
 });
}
// Decode only our exact generated label/target pair, never arbitrary masked links.
export function restoreSourceUrls(content){
 return content.replace(/\[(?:\\.|[^\]\\\n])*\]\(<(https?:\/\/[^<>\s]+)>\)/gi,(whole,url)=>legacyDisplayUrl(url,false)===whole?url:whole);
}

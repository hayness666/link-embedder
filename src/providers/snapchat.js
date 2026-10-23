export function publicStorySnapUrl(raw) {
  try {
    const u = new URL(raw);
    const pattern = u.hostname === 'story.snapchat.com' ? /^\/u\/([A-Za-z0-9._-]{1,30})\/([A-Za-z0-9_-]{20,200})\/?$/ : /^\/(?:@|%40)([A-Za-z0-9._-]{1,30})\/([A-Za-z0-9_-]{20,200})\/?$/;
    const m=pattern.exec(u.pathname);
    if(u.protocol!=='https:'||!['www.snapchat.com','snapchat.com','story.snapchat.com'].includes(u.hostname)||u.username||u.password||u.port||!m)return null;
    return {username:m[1],id:m[2],url:`https://www.snapchat.com/@${m[1]}/${m[2]}`};
  }catch{return null;}
}
export function publicStorySnapMetadata(html, expectedUrl) {
  try {
    const expected=publicStorySnapUrl(expectedUrl);
    const json=/<script\s+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
    if(!expected||!json)return null;
    const data=JSON.parse(json),p=data?.props?.pageProps,h=p?.story,profile=p?.userProfile?.publicProfileInfo;
    if(data.page!=='/at/[username]/[snapId]'||data.query?.username!==`@${expected.username}`||data.query?.snapId!==expected.id
      ||h?.storyType!==5||h?.storyId?.value!==expected.username||profile?.username!==expected.username||p.showSnapExpiredToast!==false)return null;
    const matches=(h.snapList||[]).filter(s=>s?.snapId?.value===expected.id);
    if(matches.length!==1)return null;
    const snap=matches[0],url=snap.snapUrls?.mediaUrl,u=new URL(url);
    if(![0,1].includes(snap.snapMediaType)||snap.snapUrls.overlayUrl||u.protocol!=='https:'||u.hostname!=='cf-st.sc-cdn.net'
      ||!u.pathname.startsWith('/d/')||u.username||u.password||u.port||u.hash||url.length>2048)return null;
    return {name:profile.title||'',username:profile.username,title:'Snapchat Story',caption:'',entries:[{url,type:snap.snapMediaType===1?'video':'image'}],total:1};
  }catch{return null;}
}
export function savedStoryUrl(raw) {
  try {
    const u = new URL(raw);
    const match = /^\/(?:@|%40)([A-Za-z0-9._-]{1,30})\/highlight\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(?:\/embed)?\/?$/i.exec(u.pathname);
    if (u.protocol !== 'https:' || !['www.snapchat.com','snapchat.com'].includes(u.hostname) || u.username || u.password || u.port || !match) return null;
    return {username:match[1],id:match[2].toLowerCase(),url:`https://www.snapchat.com/@${match[1]}/highlight/${match[2].toLowerCase()}/embed`};
  } catch { return null; }
}
export function savedStoryMetadata(html, expectedUrl) {
  try {
    const expected = savedStoryUrl(expectedUrl);
    const json = /<script\s+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
    if (!expected || !json) return null;
    const p = JSON.parse(json)?.props?.pageProps;
    const actual = savedStoryUrl(p?.linkPreview?.canonicalUrl);
    const h = p?.highlight, profile = p?.publicUserProfile;
    if (!actual || actual.url !== expected.url || h?.highlightId?.value?.toLowerCase() !== expected.id
      || profile?.username !== expected.username || !Array.isArray(h?.snapList) || !h.snapList.length) return null;
    const entries = h.snapList.slice(0,10).map(snap => {
      const url = snap?.snapUrls?.mediaUrl;
      const u = new URL(url);
      if (![0,1].includes(snap.snapMediaType) || snap.snapUrls.overlayUrl || u.protocol !== 'https:'
        || u.hostname !== 'cf-st.sc-cdn.net' || !u.pathname.startsWith('/d/') || u.username || u.password || u.port || u.hash || url.length>2048) return null;
      return {url,type:snap.snapMediaType===1?'video':'image'};
    });
    // Do not silently substitute a thumbnail or omit an overlay-bearing Snap.
    if (entries.some(x=>!x)) return null;
    return {name:profile.title || '',username:profile.username,title:h.storyTitle?.value || '',caption:'',entries,total:h.snapList.length};
  } catch { return null; }
}
// Public Spotlight media only. No redirects, credentials, or arbitrary hosts.
export async function snapchatAttachment(raw, fetcher = fetch, budget = {remaining: 8 * 1024 * 1024}, kind = 'spotlight') {
  let reader, response;
  try {
    const u = new URL(raw);
    if (typeof raw !== 'string' || raw.length > 2048 || u.protocol !== 'https:'
      || !(kind === 'spotlight' ? u.hostname === 'bolt-gcdn.sc-cdn.net' && u.pathname.startsWith('/u/') : ['story-video','story-image'].includes(kind) && u.hostname === 'cf-st.sc-cdn.net' && u.pathname.startsWith('/d/'))
      || u.username || u.password || u.port || u.hash) return null;
    response = await fetcher(u.href, {redirect:'error', signal:AbortSignal.timeout(8000)});
    if (response.status !== 200 || response.redirected || (response.url && response.url !== u.href)) return null;
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!(kind === 'story-image' ? ['image/jpeg','image/png','image/webp'] : ['video/mp4','application/octet-stream']).includes(mime)) return null;
    const length = Number(response.headers.get('content-length'));
    if (!Number.isFinite(length) || length < 0 || length > budget.remaining || !response.body) return null;
    reader = response.body.getReader();
    const chunks = []; let size = 0;
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      if (value.byteLength > budget.remaining) return null;
      budget.remaining -= value.byteLength;
      size += value.byteLength; chunks.push(value);
    }
    const data = Buffer.concat(chunks, size);
    if (kind === 'story-image') {
      const ext = mime === 'image/jpeg' && data[0]===255 && data[1]===216 && data[2]===255 ? 'jpg'
        : mime === 'image/png' && data.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) ? 'png'
        : mime === 'image/webp' && data.toString('ascii',0,4)==='RIFF' && data.toString('ascii',8,12)==='WEBP' ? 'webp' : null;
      return ext ? {data,ext,mime} : null;
    }
    if (data.length < 16 || data.toString('ascii',4,8) !== 'ftyp'
      || data.readUInt32BE(0) < 16 || data.readUInt32BE(0) > data.length
      || !['isom','iso2','mp41','mp42','avc1','M4V '].includes(data.toString('ascii',8,12))) return null;
    return data;
  } catch { return null; }
  finally { if(reader) await reader.cancel().catch(()=>{}); else await response?.body?.cancel().catch(()=>{}); }
}

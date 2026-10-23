import {refreshReopenedThreadMessage} from './thread-routing.js';
import {createFacebedFacebookPreview,eligibleFacebedFacebookLink} from './providers/facebook-facebed-preview.js';
import facebedPublicSharing from './facebook-facebed-allowlist.json' with {type:'json'};
import { cleanThreadsLinks } from './urls.js';
import { buildPayload, extractLinks } from './previews.js';
import {shortLinks,shortFamily,expandShortLinks,expandRedditNativeShares,amazonShareContext} from './short-links.js';
import { waitForFacebookPreview, cleanFacebookPhotoSets } from './providers/facebook.js';
import { simplePayload, simpleCard, mergeAmazonEmbeds, incompleteAmazonEmbeds, incompletePinterestEmbeds } from './simple-cards.js';
export function createHandler(config, { canSend, repost, log = () => {}, now = Date.now, makeCardPayload = simplePayload, expandLinks = expandShortLinks, nativeFacebook = waitForFacebookPreview, facebookPublicSources = facebedPublicSharing.allowedSources ?? [], facebookPublicKinds = facebedPublicSharing.allowedKinds ?? [], facebookPublicFetcher = fetch } = {}) {
  const guilds = new Map();
  if(!Array.isArray(facebookPublicSources)||facebookPublicSources.some(x=>typeof x!=='string'))throw new Error('Invalid Facebook public source allowlist.');
  if(!Array.isArray(facebookPublicKinds)||facebookPublicKinds.some(x=>!['photo','video','post'].includes(x)))throw new Error('Invalid Facebook public format allowlist.');
  const publicKinds=new Set(facebookPublicKinds);
  const publicSources=new Set(facebookPublicSources.map(x=>extractLinks(x)[0]?.url).filter(Boolean));
  const publicPreview=createFacebedFacebookPreview({allowedSources:facebookPublicSources,allowedKinds:facebookPublicKinds,fetcher:facebookPublicFetcher});
  return async function handle(message) {
    // Explicit emergency shutdown only; this is not a content-safety classifier.
    if (config.previewsDisabled) return;
    if (!message.guildId || (config.testGuildId && message.guildId !== config.testGuildId)
      || (config.channelIds.size && !config.channelIds.has(message.channelId))
      || message.author?.bot || message.webhookId || message.system || message.flags?.has(4)) return;
    try { message=await refreshReopenedThreadMessage(message); } catch { return; }
    if (!message || !canSend(message)) return;
    const originalLinks = extractLinks(message.content ?? '');
    const facebookPost = originalLinks.some(link => link.platform === 'facebook' && link.kind !== 'reel');
    if (facebookPost && (!config.modes.facebook || config.modes.facebook === 'off' || originalLinks.length !== 1 || !config.repostEnabled || !repost)) return;
    const time = now();
    for (const [id, state] of guilds) if (time - state.lastActive > 600000) guilds.delete(id);
    let state = guilds.get(message.guildId);
    if (!state) {
      // Bound global memory without evicting active servers and resetting their throttles.
      if (guilds.size >= 10000) return;
      state = { seen: new Map(), cooldown: new Map(), recent: [], lastActive: time };
      guilds.set(message.guildId, state);
    }
    const { seen, cooldown } = state;
    for (const [id, expiry] of seen) if (expiry <= time) seen.delete(id);
    for (const [id, expiry] of cooldown) if (expiry <= time) cooldown.delete(id);
    state.recent = state.recent.filter(t => t > time - 60000);
    if (seen.has(message.id) || cooldown.has(message.channelId) || state.recent.length >= 20) return;
    const nativeLinks = originalLinks.some(link => config.modes[link.platform] === 'native');
    let payload = buildPayload(message.content ?? '', config.modes, message.embeds ?? []);
    if (!payload && !facebookPost && !nativeLinks && !shortLinks(message.content ?? '').length) return;
    seen.set(message.id, time + 600000);
    if (seen.size > 1000) seen.delete(seen.keys().next().value);
    cooldown.set(message.channelId, time + 3000);
    state.recent.push(time);
    state.lastActive = time;
    try {
      if (facebookPost) {
        const publicLink=eligibleFacebedFacebookLink(originalLinks[0]?.url);
        const usePublicHelper=config.modes.facebook==='facebed'&&publicLink&&(publicKinds.has(publicLink.kind)||publicSources.has(publicLink.url));
        const native = usePublicHelper ? await publicPreview(message.content) : await nativeFacebook(message);
        const display = cleanFacebookPhotoSets(message.content);
        if (native) { native.components[0].content = display; await repost(message, native, display); }
        // Preserve the original when no usable native or public content is available.
        return; // On failure preserve the original native preview; never send a duplicate.
      }
      const resolvedShares = new Map();
      let expanded = await expandLinks(message.content ?? '', config.modes, undefined, resolvedShares);
      if (config.modes.reddit !== 'off' && shortLinks(expanded).some(u => shortFamily(u) === 'reddit')) {
        expanded = expandRedditNativeShares(expanded, message.embeds ?? []);
        if (shortLinks(expanded).some(u => shortFamily(u) === 'reddit') && message.channel.messages?.fetch) {
          for (const delay of [1000, 2000]) {
            await new Promise(resolve => setTimeout(resolve, delay));
            try {
              const fresh = await message.channel.messages.fetch({message:message.id,force:true,cache:false});
              if (fresh.content !== message.content || fresh.flags?.has(4)) return;
              const resolved = expandRedditNativeShares(expanded, fresh.embeds ?? []);
              if (resolved !== expanded) { expanded = resolved; break; }
            } catch { return; }
          }
        }
      }
      const expandedFacebook = extractLinks(expanded).filter(link => link.platform === 'facebook');
      if (expandedFacebook.length && !(expandedFacebook.length === 1 && expandedFacebook[0].kind === 'reel' && config.modes.facebook === 'facebed')) {
        if (extractLinks(expanded).length !== 1 || !config.modes.facebook || config.modes.facebook === 'off' || !config.repostEnabled || !repost) return;
        const display = cleanFacebookPhotoSets(message.content);
        await repost(message, {flags:32768,components:[{type:10,content:display},simpleCard(expandedFacebook[0])],allowedMentions:{parse:[],repliedUser:false}}, display);
        return;
      }
      payload = buildPayload(expanded, config.modes, message.embeds ?? []);
      const previewLinks = extractLinks(expanded);
      const keepNative = previewLinks.some(link => link.platform !== 'amazon' && config.modes[link.platform] === 'native');
      const amazon = previewLinks.some(link => link.platform === 'amazon' && config.modes.amazon !== 'off');
      if (!payload && !keepNative && !amazon) return;
      let availableEmbeds = message.embeds ?? [];
      if (amazon) availableEmbeds = mergeAmazonEmbeds([], amazonShareContext(message.content ?? '', availableEmbeds, resolvedShares).embeds);
      const pinterest = previewLinks.some(link => link.platform === 'pinterest');
      const needsRefresh = () => (amazon && incompleteAmazonEmbeds(previewLinks, availableEmbeds))
        || (pinterest && incompletePinterestEmbeds(previewLinks, availableEmbeds))
        || (!amazon && !pinterest && !availableEmbeds.length);
      if ((keepNative || amazon || pinterest) && needsRefresh() && message.channel?.messages?.fetch) {
        for (const delay of [1000,2000]) {
          await new Promise(resolve => setTimeout(resolve,delay));
          try {
            const fresh = await message.channel.messages.fetch({message:message.id,force:true,cache:false});
            if (fresh.content !== message.content || fresh.flags?.has(4)) return;
            availableEmbeds = amazon
              ? mergeAmazonEmbeds(availableEmbeds, amazonShareContext(message.content ?? '', fresh.embeds ?? [], resolvedShares).embeds)
              : fresh.embeds ?? [];
            if (!needsRefresh()) break;
          } catch { return; }
        }
      }
      const amazonContext = amazonShareContext(message.content ?? '', availableEmbeds, resolvedShares);
      payload = await makeCardPayload(expanded, config.modes, amazonContext.embeds) || payload;
      if (keepNative && config.repostEnabled) return;
      if (keepNative) {
        if (payload?.flags === 32768) {
          await message.channel.send({...payload,components:payload.components.slice(1),reply:{messageReference:message.id,failIfNotExists:false}});
        }
        return; // Preserve the source message and its native player; no deletion/repost.
      }
      if (!payload) return;
      // Preserve surrounding prose; validated Amazon shares display their product URL.
      if (payload.flags === 32768 && payload.components[0]?.type === 10) payload.components[0].content = cleanThreadsLinks(amazonContext.display);
      if (config.repostEnabled) {
        if (repost) await repost(message, payload, cleanThreadsLinks(amazonContext.display));
        return; // Replacement-only mode never falls back to a separate message.
      }
      await message.channel.send(payload);
    } catch { log('preview_send_failed'); }
  };
}

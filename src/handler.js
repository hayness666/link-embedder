import { buildPayload, extractLinks } from './previews.js';
import {shortLinks,expandShortLinks} from './short-links.js';
import { waitForFacebookPreview, cleanFacebookPhotoSets } from './facebook-native.js';
import { simplePayload } from './simple-cards.js';
export function createHandler(config, { canSend, repost, log = () => {}, now = Date.now, makeInstagramPayload = simplePayload, expandLinks = expandShortLinks, nativeFacebook = waitForFacebookPreview } = {}) {
  const guilds = new Map();
  return async function handle(message) {
    // Explicit emergency shutdown only; this is not a content-safety classifier.
    if (config.previewsDisabled) return;
    if (!message.guildId || (config.testGuildId && message.guildId !== config.testGuildId)
      || (config.channelIds.size && !config.channelIds.has(message.channelId))
      || message.author?.bot || message.webhookId || message.system || message.flags?.has(4)) return;
    if (!canSend(message)) return;
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
        const native = await nativeFacebook(message);
        const display = cleanFacebookPhotoSets(message.content);
        if (native) { native.components[0].content = display; await repost(message, native, display); }
        else if (display !== message.content) await repost(message, {content:'',allowedMentions:{parse:[],repliedUser:false}}, display);
        return; // On failure preserve the original native preview; never send a duplicate.
      }
      const expanded = await expandLinks(message.content ?? '', config.modes);
      if (extractLinks(expanded).some(link => link.platform === 'facebook' && link.kind !== 'reel')) return;
      payload = buildPayload(expanded, config.modes, message.embeds ?? []);
      const keepNative = extractLinks(expanded).some(link => config.modes[link.platform] === 'native');
      if (!payload && !keepNative) return;
      let availableEmbeds = message.embeds ?? [];
      if (keepNative && !availableEmbeds.length && message.channel.messages?.fetch) {
        for (const delay of [1000,2000]) {
          await new Promise(resolve => setTimeout(resolve,delay));
          try {
            const fresh = await message.channel.messages.fetch({message:message.id,force:true,cache:false});
            if (fresh.content !== message.content || fresh.flags?.has(4)) return;
            availableEmbeds = fresh.embeds ?? [];
            if (availableEmbeds.length) break;
          } catch { return; }
        }
      }
      payload = await makeInstagramPayload(expanded, config.modes, availableEmbeds) || payload;
      if (keepNative) {
        if (payload?.flags === 32768) {
          await message.channel.send({...payload,components:payload.components.slice(1),reply:{messageReference:message.id,failIfNotExists:false}});
        }
        return; // Preserve the source message and its native player; no deletion/repost.
      }
      // Expanded URLs select previews; the visible source remains exactly as written.
      if (payload.flags === 32768 && payload.components[0]?.type === 10) payload.components[0].content = message.content ?? '';
      if (config.repostEnabled && repost && await repost(message, payload, message.content ?? '')) return;
      await message.channel.send(payload);
    } catch { log('preview_send_failed'); }
  };
}

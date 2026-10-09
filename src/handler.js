import { buildPayload } from './previews.js';
export function createHandler(config, { canSend, repost, log = () => {}, now = Date.now } = {}) {
  const guilds = new Map();
  return async function handle(message) {
    // Explicit emergency shutdown only; this is not a content-safety classifier.
    if (config.previewsDisabled) return;
    if (!message.guildId || (config.testGuildId && message.guildId !== config.testGuildId)
      || (config.channelIds.size && !config.channelIds.has(message.channelId))
      || message.author?.bot || message.webhookId || message.system || message.flags?.has(4)) return;
    if (!canSend(message)) return;
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
    const payload = buildPayload(message.content ?? '', config.modes, message.embeds ?? []);
    if (!payload) return;
    seen.set(message.id, time + 600000);
    if (seen.size > 1000) seen.delete(seen.keys().next().value);
    cooldown.set(message.channelId, time + 3000);
    state.recent.push(time);
    state.lastActive = time;
    try {
      if (config.repostEnabled && repost && await repost(message, payload)) return;
      await message.channel.send(payload);
    } catch { log('preview_send_failed'); }
  };
}

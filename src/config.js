const snowflake = /^\d{17,20}$/;
export const helperModes = { instagram: 'oginstagram', tiktok: 'fxtiktok', twitter: 'fxembed', bluesky: 'fxembed', reddit: 'vxreddit', twitch: 'fxtwitch', snapchat: 'snapchatez' };
export function readConfig(env) {
  const testGuildId = env.TEST_GUILD_ID || env.DISCORD_GUILD_ID || null;
  if (testGuildId && !snowflake.test(testGuildId)) throw new Error('Invalid optional test server ID.');
  const channels = (env.TEST_CHANNEL_IDS || env.DISCORD_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (channels.some(id => !snowflake.test(id)) || (channels.length && !testGuildId)) throw new Error('Test channels require valid IDs and a test server.');
  const repostEnabled = env.REPOST_AS_AUTHOR === 'yes';
  if (repostEnabled && (!testGuildId || !channels.length)) throw new Error('Reposting requires an explicit server and channel allowlist.');
  const modes = {};
  for (const platform of ['instagram', 'tiktok', 'facebook', 'amazon', 'youtube', 'twitter', 'bluesky', 'reddit', 'twitch', 'snapchat', 'rednote', 'linkedin', 'upscrolled', 'mastodon']) {
    const sharingApproved = env.PROVIDER_SHARING_APPROVED === 'yes' || (platform === 'instagram' && env.INSTAGRAM_SHARING_APPROVED === 'yes');
    const defaultMode = ['amazon', 'youtube'].includes(platform) ? 'native'
      : sharingApproved && helperModes[platform] ? helperModes[platform] : 'card';
    const mode = env[`${platform.toUpperCase()}_MODE`] ?? defaultMode;
    if (!['card', 'native', 'off', helperModes[platform]].filter(Boolean).includes(mode)) throw new Error(`Invalid ${platform} mode.`);
    if (platform === 'mastodon' && mode === 'native') throw new Error('Mastodon native media requires content-warning verification; use card or off.');
    if (mode === helperModes[platform] && !sharingApproved) throw new Error('Provider sharing must be approved before selecting proxy modes.');
    modes[platform] = mode;
  }
  return { testGuildId, channelIds: new Set(channels), modes, repostEnabled,
    previewsDisabled: env.PREVIEWS_DISABLED === 'yes' || env.REQUIRE_VERIFIED_SAFE_CONTENT === 'yes' };
}

import { Client, Events, GatewayIntentBits, Options } from 'discord.js';
import { readConfig } from './config.js';
import { createHandler } from './handler.js';
import { canSendPreview } from './permissions.js';
import { createReposter } from './repost.js';
import { openOwnershipStore } from './ownership.js';
import { createManagementHandler, COMMAND } from './manage-post.js';

let config;
try { config = readConfig(process.env); } catch (error) { console.error(error.message); process.exit(1); }
if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is missing. Use an approved local secret mechanism; never send tokens in chat.');
  process.exit(1);
}
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, MessageManager: 0 }),
  allowedMentions: { parse: [], repliedUser: false }
});
let owners;
try { owners = await openOwnershipStore(); } catch { console.error('ownership_store_unavailable'); process.exit(1); }
const manage = createManagementHandler(owners, config, event => console.warn(event));
client.on(Events.InteractionCreate, interaction => { void manage(interaction).catch(() => console.warn('manage_interaction_failed')); });
const handle = createHandler(config, {
  log: event => console.warn(event),
  repost: (message, payload, displayContent) => createReposter(client.user, event => console.warn(event), owners)(message, payload, displayContent),
  canSend: message => canSendPreview(message, client.user)
});
client.on(Events.MessageCreate, message => { void handle(message).catch(() => console.warn('message_handler_failed')); });
client.once(Events.ClientReady, async () => {
  console.info('link_embedder_ready');
  if (config.repostEnabled && config.testGuildId) {
    try {
      await client.application.commands.create({name:COMMAND,type:3}, config.testGuildId);
      console.info('manage_post_command_ready');
    } catch { console.warn('manage_post_command_registration_failed'); }
  }
});
client.on(Events.Error, () => console.warn('discord_client_error'));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { client.destroy(); process.exit(0); });
try { await client.login(process.env.DISCORD_TOKEN); } catch { console.error('discord_login_failed'); client.destroy(); process.exitCode = 1; }

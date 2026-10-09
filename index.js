// Hosting entry point: preserve explicitly supplied environment variables.
import { loadEnvFile } from 'node:process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
try { loadEnvFile('.env'); } catch (error) {
  if (error.code !== 'ENOENT') { console.error('environment_file_invalid'); process.exit(1); }
}
// Non-secret pilot controls can be changed without opening the token file.
try {
  const pilot = parseEnv(readFileSync('pilot.env', 'utf8'));
  const allowed = new Set(['TEST_GUILD_ID', 'TEST_CHANNEL_IDS', 'PROVIDER_SHARING_APPROVED', 'PREVIEWS_DISABLED', 'REPOST_AS_AUTHOR']);
  if (Object.keys(pilot).some(key => !allowed.has(key))) throw new Error('Invalid pilot setting');
  Object.assign(process.env, pilot);
} catch (error) {
  if (error.code !== 'ENOENT') { console.error('pilot_file_invalid'); process.exit(1); }
}
await import('./src/index.js');

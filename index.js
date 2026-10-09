// Hosting entry point: preserve explicitly supplied environment variables.
import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env'); } catch (error) {
  if (error.code !== 'ENOENT') { console.error('environment_file_invalid'); process.exit(1); }
}
await import('./src/index.js');

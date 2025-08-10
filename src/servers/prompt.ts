#!/usr/bin/env node
import { PromptServer } from './PromptServer.js';
import { ServerRegistry } from '../registry/ServerRegistry.js';
import { CONFIG } from '../config/index.js';
import { Logger } from '../utils/logger.js';
import { pathToFileURL } from 'url';

async function main() {
  // Register this server
  ServerRegistry.register({
    name: 'prompt',
    description: 'MCP server providing prompt library management with full CRUD operations',
    serverClass: PromptServer,
    config: CONFIG.SERVERS.PROMPT,
    entryPoint: 'dist/servers/prompt.js',
  });

  // Start the server
  const server = new PromptServer(CONFIG.SERVERS.PROMPT);
  await server.run();
}

// Only run when executed directly (not when imported)
try {
  const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
  if (isMain) {
    main().catch((error) => {
      Logger.error('Failed to start Prompt MCP server', error);
      console.error(error);
      process.exit(1);
    });
  }
} catch (error) {
  // Fallback: if detection fails, do not auto-start on import
  // This ensures importing this module never starts the server unintentionally.
}
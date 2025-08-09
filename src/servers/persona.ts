#!/usr/bin/env node
import { PersonaServer } from './PersonaServer.js';
import { ServerRegistry } from '../registry/ServerRegistry.js';
import { CONFIG } from '../config/index.js';
import { Logger } from '../utils/logger.js';
import { pathToFileURL } from 'url';

async function main() {
  // Register this server
  ServerRegistry.register({
    name: 'persona',
    description: 'MCP server providing AI persona management and switching capabilities',
    serverClass: PersonaServer,
    config: CONFIG.SERVERS.PERSONA,
    entryPoint: 'dist/servers/persona.js',
  });

  // Start the server
  const server = new PersonaServer(CONFIG.SERVERS.PERSONA);
  await server.run();
}

// Only run when executed directly (not when imported)
try {
  const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
  if (isMain) {
    main().catch((error) => {
      Logger.error('Failed to start Persona MCP server', error);
      console.error(error);
      process.exit(1);
    });
  }
} catch (error) {
  // Fallback: if detection fails, do not auto-start on import
  // This ensures importing this module never starts the server unintentionally.
}
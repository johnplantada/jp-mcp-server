import { PersonaServer } from './PersonaServer.js';
import { ServerRegistry } from '../registry/ServerRegistry.js';
import { CONFIG } from '../config/index.js';

// Register the Persona server without starting it. This file is safe to import from the CLI.
ServerRegistry.register({
  name: 'persona',
  description: 'MCP server providing AI persona management and switching capabilities',
  serverClass: PersonaServer,
  config: CONFIG.SERVERS.PERSONA,
  entryPoint: 'dist/servers/persona.js',
});

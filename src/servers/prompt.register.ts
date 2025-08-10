import { PromptServer } from './PromptServer.js';
import { ServerRegistry } from '../registry/ServerRegistry.js';
import { CONFIG } from '../config/index.js';

// Register the Prompt server without starting it. This file is safe to import from the CLI.
ServerRegistry.register({
  name: 'prompt',
  description: 'MCP server providing prompt library management with full CRUD operations',
  serverClass: PromptServer,
  config: CONFIG.SERVERS.PROMPT,
  entryPoint: 'dist/servers/prompt.js',
});
#!/usr/bin/env node
import { ServerRegistry } from '../registry/ServerRegistry.js';
import { Logger } from '../utils/logger.js';

// Import servers to register them
import '../servers/persona.register.js';

function showUsage(): void {
  console.log('Usage: npm run server <server-name>');
  console.log('\nAvailable servers:');
  const servers = ServerRegistry.getAllServers();
  servers.forEach(server => {
    console.log(`  ${server.name} - ${server.description}`);
  });
  console.log('\nExamples:');
  console.log('  npm run server persona');
}

function listServers(): void {
  console.log('Registered MCP Servers:');
  console.log('======================');
  const servers = ServerRegistry.getAllServers();
  servers.forEach(server => {
    console.log(`\n📦 ${server.name} (${server.config.version})`);
    console.log(`   Description: ${server.description}`);
    console.log(`   Entry Point: ${server.entryPoint}`);
    console.log(`   Config: ${JSON.stringify(server.config, null, 2)}`);
  });
}

async function startServer(serverName: string): Promise<void> {
  try {
    Logger.info(`Starting server: ${serverName}`);
    const server = ServerRegistry.createServer(serverName);
    await server.run();
  } catch (error) {
    Logger.error(`Failed to start server: ${serverName}`, error);
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  showUsage();
  process.exit(1);
}

const command = args[0];

switch (command) {
  case 'list':
    listServers();
    break;
  case 'help':
  case '--help':
  case '-h':
    showUsage();
    break;
  default:
    if (ServerRegistry.getServer(command)) {
      startServer(command);
    } else {
      console.error(`Unknown server: ${command}`);
      showUsage();
      process.exit(1);
    }
    break;
}
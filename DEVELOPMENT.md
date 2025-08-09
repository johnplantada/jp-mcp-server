# Development Guide

This guide explains the architecture and development patterns used in the JP MCP Server project.

## 🏗️ Architecture Overview

The project uses a modular, scalable architecture that allows for easy addition of new MCP servers while maintaining consistency and code reuse.

### Core Components

1. **McpServerBase** - Abstract base class for all MCP servers
2. **ServerRegistry** - Discovery and management system for servers
3. **Configuration System** - Centralized configuration management
4. **Utilities** - Shared utilities (logging, error handling, schema building)
5. **Type System** - Comprehensive TypeScript type definitions

## 🔧 Creating a New MCP Server

### Step 1: Define Types

Add your server's types to `src/types/index.ts`.

### Step 2: Add Configuration

Update `src/config/index.ts` with your server config block and entry in `SERVERS`.

### Step 3: Create the Server Class

Create `src/servers/MyNewServer.ts` extending `McpServerBase` and register tools using `SchemaBuilder`.

### Step 4: Registration-only Module (import-safe)

Create `src/servers/my-new-server.register.ts` that only calls `ServerRegistry.register(...)` without starting the server. This file is safe to import from the CLI.

```typescript
import { MyNewServer } from './MyNewServer.js';
import { ServerRegistry } from '../registry/ServerRegistry.js';
import { CONFIG } from '../config/index.js';

ServerRegistry.register({
  name: 'my-new-server',
  description: 'My new server',
  serverClass: MyNewServer,
  config: CONFIG.SERVERS.MY_NEW_SERVER,
  entryPoint: 'dist/servers/my-new-server.js',
});
```

### Step 5: Executable Entry with ESM Main-check

Create `src/servers/my-new-server.ts` that registers and starts the server only when run directly.

```typescript
#!/usr/bin/env node
import { MyNewServer } from './MyNewServer.js';
import { ServerRegistry } from '../registry/ServerRegistry.js';
import { CONFIG } from '../config/index.js';
import { pathToFileURL } from 'url';

async function main() {
  ServerRegistry.register({
    name: 'my-new-server',
    description: 'My new server',
    serverClass: MyNewServer,
    config: CONFIG.SERVERS.MY_NEW_SERVER,
    entryPoint: 'dist/servers/my-new-server.js',
  });
  const server = new MyNewServer(CONFIG.SERVERS.MY_NEW_SERVER);
  await server.run();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}
```

### Step 6: Update the CLI Runner

Import the register-only file (not the executable) in `src/cli/runner.ts`:

```typescript
import '../servers/my-new-server.register.js';
```

### Step 7: Add Scripts

```json
{
  "scripts": {
    "dev:my-new-server": "tsx src/servers/my-new-server.ts",
    "start:my-new-server": "node dist/servers/my-new-server.js"
  }
}
```

## 🛠️ Development Patterns

### Error Handling

Wrap async tool handlers with `McpErrorHandler.handleAsync()`.

### Logging

Use the centralized `Logger` throughout servers for consistent output.

### Schema Building

Define tool schemas using `SchemaBuilder` utilities.

### Response Creation

Use `createResponse` and `createJsonResponse` from `McpServerBase`.

## 🧪 Testing

- Jest + ts-jest configured for ES modules.
- Prefer ESM-friendly mocking. Align Jest/ts-jest versions.
- Use environment variables to override config in tests where possible (e.g., persona storage path).

## 🔄 Configuration Management

Support environment variables in `src/config/index.ts` as needed for runtime customization.

## 🚀 Running

```bash
npm run server:list   # Lists registered servers (no side effects)
npm run dev:persona   # Starts persona server in dev mode
npm run start:persona # Starts persona server from build
```
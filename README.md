# JP MCP Server

A Model Context Protocol (MCP) implementation providing AI persona capabilities with a shared, scalable architecture.

## 📚 Documentation

- **[User Guide](./docs/USER_GUIDE.md)** - Comprehensive guide for using all features
- **[CI/CD Documentation](./CICD.md)** - GitHub Actions workflows and automation
- **[Testing Guide](./TESTING.md)** - Running and writing tests
- **[Manual Test Cases](./MANUAL_TEST_CASES.md)** - Manual testing procedures

## 🚀 Features

### Persona Server
- AI persona management and switching
- Pre-configured personas (Expert Developer, Friendly Tutor, Creative Innovator, etc.)
- Custom persona creation and modification
- Persona generation from natural language descriptions
- Persistent storage of personas and settings
- **NEW:** Expired persona recovery with 24-hour grace period
- **NEW:** Persona blending for complex multi-domain tasks
- **NEW:** Usage statistics and smart recommendations

## 📦 Installation

```bash
npm install
```

## 🔨 Build

```bash
npm run build
```

## 🖥️ Usage

### Running Servers

```bash
# List available servers (does not start servers)
npm run server:list

# Persona server (development)
npm run dev:persona

# Persona server (production)
npm run start:persona

# Using the CLI runner
npm run server persona
```

## 🏗️ Architecture

The project uses a shared architecture pattern that promotes code reuse and consistency across MCP servers:

```
src/
├── base/           # Shared base classes
│   └── McpServerBase.ts
├── config/         # Configuration management
│   └── index.ts
├── servers/        # MCP servers
│   ├── PersonaServer.ts        # Persona server implementation
│   ├── persona.register.ts     # Registration-only (no side effects)
│   └── persona.ts              # Executable entry point (starts server)
├── types/          # TypeScript type definitions
│   └── index.ts
├── utils/          # Shared utilities
│   ├── logger.ts
│   ├── errors.ts
│   ├── schemaBuilder.ts
│   └── personaUtils.ts
├── registry/       # Server discovery and management
│   └── ServerRegistry.ts
└── cli/            # Command-line interface
    └── runner.ts
```

Notes:
- The CLI imports the register-only file (e.g., `persona.register.ts`) to avoid starting servers on import.
- Executable entries (e.g., `persona.ts`) guard startup behind an ESM main-check.

## 🎭 Persona Server Tools

### Core Persona Management
1. **list_personas** - List all available AI personas (includes expired persona notifications)
2. **get_active_persona** - Get the currently active persona
3. **switch_persona** - Switch to a different AI persona
4. **get_persona_details** - Get detailed information about a specific persona
5. **create_custom_persona** - Create a new custom persona
6. **delete_persona** - Delete a persona
7. **get_persona_prompt** - Get the system prompt for the active persona
8. **generate_persona** - Generate a new persona from a description
9. **update_persona** - Update an existing persona
10. **set_default_persona** - Set the default persona for server startup

### Persona Blending & Management
11. **blend_personas** - Create temporary blended personas combining multiple personas (1-hour TTL)
12. **suggest_persona** - Get intelligent persona suggestions based on task context
13. **get_persona_stats** - View usage statistics and analytics
14. **reset_persona_stats** - Reset usage statistics
15. **get_smart_recommendations** - Get AI-powered persona recommendations

### Expired Persona Recovery
16. **list_expired_personas** - List expired blended personas available for promotion (24-hour grace period)
17. **promote_expired_persona** - Convert an expired blended persona into a permanent saved persona

### Advanced Features
18. **save_ai_generated_persona** - Save AI-generated personas to permanent storage
19. **request_persona_generation** - Request AI generation of new personas

## 📍 Persona Storage & Expiration

### Permanent Storage
Personas are stored in: `~/.mcp-personas.json`

The file contains:
- Array of all persona objects
- Currently active persona ID
- Default persona ID for startup

### Temporary Persona Management
- **Blended Personas**: Created with 1-hour expiration
- **Expired Personas**: Moved to 24-hour grace period after expiration
- **Recovery Window**: Users can promote expired personas to permanent storage
- **Final Cleanup**: Expired personas are permanently deleted after 24 hours

### Expiration Lifecycle
1. **Active (1 hour)** → Blended persona is available for use
2. **Expired (24 hour grace)** → Persona moved to expired collection, available for promotion
3. **Permanent Deletion** → Expired persona is permanently removed from system

## 🔄 Adding New Servers

1. Create a server class extending `McpServerBase`:

```typescript
import { McpServerBase } from '../base/McpServerBase.js';

export class MyNewServer extends McpServerBase {
  protected setupTools(): void {
    this.registerTool('my_tool', this.handleMyTool.bind(this), schema);
  }

  private async handleMyTool(args: any) {
    return this.createResponse('Hello from my tool!');
  }
}
```

2. Create a register-only file (import-safe):

```typescript
// src/servers/my-new-server.register.ts
import { MyNewServer } from './MyNewServer.js';
import { ServerRegistry } from '../registry/ServerRegistry.js';

ServerRegistry.register({
  name: 'my-new-server',
  description: 'Description of my server',
  serverClass: MyNewServer,
  config: { name: 'my-new-server', version: '1.0.0' },
  entryPoint: 'dist/servers/my-new-server.js',
});
```

3. Create an executable entry with ESM main-check:

```typescript
// src/servers/my-new-server.ts
#!/usr/bin/env node
import { MyNewServer } from './MyNewServer.js';
import { ServerRegistry } from '../registry/ServerRegistry.js';
import { pathToFileURL } from 'url';

async function main() {
  ServerRegistry.register({
    name: 'my-new-server',
    description: 'Description of my server',
    serverClass: MyNewServer,
    config: { name: 'my-new-server', version: '1.0.0' },
    entryPoint: 'dist/servers/my-new-server.js',
  });

  const server = new MyNewServer({ name: 'my-new-server', version: '1.0.0' });
  await server.run();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}
```

4. Update CLI runner to import the register file:

```typescript
// src/cli/runner.ts
import '../servers/my-new-server.register.js';
```

5. Add scripts to package.json:

```json
{
  "scripts": {
    "dev:my-new-server": "tsx src/servers/my-new-server.ts",
    "start:my-new-server": "node dist/servers/my-new-server.js"
  }
}
```

## 🔧 Configuration

Server configurations are managed in `src/config/index.ts`.

## 🛠️ Development

```bash
# Development mode (with hot reload)
npm run dev:persona

# List registered servers
npm run server:list
```

## 🧪 Integration with MCP Clients

### Claude Code Configuration

```json
{
  "mcpServers": {
    "persona": {
      "command": "node",
      "args": ["/path/to/jp-mcp-server/dist/servers/persona.js"]
    }
  }
}
```

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "persona": {
      "command": "node",
      "args": ["/Users/username/path/to/jp-mcp-server/dist/servers/persona.js"]
    }
  }
}
```

## 📝 Available Personas

Default personas available on first run:
- **Expert Developer** - Senior software engineer with deep technical expertise
- **Friendly Tutor** - Patient programming teacher for beginners
- **Creative Innovator** - Out-of-the-box thinker for innovative solutions
- **Efficiency Optimizer** - Performance and productivity specialist
- **Security Guardian** - Cybersecurity expert focused on secure coding

You can create unlimited custom personas tailored to your specific needs. See the [User Guide](./docs/USER_GUIDE.md) for detailed instructions.

## 🚀 CI/CD Pipeline

This project uses comprehensive GitHub Actions workflows for continuous integration, automated code review, and deployment. See [CICD.md](./CICD.md) for detailed documentation.

### Workflows:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI** | Push to main/feature branches | Tests on Node.js 18.x & 20.x, builds, coverage |
| **PR Validation** | Pull requests | Validates, tests, and comments with results |
| **Code Review** | PR with code changes | ESLint, security scan, complexity analysis |
| **Release** | Version tags or manual | NPM publishing and GitHub releases |

### Features:
- ✅ **Automated Testing**: Multi-version Node.js testing with 88.75% coverage
- 🤖 **AI Code Review**: GitHub Copilot integration for intelligent PR feedback
- 🔒 **Security Scanning**: Automated detection of vulnerabilities and secrets
- 📊 **Code Quality**: ESLint analysis and complexity metrics
- 📦 **Automated Publishing**: NPM and GitHub Packages release automation
- 💬 **PR Comments**: Automated feedback with coverage and validation results

## 🤝 Contributing

- Follow the established architecture patterns
- Use the shared utilities (Logger, SchemaBuilder, ErrorHandler)
- Add proper TypeScript types
- Register your server in the ServerRegistry (register-only file)
- Ensure all tests pass (`npm test`)
- Follow conventional commit format
- Update documentation

## 📄 License

MIT
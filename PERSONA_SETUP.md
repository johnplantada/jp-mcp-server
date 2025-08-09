# AI Persona MCP Server Setup Guide

This guide will walk you through setting up the AI Persona MCP server for Claude Code, Claude Desktop, and GitHub Copilot.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Claude Code Configuration](#claude-code-configuration)
- [Claude Desktop Configuration](#claude-desktop-configuration)
- [GitHub Copilot Configuration](#github-copilot-configuration)
- [Available Personas](#available-personas)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

## Prerequisites

1. Node.js 18+ installed
2. npm or yarn package manager
3. Git (for cloning the repository)

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd jp-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript files:
```bash
npm run build
```

4. Test the persona server locally:
```bash
npm run dev:persona
```

## Claude Code Configuration

Claude Code uses the `claude_code_config.json` file for MCP server configuration.

1. Create or edit `~/.claude/claude_code_config.json`:

```json
{
  "mcpServers": {
    "persona": {
      "command": "node",
      "args": ["/absolute/path/to/jp-mcp-server/dist/servers/persona.js"],
      "env": {}
    }
  }
}
```

2. Replace the path with the absolute path to your local build.
3. Restart Claude Code or reload the configuration.

## Claude Desktop Configuration

### macOS Configuration

1. Open Claude Desktop settings
2. Navigate to Developer → Edit Config
3. Add the persona server configuration:

```json
{
  "mcpServers": {
    "persona": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/path/to/jp-mcp-server/dist/servers/persona.js"]
    }
  }
}
```

### Windows Configuration

```json
{
  "mcpServers": {
    "persona": {
      "command": "node",
      "args": ["C:\\Users\\YOUR_USERNAME\\path\\to\\jp-mcp-server\\dist\\servers\\persona.js"]
    }
  }
}
```

### Linux Configuration

```json
{
  "mcpServers": {
    "persona": {
      "command": "node",
      "args": ["/home/YOUR_USERNAME/path/to/jp-mcp-server/dist/servers/persona.js"]
    }
  }
}
```

## GitHub Copilot Configuration

GitHub Copilot can connect via an MCP bridge.

1. Install the MCP bridge for Copilot:
```bash
npm install -g @modelcontextprotocol/copilot-bridge
```

2. Create a configuration file `~/.copilot/mcp-config.json`:

```json
{
  "servers": {
    "persona": {
      "command": "node",
      "args": ["/absolute/path/to/jp-mcp-server/dist/servers/persona.js"],
      "description": "AI Persona switching server"
    }
  }
}
```

3. Start the MCP bridge:
```bash
mcp-copilot-bridge --config ~/.copilot/mcp-config.json
```

## Available Personas

The server comes with 5 pre-configured personas:

1. Expert Developer (`expert-developer`)
2. Friendly Tutor (`friendly-tutor`)
3. Creative Innovator (`creative-innovator`)
4. Efficiency Optimizer (`efficiency-optimizer`)
5. Security Guardian (`security-guardian`)

## Usage Examples

### Listing Available Personas

```javascript
await mcp.call('persona', 'list_personas', {});
```

### Switching Personas

```javascript
await mcp.call('persona', 'switch_persona', { persona_id: 'friendly-tutor' });
```

### Getting Active Persona Details

```javascript
await mcp.call('persona', 'get_active_persona', {});
```

### Creating a Custom Persona

```javascript
await mcp.call('persona', 'create_custom_persona', {
  id: 'code-documenter',
  name: 'Code Documenter',
  description: 'Specializes in writing clear, comprehensive documentation',
  system_prompt: 'You are an expert technical writer who creates clear, comprehensive documentation.'
});
```

### Getting Persona System Prompt

```javascript
await mcp.call('persona', 'get_persona_prompt', {});
```

## Troubleshooting

### Server Not Connecting
- Verify the path is absolute
- Check Node.js: `node --version`
- Build before using from MCP client: `npm run build`
- Try locally: `npm run dev:persona`

### Module Not Found
- Reinstall: `rm -rf node_modules package-lock.json && npm install`
- Rebuild: `npm run build`

### Persona Not Switching
- Confirm persona_id via `list_personas`
- Verify response from `switch_persona`

### Custom Personas Not Persisting
- The server persists personas to `~/.mcp-personas.json`. If changes aren’t visible:
  - Ensure your client is connected to the built server (`dist/servers/persona.js`)
  - Verify that file permissions allow writing

### Logs
- Logs are written to stderr for MCP compatibility. Use your client’s log viewer or redirect stderr if needed.
# JP-MCP-Server User Guide

## Table of Contents
1. [Overview](#overview)
2. [Installation & Setup](#installation--setup)
3. [Core Features](#core-features)
4. [Persona Management](#persona-management)
5. [Prompt Library](#prompt-library)
6. [Advanced Features](#advanced-features)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Troubleshooting](#troubleshooting)

## Overview

JP-MCP-Server is a powerful Model Context Protocol (MCP) server that enhances AI interactions through dynamic persona management and prompt templating. It allows you to:

- 🎭 Switch between different AI personas for specialized assistance
- 📝 Create and manage reusable prompt templates
- 🔄 Blend multiple personas for complex tasks
- ⏰ Recover expired personas within a 24-hour grace period
- 📊 Track persona usage statistics and get smart recommendations

## Installation & Setup

### Prerequisites
- Node.js 18.x or 20.x
- npm or yarn package manager
- Claude Desktop or any MCP-compatible client

### Quick Start

1. **Clone the repository:**
```bash
git clone https://github.com/johnplantada/jp-mcp-server.git
cd jp-mcp-server
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
```bash
npm run build
```

4. **Configure Claude Desktop:**
Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "jp-mcp-server": {
      "command": "node",
      "args": ["/path/to/jp-mcp-server/dist/servers/PersonaServer.js"]
    },
    "jp-prompt-server": {
      "command": "node",
      "args": ["/path/to/jp-mcp-server/dist/servers/prompt.js"]
    }
  }
}
```

5. **Restart Claude Desktop** to load the MCP servers.

## Core Features

### Available MCP Tools

The server provides the following tools accessible in Claude:

#### Persona Tools
- `persona:list_personas` - View all available personas
- `persona:switch_persona` - Switch to a different persona
- `persona:get_active_persona` - Check current active persona
- `persona:create_custom_persona` - Create your own persona
- `persona:delete_persona` - Remove a persona
- `persona:set_default_persona` - Set startup default

#### Prompt Tools
- `prompt:list_prompts` - View saved prompt templates
- `prompt:get_prompt` - Retrieve and use a prompt
- `prompt:create_prompt` - Save a new prompt template
- `prompt:update_prompt` - Modify existing prompts
- `prompt:search_prompts` - Find prompts by keywords

## Persona Management

### Built-in Personas

The server comes with 5 default personas that are automatically created on first run:

1. **Expert Developer** - A senior software engineer with 15+ years experience
   - Expertise: architecture, design patterns, performance optimization, code review
   - Style: Formal and technical

2. **Friendly Tutor** - A patient and encouraging programming teacher
   - Expertise: teaching, simplifying concepts, beginner-friendly explanations
   - Style: Casual and encouraging

3. **Creative Innovator** - An out-of-the-box thinker focused on innovative solutions
   - Expertise: innovation, brainstorming, emerging technologies, creative problem-solving
   - Style: Enthusiastic and imaginative

4. **Efficiency Optimizer** - A performance and productivity specialist
   - Expertise: performance tuning, optimization, refactoring, workflow improvement
   - Style: Direct and concise

5. **Security Guardian** - A cybersecurity expert focused on secure coding practices
   - Expertise: security best practices, vulnerability assessment, secure coding, threat modeling
   - Style: Serious and informative

**Note:** Additional personas you've created (like Neovim Expert, Career Pivot Coach, etc.) are saved in your personal configuration and persist across sessions.

### Creating Custom Personas

You can create personas in two ways:

#### 1. Manual Creation
```
Tool: persona:create_custom_persona
Parameters:
- id: "unique-id"
- name: "Persona Name"
- description: "Brief description"
- system_prompt: "Detailed behavior instructions"
- traits: ["trait1", "trait2"]
- communication_style: "How they communicate"
- expertise: ["area1", "area2"]
```

#### 2. AI-Generated Personas
```
Tool: persona:generate_persona
Parameters:
- description: "a pirate who loves coding"
```

The AI will generate a complete persona based on your description.

### Persona Switching

#### Manual Switch
```
Tool: persona:switch_persona
Parameters:
- persona_id: "expert-developer"
```

#### Auto-Switch Based on Context
```
Tool: persona:auto_switch_persona
Parameters:
- context: "debug this Python code"
- confidence_threshold: 0.7 (optional)
```

The system will automatically select the best persona for your task.

### Persona Blending

For complex multi-domain tasks, blend multiple personas:

```
Tool: persona:blend_personas
Parameters:
- persona_ids: ["security-guardian", "efficiency-optimizer"]
- task: "optimize web app security"
- blend_mode: "merge" (optional)
```

**Note:** Blended personas are temporary (1 hour) but can be promoted if valuable.

## Prompt Library

### Using Saved Prompts

The prompt library stores reusable templates with variable substitution:

```
Tool: prompt:get_prompt
Parameters:
- id: "code-review-js"
- variables: {
    "code": "your code here",
    "focus_areas": "performance, security"
  }
```

### Creating Prompt Templates

Save frequently used prompts for reuse:

```
Tool: prompt:create_prompt
Parameters:
- id: "my-template"
- name: "My Template Name"
- content: "Analyze {{input}} focusing on {{aspects}}"
- variables: ["input", "aspects"]
- category: "analysis"
```

Variables use `{{variable_name}}` syntax and are substituted at runtime.

### Searching Prompts

Find relevant prompts quickly:

```
Tool: prompt:search_prompts
Parameters:
- query: "debug"
- category: "debugging" (optional)
- max_results: 10
```

## Advanced Features

### Expired Persona Recovery

Blended personas expire after 1 hour but remain recoverable for 24 hours:

1. **Check for expired personas:**
```
Tool: persona:list_expired_personas
```

2. **Recover valuable blends:**
```
Tool: persona:promote_expired_persona
Parameters:
- persona_id: "blend_1234567890"
```

### Intelligent Persona Suggestions

Get recommendations based on your task:

```
Tool: persona:suggest_persona
Parameters:
- task_description: "write unit tests for React components"
```

Returns top 3 personas with confidence scores and reasoning.

### Usage Statistics

Track persona effectiveness:

```
Tool: persona:get_persona_stats
Parameters:
- persona_id: "expert-developer" (optional)
```

View usage counts, average session duration, and success rates.

### Smart Recommendations

Get personalized suggestions based on usage patterns:

```
Tool: persona:get_smart_recommendations
Parameters:
- context: "current task description"
```

## CI/CD Pipeline

The project includes comprehensive GitHub Actions workflows:

### Workflow Status
- **CI Pipeline** - Runs tests on Node.js 18.x and 20.x
- **PR Validation** - Automated testing and coverage reports
- **Code Review** - Copilot integration for automated reviews
- **Release** - NPM publishing on version tags

### Running Tests Locally

```bash
# Run all tests with coverage
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Check TypeScript compilation
npm run typecheck
```

### Code Coverage
- Current coverage: **88.75%**
- Coverage reports available in CI logs
- Target: >85% for all new features

## Troubleshooting

### Common Issues

#### 1. Persona Not Switching
- Verify persona ID with `persona:list_personas`
- Check if persona exists before switching
- Look for typos in persona_id

#### 2. Prompt Variables Not Substituting
- Ensure variable names match exactly
- Use double curly braces: `{{variable}}`
- Check all required variables are provided

#### 3. MCP Connection Issues
- Restart Claude Desktop after config changes
- Verify file paths in configuration
- Check Node.js version compatibility

#### 4. Expired Personas Not Showing
- Expired personas appear in `list_expired_personas`
- They're automatically cleaned after 24 hours
- Promote valuable ones before cleanup

### Debug Mode

Enable debug logging by setting environment variable:
```bash
export DEBUG=mcp:*
```

### Getting Help

1. Check existing issues: [GitHub Issues](https://github.com/johnplantada/jp-mcp-server/issues)
2. Review test files for usage examples
3. Examine the comprehensive test coverage for edge cases

## Best Practices

### Persona Management
- Set a default persona for consistent startup behavior
- Create specialized personas for recurring tasks
- Use persona blending for complex, multi-domain problems
- Promote valuable blended personas before expiration

### Prompt Library
- Create templates for frequently used patterns
- Use descriptive IDs and names
- Include clear variable names
- Categorize prompts for easy discovery

### Performance
- Avoid creating too many temporary personas
- Clean up unused custom personas periodically
- Use auto-switch with appropriate confidence thresholds
- Monitor persona statistics to identify effective combinations

## Version History

### Latest: Feature/Expired-Persona-Recovery
- ✅ 24-hour grace period for expired personas
- ✅ Recovery tools for valuable blends
- ✅ Enhanced notification system
- ✅ 167 tests passing with 88.75% coverage

### Previous Updates
- Comprehensive CI/CD pipeline
- Automated Copilot code reviews
- Persona name update functionality
- Code refactoring and optimization

## Contributing

See [CONTRIBUTING.md](https://github.com/johnplantada/jp-mcp-server/blob/main/CONTRIBUTING.md) for development guidelines.

---

*Built with ❤️ by John Plantada and Claude*
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '../utils/logger.js';
import type { McpTool, McpToolHandler, ServerConfig } from '../types/index.js';

export abstract class McpServerBase {
  protected server: Server;
  protected tools: Map<string, McpToolHandler> = new Map();

  constructor(protected config: ServerConfig) {
    Logger.info(`Initializing ${config.name} MCP server`);
    
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupBaseHandlers();
    this.setupTools();
    Logger.info(`${config.name} MCP server initialized successfully`);
  }

  private setupBaseHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      Logger.info(`Handling ListTools request for ${this.config.name}`);
      return {
        tools: Array.from(this.tools.keys()).map(name => this.getToolSchema(name)),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      Logger.info(`Handling tool request: ${request.params.name}`, { 
        server: this.config.name,
        arguments: request.params.arguments 
      });
      
      try {
        const handler = this.tools.get(request.params.name);
        if (!handler) {
          Logger.error(`Unknown tool requested: ${request.params.name}`);
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
        }

        return await handler(request.params.arguments);
      } catch (error) {
        Logger.error(`Error handling tool request: ${request.params.name}`, error);
        throw error;
      }
    });
  }

  protected registerTool(name: string, handler: McpToolHandler, schema: McpTool): void {
    this.tools.set(name, handler);
    // Store schema for later retrieval
    (this as any)._toolSchemas = (this as any)._toolSchemas || new Map();
    (this as any)._toolSchemas.set(name, schema);
  }

  private getToolSchema(name: string): McpTool {
    const schemas = (this as any)._toolSchemas || new Map();
    return schemas.get(name);
  }

  protected abstract setupTools(): void;

  async run(): Promise<void> {
    Logger.info(`Starting ${this.config.name} MCP server`);
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    Logger.info(`${this.config.name} MCP server connected and running on stdio`);
  }

  protected createResponse(content: string): { content: { type: string; text: string }[] } {
    return {
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
    };
  }

  protected createJsonResponse(data: any): { content: { type: string; text: string }[] } {
    return this.createResponse(JSON.stringify(data, null, 2));
  }
}
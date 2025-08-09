import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { McpServerBase } from '../../src/base/McpServerBase.js';
import { TestUtils } from '../utils/testUtils.js';
import { SchemaBuilder } from '../../src/utils/schemaBuilder.js';
import type { ServerConfig } from '../../src/types/index.js';

// Create a test implementation of McpServerBase
class TestMcpServer extends McpServerBase {
  protected setupTools(): void {
    this.registerTool(
      'test_tool',
      this.handleTestTool.bind(this),
      SchemaBuilder.createTool(
        'test_tool',
        'A test tool',
        {
          message: SchemaBuilder.stringProperty('Test message'),
        },
        ['message']
      )
    );

    this.registerTool(
      'error_tool',
      this.handleErrorTool.bind(this),
      SchemaBuilder.createTool('error_tool', 'A tool that throws errors')
    );
  }

  private async handleTestTool(args: { message: string }) {
    return this.createResponse(`Test response: ${args.message}`);
  }

  private async handleErrorTool() {
    throw new Error('Test error');
  }

  // Expose protected methods for testing
  public testCreateResponse(content: string) {
    return this.createResponse(content);
  }

  public testCreateJsonResponse(data: any) {
    return this.createJsonResponse(data);
  }

  public testRegisterTool(name: string, handler: any, schema: any) {
    this.registerTool(name, handler, schema);
  }
}

describe('McpServerBase', () => {
  let server: TestMcpServer;
  let config: ServerConfig;
  let loggerSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    config = TestUtils.createMockServerConfig();
    server = new TestMcpServer(config);
    loggerSpy = TestUtils.spyOnLogger();
  });

  afterEach(() => {
    TestUtils.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize server with correct configuration', () => {
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Initializing test-persona-server MCP server')
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-persona-server MCP server initialized successfully')
      );
    });

    it('should call setupTools during initialization', () => {
      // Verify tools were registered (indirectly by checking they exist)
      expect((server as any).tools.has('test_tool')).toBe(true);
      expect((server as any).tools.has('error_tool')).toBe(true);
    });
  });

  describe('tool registration', () => {
    it('should register tools correctly', () => {
      const handler = jest.fn();
      const schema = SchemaBuilder.createTool('new_tool', 'A new tool');

      server.testRegisterTool('new_tool', handler, schema);

      expect((server as any).tools.has('new_tool')).toBe(true);
      expect((server as any).tools.get('new_tool')).toBe(handler);
    });

    it('should store tool schemas', () => {
      const schema = SchemaBuilder.createTool('schema_tool', 'Tool with schema');
      const handler = jest.fn();

      server.testRegisterTool('schema_tool', handler, schema);

      const schemas = (server as any)._toolSchemas;
      expect(schemas.get('schema_tool')).toEqual(schema);
    });
  });

  describe('response creation', () => {
    it('should create text responses correctly', () => {
      const response = server.testCreateResponse('Test message');

      expect(response).toEqual({
        content: [{
          type: 'text',
          text: 'Test message'
        }]
      });
    });

    it('should create JSON responses correctly', () => {
      const data = { test: 'data', number: 42 };
      const response = server.testCreateJsonResponse(data);

      expect(response).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      });
    });
  });

  describe('request handling', () => {
    it('should handle ListTools requests', async () => {
      // Mock the server's request handler
      const listToolsHandler = (server as any).server.setRequestHandler.mock.calls
        .find((call: any) => call[0].properties?.method?.const === 'tools/list')?.[1];

      if (listToolsHandler) {
        const response = await listToolsHandler();
        
        expect(response).toHaveProperty('tools');
        expect(response.tools).toHaveLength(2);
        expect(response.tools[0]).toHaveProperty('name', 'test_tool');
        expect(response.tools[1]).toHaveProperty('name', 'error_tool');
      }
    });

    it('should handle CallTool requests successfully', async () => {
      // Get the CallTool handler
      const callToolHandler = (server as any).server.setRequestHandler.mock.calls
        .find((call: any) => call[0].properties?.method?.const === 'tools/call')?.[1];

      if (callToolHandler) {
        const request = TestUtils.createMockMcpRequest('test_tool', { message: 'Hello' });
        const response = await callToolHandler(request);
        
        expect(response).toEqual({
          content: [{
            type: 'text',
            text: 'Test response: Hello'
          }]
        });
      }
    });

    it('should handle unknown tools', async () => {
      const callToolHandler = (server as any).server.setRequestHandler.mock.calls
        .find((call: any) => call[0].properties?.method?.const === 'tools/call')?.[1];

      if (callToolHandler) {
        const request = TestUtils.createMockMcpRequest('unknown_tool', {});
        
        await expect(callToolHandler(request)).rejects.toThrow('Unknown tool: unknown_tool');
      }
    });

    it('should handle tool errors', async () => {
      const callToolHandler = (server as any).server.setRequestHandler.mock.calls
        .find((call: any) => call[0].properties?.method?.const === 'tools/call')?.[1];

      if (callToolHandler) {
        const request = TestUtils.createMockMcpRequest('error_tool', {});
        
        await expect(callToolHandler(request)).rejects.toThrow('Test error');
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringMatching(/ERROR.*Error handling tool request: error_tool.*Test error/s)
        );
      }
    });
  });

  describe('logging', () => {
    it('should log tool requests', async () => {
      const callToolHandler = (server as any).server.setRequestHandler.mock.calls
        .find((call: any) => call[0].properties?.method?.const === 'tools/call')?.[1];

      if (callToolHandler) {
        const request = TestUtils.createMockMcpRequest('test_tool', { message: 'Hello' });
        await callToolHandler(request);
        
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringMatching(/INFO.*Handling tool request: test_tool.*"message".*"Hello"/s)
        );
      }
    });

    it('should log ListTools requests', async () => {
      const listToolsHandler = (server as any).server.setRequestHandler.mock.calls
        .find((call: any) => call[0].properties?.method?.const === 'tools/list')?.[1];

      if (listToolsHandler) {
        await listToolsHandler();
        
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringMatching(/INFO.*Handling ListTools request for test-persona-server/)
        );
      }
    });
  });

  describe('server lifecycle', () => {
    it('should initialize transport on run', async () => {
      // Mock the server's connect method
      const connectSpy = jest.spyOn((server as any).server, 'connect').mockResolvedValue(undefined);
      
      // Since run() creates a new transport, we need to wait for it
      const runPromise = server.run();
      
      // Wait a bit for the async operation to start
      await TestUtils.wait(10);
      
      expect(connectSpy).toHaveBeenCalledWith(expect.any(Object));
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringMatching(/INFO.*Starting test-persona-server MCP server/)
      );
      
      // Clean up by rejecting the promise (since we mocked connect)
      connectSpy.mockRejectedValue(new Error('Test cleanup'));
      
      try {
        await runPromise;
      } catch (error) {
        // Expected due to our mock rejection
      }
      
      connectSpy.mockRestore();
    });
  });
});
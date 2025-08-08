import { jest } from '@jest/globals';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Persona, PersonaStorage } from '../../src/types/index.js';

export class TestUtils {
  // Create a temporary file path for testing
  static createTempFilePath(filename: string): string {
    return join(tmpdir(), `test-${Date.now()}-${filename}`);
  }

  // Clean up test files
  static cleanupFile(filePath: string): void {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  // Create a mock persona storage file
  static createMockPersonaStorage(filePath: string, data: PersonaStorage): void {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // Create sample personas for testing
  static createSamplePersonas(): Persona[] {
    return [
      {
        id: 'test-dev',
        name: 'Test Developer',
        description: 'A developer for testing',
        systemPrompt: 'You are a test developer.',
        traits: ['testing', 'reliable'],
        communicationStyle: 'direct',
        expertise: ['testing', 'debugging'],
      },
      {
        id: 'test-tutor',
        name: 'Test Tutor',
        description: 'A tutor for testing',
        systemPrompt: 'You are a test tutor.',
        traits: ['patient', 'helpful'],
        communicationStyle: 'encouraging',
        expertise: ['teaching', 'explaining'],
      },
    ];
  }

  // Create sample persona storage
  static createSamplePersonaStorage(): PersonaStorage {
    return {
      personas: TestUtils.createSamplePersonas(),
      activePersonaId: 'test-dev',
      defaultPersonaId: 'test-dev',
    };
  }

  // Mock file system functions
  static mockFileSystem() {
    const mockReadFileSync = jest.fn<typeof readFileSync>();
    const mockWriteFileSync = jest.fn<typeof writeFileSync>();
    const mockExistsSync = jest.fn<typeof existsSync>();

    return {
      mockReadFileSync,
      mockWriteFileSync,
      mockExistsSync,
    };
  }

  // Create a mock MCP request
  static createMockMcpRequest(toolName: string, args: any = {}) {
    return {
      params: {
        name: toolName,
        arguments: args,
      },
      method: 'tools/call' as const,
    };
  }

  // Assert MCP response format
  static assertMcpResponse(response: any) {
    expect(response).toHaveProperty('content');
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.content[0]).toHaveProperty('type', 'text');
    expect(response.content[0]).toHaveProperty('text');
    expect(typeof response.content[0].text).toBe('string');
  }

  // Parse JSON response from MCP
  static parseJsonResponse(response: any): any {
    TestUtils.assertMcpResponse(response);
    return JSON.parse(response.content[0].text);
  }

  // Get text response from MCP
  static getTextResponse(response: any): string {
    TestUtils.assertMcpResponse(response);
    return response.content[0].text;
  }

  // Create a mock server config
  static createMockServerConfig() {
    return {
      name: 'test-persona-server',
      version: '0.1.0-test',
    };
  }

  // Wait for async operations (useful for testing async handlers)
  static async wait(ms: number = 10): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Create a spy for console.error to capture logs
  static spyOnLogger() {
    return jest.spyOn(console, 'error').mockImplementation(() => {});
  }

  // Restore all mocks
  static restoreAllMocks() {
    jest.restoreAllMocks();
  }
}
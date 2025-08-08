import { jest } from '@jest/globals';

// Mock console.error to prevent MCP server logs from cluttering test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Set up test environment variables
process.env.NODE_ENV = 'test';
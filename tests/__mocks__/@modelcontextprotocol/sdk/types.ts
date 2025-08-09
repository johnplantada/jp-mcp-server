export const CallToolRequestSchema = { properties: { method: { const: 'tools/call' } } };
export const ListToolsRequestSchema = { properties: { method: { const: 'tools/list' } } };

export enum ErrorCode {
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InternalError = -32603,
}

export class McpError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
    this.name = 'McpError';
  }
}
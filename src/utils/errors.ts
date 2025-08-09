import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from './logger.js';

export class McpErrorHandler {
  static notFound(resource: string, id: string): McpError {
    const message = `${resource} not found: ${id}`;
    Logger.error(message);
    return new McpError(ErrorCode.InvalidRequest, message);
  }

  static alreadyExists(resource: string, id: string): McpError {
    const message = `${resource} with ID "${id}" already exists`;
    Logger.error(message);
    return new McpError(ErrorCode.InvalidRequest, message);
  }

  static invalidRequest(message: string): McpError {
    Logger.error(`Invalid request: ${message}`);
    return new McpError(ErrorCode.InvalidRequest, message);
  }

  static internalError(message: string, error?: any): McpError {
    Logger.error(`Internal error: ${message}`, error);
    return new McpError(ErrorCode.InternalError, message);
  }

  static methodNotFound(method: string): McpError {
    Logger.error(`Method not found: ${method}`);
    return new McpError(ErrorCode.MethodNotFound, `Unknown method: ${method}`);
  }

  static handleAsync<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    return operation().catch((error) => {
      Logger.error(`Error in ${context}`, error);
      if (error instanceof McpError) {
        throw error;
      }
      throw McpErrorHandler.internalError(`Failed to ${context}`, error);
    });
  }
}

// Common error messages as constants
export const ErrorMessages = {
  PERSONA_NOT_FOUND: (id: string) => `Persona not found: ${id}`,
  DOCUMENT_NOT_FOUND: (id: string) => `Document not found: ${id}`,
  PERSONA_ALREADY_EXISTS: (id: string) => `Persona with ID "${id}" already exists`,
  NO_ACTIVE_PERSONA: 'No active persona selected',
  ACTIVE_PERSONA_NOT_IN_REGISTRY: 'Active persona not found in registry',
  NO_DOCUMENTS_IN_INDEX: 'No documents in the search index',
} as const;
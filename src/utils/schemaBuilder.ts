import type { McpTool } from '../types/index.js';

export class SchemaBuilder {
  static createTool(
    name: string,
    description: string,
    properties: Record<string, any> = {},
    required: string[] = []
  ): McpTool {
    return {
      name,
      description,
      inputSchema: {
        type: 'object',
        properties,
        ...(required.length > 0 && { required }),
      },
    };
  }

  static stringProperty(description: string, defaultValue?: string): any {
    return {
      type: 'string',
      description,
      ...(defaultValue && { default: defaultValue }),
    };
  }

  static numberProperty(description: string, defaultValue?: number): any {
    return {
      type: 'number',
      description,
      ...(defaultValue !== undefined && { default: defaultValue }),
    };
  }

  static arrayProperty(description: string, itemType: string = 'string'): any {
    return {
      type: 'array',
      items: { type: itemType },
      description,
    };
  }

  static objectProperty(description: string, additionalProperties: boolean = true): any {
    return {
      type: 'object',
      description,
      additionalProperties,
    };
  }

  static emptyObjectSchema(): Record<string, any> {
    return {};
  }
}

// Predefined common schemas for reuse
export const CommonSchemas = {
  ID_PROPERTY: SchemaBuilder.stringProperty('Unique identifier'),
  QUERY_PROPERTY: SchemaBuilder.stringProperty('Search query'),
  LIMIT_PROPERTY: SchemaBuilder.numberProperty('Maximum number of results to return', 10),
  THRESHOLD_PROPERTY: SchemaBuilder.numberProperty('Minimum score threshold (0-1)', 0.6),
};
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

  // Generic property builder to eliminate repetition
  private static createProperty<T>(config: {
    type: string;
    description: string;
    defaultValue?: T;
    items?: { type: string };
    additionalProperties?: boolean;
  }): any {
    const property: any = {
      type: config.type,
      description: config.description,
    };
    
    // Only set default when explicitly provided (allow empty string/false/0)
    if (config.defaultValue !== undefined && config.defaultValue !== null) {
      property.default = config.defaultValue;
    }
    
    if (config.items) property.items = config.items;
    if (config.additionalProperties !== undefined) property.additionalProperties = config.additionalProperties;
    
    return property;
  }

  static stringProperty(description: string, defaultValue?: string): any {
    return SchemaBuilder.createProperty({
      type: 'string',
      description,
      defaultValue,
    });
  }

  static numberProperty(description: string, defaultValue?: number): any {
    return SchemaBuilder.createProperty({
      type: 'number',
      description,
      defaultValue,
    });
  }

  static arrayProperty(description: string, itemType: string = 'string'): any {
    return SchemaBuilder.createProperty({
      type: 'array',
      description,
      items: { type: itemType },
    });
  }

  static objectProperty(description: string, additionalProperties: boolean = true): any {
    return SchemaBuilder.createProperty({
      type: 'object',
      description,
      additionalProperties,
    });
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
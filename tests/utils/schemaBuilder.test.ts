import { describe, it, expect } from '@jest/globals';
import { SchemaBuilder, CommonSchemas } from '../../src/utils/schemaBuilder.js';

describe('SchemaBuilder', () => {
  describe('createTool', () => {
    it('should create basic tool schema', () => {
      const schema = SchemaBuilder.createTool('test_tool', 'A test tool');

      expect(schema).toEqual({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });
    });

    it('should create tool schema with properties', () => {
      const properties = {
        name: SchemaBuilder.stringProperty('Name field'),
        age: SchemaBuilder.numberProperty('Age field'),
      };
      const schema = SchemaBuilder.createTool('complex_tool', 'A complex tool', properties);

      expect(schema).toEqual({
        name: 'complex_tool',
        description: 'A complex tool',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name field',
            },
            age: {
              type: 'number',
              description: 'Age field',
            },
          },
        },
      });
    });

    it('should create tool schema with required fields', () => {
      const properties = {
        required_field: SchemaBuilder.stringProperty('Required field'),
        optional_field: SchemaBuilder.stringProperty('Optional field'),
      };
      const schema = SchemaBuilder.createTool(
        'required_tool',
        'Tool with required fields',
        properties,
        ['required_field']
      );

      expect(schema.inputSchema).toHaveProperty('required', ['required_field']);
    });

    it('should not include required field when empty', () => {
      const schema = SchemaBuilder.createTool('no_required_tool', 'Tool without required fields');

      expect(schema.inputSchema).not.toHaveProperty('required');
    });
  });

  describe('stringProperty', () => {
    it('should create string property', () => {
      const property = SchemaBuilder.stringProperty('Test string');

      expect(property).toEqual({
        type: 'string',
        description: 'Test string',
      });
    });

    it('should create string property with default value', () => {
      const property = SchemaBuilder.stringProperty('Test string with default', 'default_value');

      expect(property).toEqual({
        type: 'string',
        description: 'Test string with default',
        default: 'default_value',
      });
    });
  });

  describe('numberProperty', () => {
    it('should create number property', () => {
      const property = SchemaBuilder.numberProperty('Test number');

      expect(property).toEqual({
        type: 'number',
        description: 'Test number',
      });
    });

    it('should create number property with default value', () => {
      const property = SchemaBuilder.numberProperty('Test number with default', 42);

      expect(property).toEqual({
        type: 'number',
        description: 'Test number with default',
        default: 42,
      });
    });

    it('should handle zero as default value', () => {
      const property = SchemaBuilder.numberProperty('Test number with zero', 0);

      expect(property).toEqual({
        type: 'number',
        description: 'Test number with zero',
        default: 0,
      });
    });
  });

  describe('arrayProperty', () => {
    it('should create array property with default item type', () => {
      const property = SchemaBuilder.arrayProperty('Test array');

      expect(property).toEqual({
        type: 'array',
        items: { type: 'string' },
        description: 'Test array',
      });
    });

    it('should create array property with custom item type', () => {
      const property = SchemaBuilder.arrayProperty('Test number array', 'number');

      expect(property).toEqual({
        type: 'array',
        items: { type: 'number' },
        description: 'Test number array',
      });
    });
  });

  describe('objectProperty', () => {
    it('should create object property with additional properties allowed', () => {
      const property = SchemaBuilder.objectProperty('Test object');

      expect(property).toEqual({
        type: 'object',
        description: 'Test object',
        additionalProperties: true,
      });
    });

    it('should create object property without additional properties', () => {
      const property = SchemaBuilder.objectProperty('Strict object', false);

      expect(property).toEqual({
        type: 'object',
        description: 'Strict object',
        additionalProperties: false,
      });
    });
  });

  describe('emptyObjectSchema', () => {
    it('should return empty object', () => {
      const schema = SchemaBuilder.emptyObjectSchema();

      expect(schema).toEqual({});
    });
  });

  describe('CommonSchemas', () => {
    it('should provide ID_PROPERTY schema', () => {
      expect(CommonSchemas.ID_PROPERTY).toEqual({
        type: 'string',
        description: 'Unique identifier',
      });
    });

    it('should provide QUERY_PROPERTY schema', () => {
      expect(CommonSchemas.QUERY_PROPERTY).toEqual({
        type: 'string',
        description: 'Search query',
      });
    });

    it('should provide LIMIT_PROPERTY schema', () => {
      expect(CommonSchemas.LIMIT_PROPERTY).toEqual({
        type: 'number',
        description: 'Maximum number of results to return',
        default: 10,
      });
    });

    it('should provide THRESHOLD_PROPERTY schema', () => {
      expect(CommonSchemas.THRESHOLD_PROPERTY).toEqual({
        type: 'number',
        description: 'Minimum score threshold (0-1)',
        default: 0.6,
      });
    });
  });

  describe('complex schema building', () => {
    it('should build complex tool schema using all utilities', () => {
      const schema = SchemaBuilder.createTool(
        'complex_search',
        'A complex search tool with all property types',
        {
          id: CommonSchemas.ID_PROPERTY,
          query: CommonSchemas.QUERY_PROPERTY,
          tags: SchemaBuilder.arrayProperty('Search tags'),
          metadata: SchemaBuilder.objectProperty('Additional metadata'),
          maxResults: SchemaBuilder.numberProperty('Maximum results', 20),
          includeArchived: {
            type: 'boolean',
            description: 'Include archived results',
            default: false,
          },
        },
        ['query']
      );

      expect(schema).toEqual({
        name: 'complex_search',
        description: 'A complex search tool with all property types',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier',
            },
            query: {
              type: 'string',
              description: 'Search query',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Search tags',
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata',
              additionalProperties: true,
            },
            maxResults: {
              type: 'number',
              description: 'Maximum results',
              default: 20,
            },
            includeArchived: {
              type: 'boolean',
              description: 'Include archived results',
              default: false,
            },
          },
          required: ['query'],
        },
      });
    });
  });
});
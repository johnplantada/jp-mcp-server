import { McpServerBase } from '../base/McpServerBase.js';
import { SchemaBuilder } from '../utils/schemaBuilder.js';
import { McpErrorHandler } from '../utils/errors.js';
import { PromptLibrary } from '../utils/promptLibrary.js';
import { Logger } from '../utils/logger.js';
import type {
  ServerConfig,
  CreatePromptArgs,
  UpdatePromptArgs,
  DeletePromptArgs,
  GetPromptArgs,
  ListPromptsArgs,
  TestPromptArgs,
  SearchPromptsArgs,
} from '../types/index.js';

export class PromptServer extends McpServerBase {
  private promptLibrary: PromptLibrary;

  constructor(config: ServerConfig) {
    super(config);
    this.promptLibrary = PromptLibrary.getInstance();
  }

  // Helper method for error handling (following existing patterns)
  private async withErrorHandler<T>(
    handler: () => Promise<T>, 
    operationName: string
  ): Promise<T> {
    return McpErrorHandler.handleAsync(handler, operationName);
  }

  // Helper method for tool registration (following existing patterns)
  private registerPromptTool(
    name: string,
    handler: Function,
    description: string,
    properties: Record<string, any> = {},
    required: string[] = []
  ): void {
    this.registerTool(
      name,
      handler.bind(this),
      SchemaBuilder.createTool(name, description, properties, required)
    );
  }

  protected setupTools(): void {
    // List all prompts
    this.registerPromptTool(
      'list_prompts', 
      this.handleListPrompts, 
      'List all available prompts, optionally filtered by category',
      {
        category: SchemaBuilder.stringProperty('Optional category filter (e.g., "persona", "code-review")'),
      }
    );

    // Get a specific prompt with variable substitution
    this.registerPromptTool(
      'get_prompt',
      this.handleGetPrompt,
      'Get a prompt by ID with optional variable substitution',
      {
        id: SchemaBuilder.stringProperty('The prompt ID to retrieve'),
        variables: SchemaBuilder.objectProperty('Optional object with variable name-value pairs for substitution'),
      },
      ['id']
    );

    // Get prompt metadata/info without content
    this.registerPromptTool(
      'get_prompt_info',
      this.handleGetPromptInfo,
      'Get prompt metadata (name, category, variables, etc.) without full content',
      {
        id: SchemaBuilder.stringProperty('The prompt ID to get info for'),
      },
      ['id']
    );

    // Create a new prompt
    this.registerPromptTool(
      'create_prompt',
      this.handleCreatePrompt,
      'Create a new prompt in the library',
      {
        id: SchemaBuilder.stringProperty('Unique identifier for the prompt'),
        name: SchemaBuilder.stringProperty('Display name for the prompt'),
        content: SchemaBuilder.stringProperty('The prompt content (use {{variable}} for substitutions)'),
        category: SchemaBuilder.stringProperty('Optional category (e.g., "persona", "code-review")'),
        variables: SchemaBuilder.arrayProperty('Optional list of variable names used in the prompt'),
        version: SchemaBuilder.stringProperty('Optional version string'),
      },
      ['id', 'name', 'content']
    );

    // Update an existing prompt
    this.registerPromptTool(
      'update_prompt',
      this.handleUpdatePrompt,
      'Update an existing prompt in the library',
      {
        id: SchemaBuilder.stringProperty('The prompt ID to update'),
        name: SchemaBuilder.stringProperty('New display name for the prompt'),
        content: SchemaBuilder.stringProperty('New prompt content (use {{variable}} for substitutions)'),
        category: SchemaBuilder.stringProperty('New category'),
        variables: SchemaBuilder.arrayProperty('New list of variable names used in the prompt'),
        version: SchemaBuilder.stringProperty('New version string'),
      },
      ['id']
    );

    // Delete a prompt
    this.registerPromptTool(
      'delete_prompt',
      this.handleDeletePrompt,
      'Delete a prompt from the library',
      {
        id: SchemaBuilder.stringProperty('The prompt ID to delete'),
      },
      ['id']
    );

    // Test prompt with variables
    this.registerPromptTool(
      'test_prompt',
      this.handleTestPrompt,
      'Test a prompt with specific variables to see the final output',
      {
        id: SchemaBuilder.stringProperty('The prompt ID to test'),
        variables: SchemaBuilder.objectProperty('Object with variable name-value pairs for testing'),
      },
      ['id', 'variables']
    );

    // Search prompts
    this.registerPromptTool(
      'search_prompts',
      this.handleSearchPrompts,
      'Search prompts by query with advanced filtering and relevance scoring',
      {
        query: SchemaBuilder.stringProperty('Search query string'),
        category: SchemaBuilder.stringProperty('Optional category filter'),
        search_in: SchemaBuilder.arrayProperty('Fields to search in: name, content, variables, category (default: all)'),
        case_sensitive: SchemaBuilder.booleanProperty('Case sensitive search (default: false)'),
        max_results: SchemaBuilder.numberProperty('Maximum results to return (default: 50)'),
      },
      ['query']
    );
  }

  private async handleListPrompts(args: ListPromptsArgs = {}) {
    return this.withErrorHandler(async () => {
      const { category } = args;
      const prompts = this.promptLibrary.listPrompts(category);
      
      const promptList = prompts.map(prompt => ({
        id: prompt.id,
        name: prompt.name,
        category: prompt.category || 'uncategorized',
        variables: prompt.variables || [],
        version: prompt.version || '1.0',
        lastModified: prompt.lastModified,
      }));

      Logger.info(`Listed ${promptList.length} prompts${category ? ` in category "${category}"` : ''}`);
      return this.createJsonResponse({
        prompts: promptList,
        total: promptList.length,
        category: category || 'all',
      });
    }, 'list prompts');
  }

  private async handleGetPrompt(args: GetPromptArgs) {
    return this.withErrorHandler(async () => {
      const { id, variables = {} } = args;
      
      const prompt = this.promptLibrary.getPrompt(id, variables);
      if (!prompt) {
        throw McpErrorHandler.notFound('Prompt', id);
      }

      const promptInfo = this.promptLibrary.getPromptInfo(id);
      
      Logger.info(`Retrieved prompt "${id}" with ${Object.keys(variables).length} variables`);
      return this.createJsonResponse({
        id,
        name: promptInfo?.name,
        content: prompt,
        category: promptInfo?.category,
        variables: promptInfo?.variables,
        substitutedVariables: variables,
      });
    }, 'get prompt');
  }

  private async handleGetPromptInfo(args: GetPromptArgs) {
    return this.withErrorHandler(async () => {
      const { id } = args;
      
      const promptInfo = this.promptLibrary.getPromptInfo(id);
      if (!promptInfo) {
        throw McpErrorHandler.notFound('Prompt', id);
      }

      Logger.info(`Retrieved info for prompt "${id}"`);
      return this.createJsonResponse(promptInfo);
    }, 'get prompt info');
  }

  private async handleCreatePrompt(args: CreatePromptArgs) {
    return this.withErrorHandler(async () => {
      const { id, name, content, category, variables, version } = args;
      
      // Check if prompt already exists
      const existing = this.promptLibrary.getPromptInfo(id);
      if (existing) {
        throw McpErrorHandler.alreadyExists('Prompt', id);
      }

      // Create the prompt
      const success = this.promptLibrary.updatePrompt(id, {
        name,
        content,
        category,
        variables,
        version,
      });

      if (!success) {
        throw McpErrorHandler.internalError(`Failed to create prompt "${id}"`);
      }

      Logger.info(`Created prompt "${name}" (${id})`);
      return this.createResponse(
        `Prompt "${name}" created successfully!\n\n` +
        `ID: ${id}\n` +
        `Category: ${category || 'uncategorized'}\n` +
        `Variables: ${variables ? variables.join(', ') : 'none'}\n` +
        `Version: ${version || '1.0'}\n\n` +
        `Content preview:\n${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`
      );
    }, 'create prompt');
  }

  private async handleUpdatePrompt(args: UpdatePromptArgs) {
    return this.withErrorHandler(async () => {
      const { id, ...updates } = args;
      
      // Check if prompt exists
      const existing = this.promptLibrary.getPromptInfo(id);
      if (!existing) {
        throw McpErrorHandler.notFound('Prompt', id);
      }

      // Remove undefined values to only update provided fields
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      // Update the prompt
      const success = this.promptLibrary.updatePrompt(id, cleanUpdates);
      if (!success) {
        throw McpErrorHandler.internalError(`Failed to update prompt "${id}"`);
      }

      // Get updated info
      const updated = this.promptLibrary.getPromptInfo(id)!;
      
      Logger.info(`Updated prompt "${id}"`);
      return this.createResponse(
        `Prompt "${updated.name}" updated successfully!\n\n` +
        `ID: ${id}\n` +
        `Category: ${updated.category || 'uncategorized'}\n` +
        `Variables: ${updated.variables ? updated.variables.join(', ') : 'none'}\n` +
        `Version: ${updated.version || '1.0'}\n` +
        `Last Modified: ${updated.lastModified}\n\n` +
        `Updated fields: ${Object.keys(cleanUpdates).join(', ')}`
      );
    }, 'update prompt');
  }

  private async handleDeletePrompt(args: DeletePromptArgs) {
    return this.withErrorHandler(async () => {
      const { id } = args;
      
      // Get prompt info before deletion for response
      const promptInfo = this.promptLibrary.getPromptInfo(id);
      if (!promptInfo) {
        throw McpErrorHandler.notFound('Prompt', id);
      }

      // Delete the prompt
      const success = this.promptLibrary.deletePrompt(id);
      if (!success) {
        throw McpErrorHandler.internalError(`Failed to delete prompt "${id}"`);
      }

      Logger.info(`Deleted prompt "${promptInfo.name}" (${id})`);
      return this.createResponse(
        `Prompt "${promptInfo.name}" deleted successfully!\n\n` +
        `Deleted ID: ${id}\n` +
        `Category: ${promptInfo.category || 'uncategorized'}`
      );
    }, 'delete prompt');
  }

  private async handleTestPrompt(args: TestPromptArgs) {
    return this.withErrorHandler(async () => {
      const { id, variables } = args;
      
      // Check if prompt exists
      const promptInfo = this.promptLibrary.getPromptInfo(id);
      if (!promptInfo) {
        throw McpErrorHandler.notFound('Prompt', id);
      }

      // Get the prompt with variables substituted
      const processedPrompt = this.promptLibrary.getPrompt(id, variables);
      if (!processedPrompt) {
        throw McpErrorHandler.internalError(`Failed to process prompt "${id}"`);
      }

      Logger.info(`Tested prompt "${id}" with variables:`, variables);
      return this.createJsonResponse({
        id,
        name: promptInfo.name,
        originalVariables: promptInfo.variables || [],
        providedVariables: variables,
        processedContent: processedPrompt,
        previewLength: processedPrompt.length,
      });
    }, 'test prompt');
  }

  private async handleSearchPrompts(args: SearchPromptsArgs) {
    return this.withErrorHandler(async () => {
      const {
        query,
        category,
        search_in,
        case_sensitive = false,
        max_results = 50
      } = args;

      const searchResults = this.promptLibrary.searchPrompts(query, {
        category,
        searchIn: search_in,
        caseSensitive: case_sensitive,
        maxResults: max_results
      });

      Logger.info(`Search for "${query}" found ${searchResults.length} results`);
      
      // Format results for response
      const formattedResults = searchResults.map(result => ({
        id: result.id,
        name: result.name,
        category: result.category || 'uncategorized',
        variables: result.variables || [],
        version: result.version || '1.0',
        lastModified: result.lastModified,
        relevanceScore: result.score,
        matches: result.matches.map(match => ({
          field: match.field,
          snippet: match.snippet,
          position: match.position
        }))
      }));

      return this.createJsonResponse({
        query,
        results: formattedResults,
        total: formattedResults.length,
        searchOptions: {
          category,
          searchIn: search_in || ['name', 'content', 'variables', 'category'],
          caseSensitive: case_sensitive,
          maxResults: max_results
        }
      });
    }, 'search prompts');
  }
}
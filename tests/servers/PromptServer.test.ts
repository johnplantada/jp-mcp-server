import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PromptServer } from '../../src/servers/PromptServer.js';
import { PromptLibrary } from '../../src/utils/promptLibrary.js';
import { TestUtils } from '../utils/testUtils.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { 
  SearchPromptsArgs,
  CreatePromptArgs,
  PromptSearchResult,
  StoredPrompt 
} from '../../src/types/index.js';

// Mock PromptLibrary
jest.mock('../../src/utils/promptLibrary.js');
const MockPromptLibrary = PromptLibrary as jest.Mocked<typeof PromptLibrary>;

describe('PromptServer', () => {
  let server: PromptServer;
  let mockPromptLibraryInstance: jest.Mocked<PromptLibrary>;
  let loggerSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock PromptLibrary instance
    mockPromptLibraryInstance = {
      searchPrompts: jest.fn(),
      getPrompt: jest.fn(),
      getPromptInfo: jest.fn(),
      updatePrompt: jest.fn(),
      deletePrompt: jest.fn(),
      listPrompts: jest.fn(),
    } as any;

    // Mock PromptLibrary.getInstance() to return our mock instance
    (MockPromptLibrary.getInstance as jest.MockedFunction<typeof PromptLibrary.getInstance>).mockReturnValue(mockPromptLibraryInstance);

    // Create server instance
    server = new PromptServer(TestUtils.createMockServerConfig());
    
    // Spy on logger
    loggerSpy = TestUtils.spyOnLogger();
  });

  afterEach(() => {
    TestUtils.restoreAllMocks();
  });

  describe('handleSearchPrompts', () => {
    const sampleSearchResults: PromptSearchResult[] = [
      {
        id: 'test-prompt-1',
        name: 'JavaScript Code Review',
        category: 'code-review',
        variables: ['code'],
        version: '1.0',
        lastModified: new Date('2025-01-01'),
        matches: [
          {
            field: 'name',
            snippet: 'JavaScript Code Review',
            position: 0
          }
        ],
        score: 15
      },
      {
        id: 'test-prompt-2', 
        name: 'Debug Helper',
        category: 'debugging',
        variables: ['code', 'error'],
        version: '1.1',
        lastModified: new Date('2025-01-02'),
        matches: [
          {
            field: 'variables',
            snippet: 'code error',
            position: 0
          }
        ],
        score: 8
      }
    ];

    it('should search prompts with basic query', async () => {
      mockPromptLibraryInstance.searchPrompts.mockReturnValue(sampleSearchResults);

      const args: SearchPromptsArgs = {
        query: 'JavaScript'
      };

      const result = await (server as any).handleSearchPrompts(args);

      expect(mockPromptLibraryInstance.searchPrompts).toHaveBeenCalledWith('JavaScript', {
        category: undefined,
        searchIn: undefined,
        caseSensitive: false,
        maxResults: 50
      });

      expect(result.content[0].text).toContain('"total": 2');
      expect(result.content[0].text).toContain('"query": "JavaScript"');
      expect(result.content[0].text).toContain('JavaScript Code Review');
      expect(result.content[0].text).toContain('Debug Helper');
    });

    it('should search prompts with all search options', async () => {
      mockPromptLibraryInstance.searchPrompts.mockReturnValue([sampleSearchResults[0]]);

      const args: SearchPromptsArgs = {
        query: 'JavaScript code',
        category: 'code-review',
        search_in: ['name', 'content'],
        case_sensitive: true,
        max_results: 10
      };

      const result = await (server as any).handleSearchPrompts(args);

      expect(mockPromptLibraryInstance.searchPrompts).toHaveBeenCalledWith('JavaScript code', {
        category: 'code-review',
        searchIn: ['name', 'content'],
        caseSensitive: true,
        maxResults: 10
      });

      expect(result.content[0].text).toContain('"total": 1');
      expect(result.content[0].text).toContain('"category": "code-review"');
      expect(result.content[0].text).toContain('"caseSensitive": true');
    });

    it('should return empty results when no matches found', async () => {
      mockPromptLibraryInstance.searchPrompts.mockReturnValue([]);

      const args: SearchPromptsArgs = {
        query: 'nonexistent'
      };

      const result = await (server as any).handleSearchPrompts(args);

      expect(result.content[0].text).toContain('"total": 0');
      expect(result.content[0].text).toContain('"results": []');
    });

    it('should include relevance scores in results', async () => {
      mockPromptLibraryInstance.searchPrompts.mockReturnValue(sampleSearchResults);

      const args: SearchPromptsArgs = {
        query: 'code'
      };

      const result = await (server as any).handleSearchPrompts(args);

      expect(result.content[0].text).toContain('"relevanceScore": 15');
      expect(result.content[0].text).toContain('"relevanceScore": 8');
    });

    it('should include match details with snippets', async () => {
      mockPromptLibraryInstance.searchPrompts.mockReturnValue([sampleSearchResults[0]]);

      const args: SearchPromptsArgs = {
        query: 'JavaScript'
      };

      const result = await (server as any).handleSearchPrompts(args);

      const responseText = result.content[0].text;
      expect(responseText).toContain('"field": "name"');
      expect(responseText).toContain('"snippet": "JavaScript Code Review"');
      expect(responseText).toContain('"position": 0');
    });

    it('should handle search options with defaults', async () => {
      mockPromptLibraryInstance.searchPrompts.mockReturnValue(sampleSearchResults);

      const args: SearchPromptsArgs = {
        query: 'test'
      };

      const result = await (server as any).handleSearchPrompts(args);

      expect(mockPromptLibraryInstance.searchPrompts).toHaveBeenCalledWith('test', {
        category: undefined,
        searchIn: undefined,  
        caseSensitive: false,
        maxResults: 50
      });

      const responseText = result.content[0].text;
      expect(responseText).toContain('"searchIn"');
      expect(responseText).toContain('"name"');
      expect(responseText).toContain('"content"');  
      expect(responseText).toContain('"variables"');
      expect(responseText).toContain('"category"');
      expect(responseText).toContain('"caseSensitive": false');
      expect(responseText).toContain('"maxResults": 50');
    });

    it('should format results with proper structure', async () => {
      mockPromptLibraryInstance.searchPrompts.mockReturnValue([sampleSearchResults[0]]);

      const args: SearchPromptsArgs = {
        query: 'JavaScript'
      };

      const result = await (server as any).handleSearchPrompts(args);

      const responseText = result.content[0].text;
      const parsedResponse = JSON.parse(responseText);

      expect(parsedResponse).toHaveProperty('query', 'JavaScript');
      expect(parsedResponse).toHaveProperty('results');
      expect(parsedResponse).toHaveProperty('total', 1);
      expect(parsedResponse).toHaveProperty('searchOptions');

      const firstResult = parsedResponse.results[0];
      expect(firstResult).toHaveProperty('id');
      expect(firstResult).toHaveProperty('name');
      expect(firstResult).toHaveProperty('category');
      expect(firstResult).toHaveProperty('variables');
      expect(firstResult).toHaveProperty('version');
      expect(firstResult).toHaveProperty('lastModified');
      expect(firstResult).toHaveProperty('relevanceScore');
      expect(firstResult).toHaveProperty('matches');

      expect(firstResult.matches[0]).toHaveProperty('field');
      expect(firstResult.matches[0]).toHaveProperty('snippet');
      expect(firstResult.matches[0]).toHaveProperty('position');
    });

    it('should handle category filter correctly', async () => {
      const categoryResults = [sampleSearchResults[0]]; // Only code-review result
      mockPromptLibraryInstance.searchPrompts.mockReturnValue(categoryResults);

      const args: SearchPromptsArgs = {
        query: 'code',
        category: 'code-review'
      };

      const result = await (server as any).handleSearchPrompts(args);

      expect(mockPromptLibraryInstance.searchPrompts).toHaveBeenCalledWith('code', 
        expect.objectContaining({
          category: 'code-review'
        })
      );

      const responseText = result.content[0].text;
      expect(responseText).toContain('"category": "code-review"');
    });

    it('should handle search_in field restriction', async () => {
      mockPromptLibraryInstance.searchPrompts.mockReturnValue([sampleSearchResults[1]]);

      const args: SearchPromptsArgs = {
        query: 'code',
        search_in: ['variables']
      };

      const result = await (server as any).handleSearchPrompts(args);

      expect(mockPromptLibraryInstance.searchPrompts).toHaveBeenCalledWith('code',
        expect.objectContaining({
          searchIn: ['variables']
        })
      );
    });

    it('should validate required query parameter', async () => {
      const args = {} as SearchPromptsArgs; // Missing query

      await expect((server as any).handleSearchPrompts(args)).rejects.toThrow();
    });

    it('should handle PromptLibrary errors gracefully', async () => {
      mockPromptLibraryInstance.searchPrompts.mockImplementation(() => {
        throw new Error('Search failed');
      });

      const args: SearchPromptsArgs = {
        query: 'test'
      };

      await expect((server as any).handleSearchPrompts(args)).rejects.toThrow('Failed to search prompts');
    });

    it('should handle edge case with empty search results', async () => {
      mockPromptLibraryInstance.searchPrompts.mockReturnValue([]);

      const args: SearchPromptsArgs = {
        query: 'nonexistent',
        max_results: 100
      };

      const result = await (server as any).handleSearchPrompts(args);

      expect(result.content[0].text).toContain('"total": 0');
      expect(result.content[0].text).toContain('"results": []');
      expect(result.content[0].text).toContain('"maxResults": 100');
    });
  });

  describe('search integration with other tools', () => {
    it('should work alongside create_prompt tool', async () => {
      // First create a prompt
      mockPromptLibraryInstance.getPromptInfo.mockReturnValue(null);
      mockPromptLibraryInstance.updatePrompt.mockReturnValue(true);

      const createArgs: CreatePromptArgs = {
        id: 'test-prompt',
        name: 'Test Prompt',
        content: 'Test content with {{variable}}',
        category: 'test',
        variables: ['variable']
      };

      await (server as any).handleCreatePrompt(createArgs);

      // Then search for it
      const searchResult: PromptSearchResult = {
        id: 'test-prompt',
        name: 'Test Prompt',
        category: 'test',
        variables: ['variable'],
        version: '1.0',
        lastModified: new Date(),
        matches: [{
          field: 'name',
          snippet: 'Test Prompt',
          position: 0
        }],
        score: 10
      };

      mockPromptLibraryInstance.searchPrompts.mockReturnValue([searchResult]);

      const searchArgs: SearchPromptsArgs = {
        query: 'Test'
      };

      const result = await (server as any).handleSearchPrompts(searchArgs);

      expect(result.content[0].text).toContain('test-prompt');
      expect(result.content[0].text).toContain('Test Prompt');
    });
  });
});
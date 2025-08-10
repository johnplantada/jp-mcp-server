import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { Logger } from './logger.js';
import type { StoredPrompt, PromptStorage, PromptSearchResult } from '../types/index.js';

export class PromptLibrary {
  private static instance: PromptLibrary | null = null;
  private storage: PromptStorage;
  private readonly storageFilePath: string;

  private constructor() {
    this.storageFilePath = join(homedir(), '.mcp-prompts.json');
    this.storage = this.loadPromptStorage();
  }

  static getInstance(): PromptLibrary {
    if (!PromptLibrary.instance) {
      PromptLibrary.instance = new PromptLibrary();
    }
    return PromptLibrary.instance;
  }

  private loadPromptStorage(): PromptStorage {
    if (existsSync(this.storageFilePath)) {
      try {
        const data = readFileSync(this.storageFilePath, 'utf-8');
        const stored = JSON.parse(data);
        
        // Ensure all required fields exist
        const storage: PromptStorage = {
          prompts: stored.prompts || [],
          lastModified: stored.lastModified ? new Date(stored.lastModified) : new Date(),
        };
        
        Logger.info(`Loaded ${storage.prompts.length} prompts from ${this.storageFilePath}`);
        return storage;
      } catch (error) {
        Logger.error('Failed to load prompts from file', error);
        return this.createDefaultStorage();
      }
    } else {
      Logger.info('No existing prompts file found, creating default storage');
      return this.createDefaultStorage();
    }
  }

  private savePromptStorage(): void {
    try {
      this.storage.lastModified = new Date();
      writeFileSync(this.storageFilePath, JSON.stringify(this.storage, null, 2), 'utf-8');
      Logger.debug(`Saved ${this.storage.prompts.length} prompts to ${this.storageFilePath}`);
    } catch (error) {
      Logger.error('Failed to save prompts to file', error);
    }
  }

  private createDefaultStorage(): PromptStorage {
    const defaultPrompts: StoredPrompt[] = [
      {
        id: 'generate-persona',
        name: 'AI Persona Generation',
        content: `You need to generate a detailed and unique AI persona based on this description: "{{description}}"

Create a JSON object with EXACTLY this structure:
{
  "id": "{{suggested_id}}",
  "name": "<creative memorable name that fits the description>",
  "description": "<concise 1-2 sentence description of who this persona is>",
  "systemPrompt": "<detailed 2-3 paragraph system prompt that defines how this persona behaves, thinks, and communicates. Make it specific and actionable, not generic>",
  "traits": ["<trait1>", "<trait2>", "<trait3>", "<trait4>"],
  "communicationStyle": "<specific description of how they communicate>",
  "expertise": ["<area1>", "<area2>", "<area3>", "<area4>"]
}

Requirements:
- Make the persona SPECIFIC and INTERESTING, not generic
- The systemPrompt should be detailed enough to actually change AI behavior
- Include unique quirks or characteristics that make this persona memorable
- Ensure all fields are filled with meaningful content
- The persona should be practical and useful for AI assistance

Respond with ONLY the JSON object, no markdown formatting or extra text.`,
        category: 'persona',
        variables: ['description', 'suggested_id'],
        version: '1.0',
        lastModified: new Date(),
      },
    ];

    const storage: PromptStorage = {
      prompts: defaultPrompts,
      lastModified: new Date(),
    };

    // Save the default storage
    this.storage = storage;
    this.savePromptStorage();
    Logger.info(`Created default prompts file at ${this.storageFilePath}`);
    
    return storage;
  }

  /**
   * Get a prompt by ID and substitute variables
   * @param id - The prompt ID
   * @param variables - Object with variable name -> value mappings
   * @returns The prompt content with variables substituted, or null if not found
   */
  getPrompt(id: string, variables: Record<string, string> = {}): string | null {
    const prompt = this.storage.prompts.find(p => p.id === id);
    if (!prompt) {
      Logger.warn(`Prompt with ID "${id}" not found`);
      return null;
    }

    let content = prompt.content;
    
    // Substitute variables using {{variable}} syntax
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value || '');
    }

    Logger.debug(`Retrieved prompt "${id}" with variables:`, variables);
    return content;
  }

  /**
   * Update an existing prompt or create a new one
   * @param id - The prompt ID
   * @param updates - Partial prompt data to update
   * @returns true if successful, false otherwise
   */
  updatePrompt(id: string, updates: Partial<StoredPrompt>): boolean {
    try {
      const existingIndex = this.storage.prompts.findIndex(p => p.id === id);
      
      if (existingIndex >= 0) {
        // Update existing prompt
        this.storage.prompts[existingIndex] = {
          ...this.storage.prompts[existingIndex],
          ...updates,
          id, // Ensure ID cannot be changed
          lastModified: new Date(),
        };
        Logger.info(`Updated prompt "${id}"`);
      } else {
        // Create new prompt
        const newPrompt: StoredPrompt = {
          id,
          name: updates.name || `Prompt ${id}`,
          content: updates.content || '',
          category: updates.category,
          variables: updates.variables,
          version: updates.version || '1.0',
          lastModified: new Date(),
        };
        this.storage.prompts.push(newPrompt);
        Logger.info(`Created new prompt "${id}"`);
      }

      this.savePromptStorage();
      return true;
    } catch (error) {
      Logger.error(`Failed to update prompt "${id}"`, error);
      return false;
    }
  }

  /**
   * List all available prompts
   * @param category - Optional category filter
   * @returns Array of prompt metadata (without full content)
   */
  listPrompts(category?: string): Array<Omit<StoredPrompt, 'content'>> {
    const prompts = category 
      ? this.storage.prompts.filter(p => p.category === category)
      : this.storage.prompts;

    return prompts.map(({ content, ...prompt }) => prompt);
  }

  /**
   * Get a prompt's metadata and variables
   * @param id - The prompt ID
   * @returns Prompt metadata or null if not found
   */
  getPromptInfo(id: string): Omit<StoredPrompt, 'content'> | null {
    const prompt = this.storage.prompts.find(p => p.id === id);
    if (!prompt) {
      return null;
    }

    const { content, ...info } = prompt;
    return info;
  }

  /**
   * Delete a prompt
   * @param id - The prompt ID
   * @returns true if deleted, false if not found
   */
  deletePrompt(id: string): boolean {
    const initialLength = this.storage.prompts.length;
    this.storage.prompts = this.storage.prompts.filter(p => p.id !== id);
    
    if (this.storage.prompts.length < initialLength) {
      this.savePromptStorage();
      Logger.info(`Deleted prompt "${id}"`);
      return true;
    }
    
    Logger.warn(`Prompt "${id}" not found for deletion`);
    return false;
  }

  /**
   * Search prompts by query with advanced filtering and ranking
   * @param query - Search query string
   * @param options - Search options
   * @returns Array of search results with relevance scoring
   */
  searchPrompts(
    query: string,
    options: {
      category?: string;
      searchIn?: ('name' | 'content' | 'variables' | 'category')[];
      caseSensitive?: boolean;
      maxResults?: number;
    } = {}
  ): PromptSearchResult[] {
    const {
      category,
      searchIn = ['name', 'content', 'variables', 'category'],
      caseSensitive = false,
      maxResults = 50
    } = options;

    // Filter prompts by category if specified
    const promptsToSearch = category 
      ? this.storage.prompts.filter(p => p.category === category)
      : this.storage.prompts;

    if (promptsToSearch.length === 0) {
      return [];
    }

    // Prepare search query
    const searchQuery = caseSensitive ? query : query.toLowerCase();
    const searchTerms = searchQuery.split(/\s+/).filter(term => term.length > 0);

    const results: PromptSearchResult[] = [];

    for (const prompt of promptsToSearch) {
      const matches: { field: string; snippet: string; position: number }[] = [];
      let totalScore = 0;

      // Search in different fields based on options
      if (searchIn.includes('name')) {
        const fieldValue = caseSensitive ? prompt.name : prompt.name.toLowerCase();
        const fieldMatches = this.searchInField(fieldValue, searchTerms, 'name');
        matches.push(...fieldMatches);
        totalScore += fieldMatches.length * 10; // Name matches are weighted higher
      }

      if (searchIn.includes('content')) {
        const fieldValue = caseSensitive ? prompt.content : prompt.content.toLowerCase();
        const fieldMatches = this.searchInField(fieldValue, searchTerms, 'content');
        matches.push(...fieldMatches);
        totalScore += fieldMatches.length * 5; // Content matches have medium weight
      }

      if (searchIn.includes('category') && prompt.category) {
        const fieldValue = caseSensitive ? prompt.category : prompt.category.toLowerCase();
        const fieldMatches = this.searchInField(fieldValue, searchTerms, 'category');
        matches.push(...fieldMatches);
        totalScore += fieldMatches.length * 8; // Category matches are important
      }

      if (searchIn.includes('variables') && prompt.variables) {
        const fieldValue = caseSensitive 
          ? prompt.variables.join(' ')
          : prompt.variables.join(' ').toLowerCase();
        const fieldMatches = this.searchInField(fieldValue, searchTerms, 'variables');
        matches.push(...fieldMatches);
        totalScore += fieldMatches.length * 6; // Variable matches are moderately important
      }

      // Only include prompts with matches
      if (matches.length > 0) {
        results.push({
          id: prompt.id,
          name: prompt.name,
          category: prompt.category,
          variables: prompt.variables,
          version: prompt.version,
          lastModified: prompt.lastModified,
          matches,
          score: totalScore
        });
      }
    }

    // Sort by relevance score (descending) and limit results
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, maxResults);

    Logger.debug(`Search for "${query}" found ${limitedResults.length} results`);
    return limitedResults;
  }

  /**
   * Search for terms in a specific field and return match information
   */
  private searchInField(
    fieldValue: string, 
    searchTerms: string[], 
    fieldName: string
  ): { field: string; snippet: string; position: number }[] {
    const matches: { field: string; snippet: string; position: number }[] = [];

    for (const term of searchTerms) {
      let position = 0;
      while (true) {
        const index = fieldValue.indexOf(term, position);
        if (index === -1) break;

        // Create a snippet around the match
        const snippetStart = Math.max(0, index - 30);
        const snippetEnd = Math.min(fieldValue.length, index + term.length + 30);
        let snippet = fieldValue.substring(snippetStart, snippetEnd);
        
        // Add ellipsis if snippet doesn't start/end at field boundaries
        if (snippetStart > 0) snippet = '...' + snippet;
        if (snippetEnd < fieldValue.length) snippet = snippet + '...';

        matches.push({
          field: fieldName,
          snippet: snippet.trim(),
          position: index
        });

        position = index + term.length;
      }
    }

    return matches;
  }
}
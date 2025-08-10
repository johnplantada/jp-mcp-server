// MCP Server Types
export interface ServerConfig {
  name: string;
  version: string;
}

export interface McpToolResponse {
  content: {
    type: string;
    text: string;
  }[];
}

export type McpToolHandler = (args: any) => Promise<any>;

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Persona Server Types
export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  traits: string[];
  communicationStyle: string;
  expertise: string[];
}

export interface PersonaSwitchArgs {
  persona_id: string;
}

export interface PersonaDetailsArgs {
  persona_id: string;
}

export interface CreatePersonaArgs {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  traits?: string[];
  communication_style?: string;
  expertise?: string[];
}

export interface DeletePersonaArgs {
  persona_id: string;
}

export interface GeneratePersonaArgs {
  description: string;
  id?: string;
}

export interface UpdatePersonaArgs {
  persona_id: string;
  modifications: string;
}

export interface SetDefaultPersonaArgs {
  persona_id: string;
}

export interface PersonaListItem {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface PersonaStorage {
  personas: Persona[];
  activePersonaId: string | null;
  defaultPersonaId: string;
}

export interface StoredPrompt {
  id: string;
  name: string;
  content: string;
  category?: string;
  variables?: string[];
  version?: string;
  lastModified?: Date;
}

export interface PromptStorage {
  prompts: StoredPrompt[];
  lastModified?: Date;
}

export interface RequestPersonaGenerationArgs {
  description: string;
  suggested_id?: string;
}

export interface SaveAIGeneratedPersonaArgs {
  persona_json: string;
  generation_description: string;
}

// Prompt Management Server Types
export interface CreatePromptArgs {
  id: string;
  name: string;
  content: string;
  category?: string;
  variables?: string[];
  version?: string;
}

export interface UpdatePromptArgs {
  id: string;
  name?: string;
  content?: string;
  category?: string;
  variables?: string[];
  version?: string;
}

export interface DeletePromptArgs {
  id: string;
}

export interface GetPromptArgs {
  id: string;
  variables?: Record<string, string>;
}

export interface ListPromptsArgs {
  category?: string;
}

export interface TestPromptArgs {
  id: string;
  variables: Record<string, string>;
}

export interface SearchPromptsArgs {
  query: string;
  category?: string;
  search_in?: ('name' | 'content' | 'variables' | 'category')[];
  case_sensitive?: boolean;
  max_results?: number;
}

export interface PromptSearchResult {
  id: string;
  name: string;
  category?: string;
  variables?: string[];
  version?: string;
  lastModified?: Date;
  matches: {
    field: string;
    snippet: string;
    position: number;
  }[];
  score: number;
}

// Intelligent Persona Switching Types
export interface PersonaSuggestion {
  personaId: string;
  name: string;
  score: number;
  reasoning: string;
  expertise: string[];
}

export interface PersonaBlend {
  id: string;
  sourcePersonaIds: string[];
  task: string;
  blendMode: 'merge' | 'sequential';
  systemPrompt: string;
  expiresAt: Date;
  expiredAt?: Date;
}

export interface PersonaStats {
  personaId: string;
  usageCount: number;
  lastUsed: Date;
  averageSessionDuration: number;
  successRate: number;
  commonTasks: string[];
}

export interface PersonaStatsStorage {
  stats: PersonaStats[];
  lastUpdated: Date;
}

export interface SuggestPersonaArgs {
  task_description: string;
}

export interface AutoSwitchPersonaArgs {
  context: string;
  user_preference?: string;
  confidence_threshold?: number;
}

export interface BlendPersonasArgs {
  persona_ids: string[];
  task: string;
  blend_mode?: 'merge' | 'sequential';
}

export interface GetPersonaStatsArgs {
  persona_id?: string;
}

export interface ResetStatsArgs {
  persona_id?: string;
}

export interface GetSmartRecommendationsArgs {
  context: string;
}
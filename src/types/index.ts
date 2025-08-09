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
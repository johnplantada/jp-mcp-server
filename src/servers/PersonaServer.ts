import { McpServerBase } from '../base/McpServerBase.js';
import { CONFIG } from '../config/index.js';
import { SchemaBuilder } from '../utils/schemaBuilder.js';
import { McpErrorHandler, ErrorMessages } from '../utils/errors.js';
import { PersonaUtils } from '../utils/personaUtils.js';
import { PromptLibrary } from '../utils/promptLibrary.js';
import { PersonaStatsManager } from '../utils/personaStats.js';
import { Logger } from '../utils/logger.js';
import type {
  Persona,
  PersonaStorage,
  PersonaSwitchArgs,
  PersonaDetailsArgs,
  CreatePersonaArgs,
  DeletePersonaArgs,
  GeneratePersonaArgs,
  UpdatePersonaArgs,
  SetDefaultPersonaArgs,
  RequestPersonaGenerationArgs,
  SaveAIGeneratedPersonaArgs,
  PersonaListItem,
  ServerConfig,
  PersonaSuggestion,
  PersonaBlend,
  SuggestPersonaArgs,
  AutoSwitchPersonaArgs,
  BlendPersonasArgs,
  GetPersonaStatsArgs,
  ResetStatsArgs,
  GetSmartRecommendationsArgs,
} from '../types/index.js';

export class PersonaServer extends McpServerBase {
  private storage!: PersonaStorage;
  private personas: Map<string, Persona> = new Map();
  private temporaryPersonas: Map<string, PersonaBlend> = new Map();
  private expiredPersonas: Map<string, PersonaBlend> = new Map();
  private switchStartTime: Date | null = null;
  private statsManager: PersonaStatsManager;

  constructor(config: ServerConfig) {
    super(config);
    this.statsManager = PersonaStatsManager.getInstance();
    this.loadPersonas();
  }

  private loadPersonas(): void {
    this.storage = PersonaUtils.loadPersonaStorage();
    
    // Load personas into map for quick access
    for (const persona of this.storage.personas) {
      this.personas.set(persona.id, persona);
    }

    // Validate and correct default persona if missing/invalid
    if (!this.storage.defaultPersonaId || !this.personas.has(this.storage.defaultPersonaId)) {
      const prevDefault = this.storage.defaultPersonaId;
      let newDefault: string | null = null;

      if (this.personas.has(CONFIG.PERSONA.DEFAULT_ID)) {
        newDefault = CONFIG.PERSONA.DEFAULT_ID;
      } else {
        // fallback to first available persona
        const first = this.personas.keys().next();
        newDefault = first.done ? null : first.value;
      }

      if (newDefault) {
        this.storage.defaultPersonaId = newDefault;
        Logger.warn(`Invalid default persona "${prevDefault}", correcting to "${newDefault}"`);
      } else {
        // No personas available; keep default as configured constant for future seeding
        this.storage.defaultPersonaId = CONFIG.PERSONA.DEFAULT_ID;
        Logger.warn(`No personas available; setting default persona to "${this.storage.defaultPersonaId}"`);
      }
    }
    
    // Ensure active persona is set and valid; fallback to (corrected) default
    if (!this.storage.activePersonaId || !this.personas.has(this.storage.activePersonaId)) {
      this.storage.activePersonaId = this.personas.has(this.storage.defaultPersonaId)
        ? this.storage.defaultPersonaId
        : (this.personas.keys().next().done ? null as any : this.personas.keys().next().value);
      Logger.info(`Active persona set to default: ${this.storage.activePersonaId}`);
    }
    
    Logger.info(`Loaded ${this.personas.size} personas, active: ${this.storage.activePersonaId}`);
  }

  private savePersonas(): void {
    this.storage.personas = Array.from(this.personas.values());
    PersonaUtils.savePersonaStorage(this.storage);
  }

  // Helper method to eliminate repeated McpErrorHandler.handleAsync pattern
  private async withErrorHandler<T>(
    handler: () => Promise<T>, 
    operationName: string
  ): Promise<T> {
    return McpErrorHandler.handleAsync(handler, operationName);
  }

  // Helper method to validate persona existence
  private validatePersonaExists(personaId: string): Persona {
    const persona = this.personas.get(personaId);
    if (!persona) {
      throw McpErrorHandler.notFound('Persona', personaId);
    }
    return persona;
  }

  // Helper method for tool registration
  private registerPersonaTool(
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

  // Helper method for formatting persona details consistently
  private formatPersonaDetails(persona: Persona, includeId: boolean = false): string {
    const details = [
      ...(includeId ? [`ID: ${persona.id}`] : []),
      `Name: ${persona.name}`,
      `Description: ${persona.description}`,
      `Communication Style: ${persona.communicationStyle}`,
      `Traits: ${persona.traits.join(', ')}`,
      `Expertise: ${persona.expertise.join(', ')}`,
    ];
    
    return details.join('\n');
  }

  // Helper method for formatting success responses with persona details
  private formatPersonaSuccessResponse(
    action: string,
    persona: Persona,
    extraInfo?: string,
    includeSystemPrompt: boolean = true
  ): string {
    let response = `${action} persona "${persona.name}" successfully!\n\n`;
    
    if (extraInfo) {
      response += `${extraInfo}\n\n`;
    }
    
    response += this.formatPersonaDetails(persona, true);
    
    if (includeSystemPrompt) {
      response += `\n\nSystem Prompt:\n${persona.systemPrompt}`;
    }
    
    return response;
  }

  protected setupTools(): void {
    // Simple tools with no parameters
    this.registerPersonaTool('list_personas', this.handleListPersonas, 'List all available AI personas');
    this.registerPersonaTool('list_expired_personas', this.handleListExpiredPersonas, 'List expired personas available for promotion');
    this.registerPersonaTool('get_active_persona', this.handleGetActivePersona, 'Get the currently active persona');
    this.registerPersonaTool('get_persona_prompt', this.handleGetPersonaPrompt, 'Get the system prompt for the active persona');

    // Tools requiring persona_id
    const personaIdProperty = { persona_id: SchemaBuilder.stringProperty('The ID of the persona') };
    this.registerPersonaTool('switch_persona', this.handleSwitchPersona, 'Switch to a different AI persona', personaIdProperty, ['persona_id']);
    this.registerPersonaTool('get_persona_details', this.handleGetPersonaDetails, 'Get detailed information about a specific persona', personaIdProperty, ['persona_id']);
    this.registerPersonaTool('delete_persona', this.handleDeletePersona, 'Delete a persona', personaIdProperty, ['persona_id']);
    this.registerPersonaTool('promote_expired_persona', this.handlePromoteExpiredPersona, 'Promote an expired persona to a permanent saved persona', personaIdProperty, ['persona_id']);
    this.registerPersonaTool('set_default_persona', this.handleSetDefaultPersona, 'Set which persona should be active by default when the server starts', personaIdProperty, ['persona_id']);

    // Create custom persona
    this.registerPersonaTool(
      'create_custom_persona',
      this.handleCreateCustomPersona,
      'Create a new custom persona',
      {
        id: SchemaBuilder.stringProperty('Unique identifier for the persona'),
        name: SchemaBuilder.stringProperty('Display name for the persona'),
        description: SchemaBuilder.stringProperty('Brief description of the persona'),
        system_prompt: SchemaBuilder.stringProperty('System prompt that defines the persona behavior'),
        traits: SchemaBuilder.arrayProperty('List of personality traits'),
        communication_style: SchemaBuilder.stringProperty('Description of how the persona communicates'),
        expertise: SchemaBuilder.arrayProperty('Areas of expertise for the persona'),
      },
      ['id', 'name', 'description', 'system_prompt']
    );

    // Generate persona
    this.registerPersonaTool(
      'generate_persona',
      this.handleGeneratePersona,
      'Generate a new persona using LLM based on a description',
      {
        description: SchemaBuilder.stringProperty('Description of the persona you want to create (e.g., "a pirate who loves coding", "a zen master developer", "a startup founder mindset")'),
        id: SchemaBuilder.stringProperty('Optional custom ID for the persona (auto-generated if not provided)'),
      },
      ['description']
    );

    // Update persona
    this.registerPersonaTool(
      'update_persona',
      this.handleUpdatePersona,
      'Update an existing persona using LLM based on modification instructions',
      {
        persona_id: SchemaBuilder.stringProperty('The ID of the persona to update'),
        modifications: SchemaBuilder.stringProperty('Description of how to modify the persona (e.g., "make it more formal", "add expertise in React", "change communication style to be more concise")'),
      },
      ['persona_id', 'modifications']
    );

    // AI-driven persona generation tools
    this.registerPersonaTool(
      'request_persona_generation',
      this.handleRequestPersonaGeneration,
      'Request AI to generate a persona - returns instructions for the AI',
      {
        description: SchemaBuilder.stringProperty('Description of the persona to generate (e.g., "a cyberpunk hacker", "a wise mentor")'),
        suggested_id: SchemaBuilder.stringProperty('Optional suggested ID for the persona (auto-generated if not provided)'),
      },
      ['description']
    );

    this.registerPersonaTool(
      'save_ai_generated_persona',
      this.handleSaveAIGeneratedPersona,
      'Save a persona that was generated by AI',
      {
        persona_json: SchemaBuilder.stringProperty('JSON string containing the generated persona data'),
        generation_description: SchemaBuilder.stringProperty('Description used to generate this persona'),
      },
      ['persona_json', 'generation_description']
    );

    // Intelligent Persona Switching Tools
    this.registerPersonaTool(
      'suggest_persona',
      this.handleSuggestPersona,
      'Suggest the best personas for a given task',
      {
        task_description: SchemaBuilder.stringProperty('Description of the task or context'),
      },
      ['task_description']
    );

    this.registerPersonaTool(
      'auto_switch_persona',
      this.handleAutoSwitchPersona,
      'Automatically switch to the best persona based on context',
      {
        context: SchemaBuilder.stringProperty('Current conversation context'),
        user_preference: SchemaBuilder.stringProperty('Optional user\'s preferred persona ID'),
        confidence_threshold: SchemaBuilder.numberProperty('Minimum confidence to auto-switch (0-1)', 0.7),
      },
      ['context']
    );

    this.registerPersonaTool(
      'blend_personas',
      this.handleBlendPersonas,
      'Temporarily blend multiple personas for complex tasks',
      {
        persona_ids: SchemaBuilder.arrayProperty('Array of persona IDs to blend'),
        task: SchemaBuilder.stringProperty('Description of the task requiring blended expertise'),
        blend_mode: SchemaBuilder.stringProperty('Blend mode: "merge" or "sequential" (default: "merge")'),
      },
      ['persona_ids', 'task']
    );

    // Persona Usage Analytics Tools
    this.registerPersonaTool(
      'get_persona_stats',
      this.handleGetPersonaStats,
      'Get usage statistics for personas',
      {
        persona_id: SchemaBuilder.stringProperty('Optional persona ID to get stats for (all if omitted)'),
      }
    );

    this.registerPersonaTool(
      'reset_stats',
      this.handleResetStats,
      'Reset usage statistics for personas',
      {
        persona_id: SchemaBuilder.stringProperty('Optional persona ID to reset stats for (all if omitted)'),
      }
    );

    this.registerPersonaTool(
      'get_smart_recommendations',
      this.handleGetSmartRecommendations,
      'Get personalized persona recommendations based on usage patterns',
      {
        context: SchemaBuilder.stringProperty('Current context or task description'),
      },
      ['context']
    );
  }

  private async handleListPersonas() {
    return this.withErrorHandler(async () => {
      // Ensure we have an active persona set to the default
      if (!this.storage.activePersonaId) {
        this.storage.activePersonaId = this.storage.defaultPersonaId;
        Logger.info(`No active persona, setting to default: ${this.storage.activePersonaId}`);
      }
      
      const personaList: PersonaListItem[] = Array.from(this.personas.values()).map((persona) => ({
        id: persona.id,
        name: persona.name,
        description: persona.description,
        isActive: persona.id === this.storage.activePersonaId,
        isDefault: persona.id === this.storage.defaultPersonaId,
      }));

      // Check for expired personas and create notification
      const expiredCount = this.expiredPersonas.size;
      let responseData: any = personaList;
      
      if (expiredCount > 0) {
        responseData = {
          personas: personaList,
          notification: {
            type: 'expired_personas_available',
            message: `⏰ ${expiredCount} expired persona(s) are available for promotion. Use 'list_expired_personas' to view them or 'promote_expired_persona' to save them permanently. They will be deleted after 24 hours.`,
            expiredCount,
            actions: ['list_expired_personas', 'promote_expired_persona']
          }
        };
      }

      Logger.info(`Listed ${personaList.length} personas, active: ${this.storage.activePersonaId}, default: ${this.storage.defaultPersonaId}${expiredCount > 0 ? `, ${expiredCount} expired` : ''}`);
      return this.createJsonResponse(responseData);
    }, 'list personas');
  }

  private async handleGetActivePersona() {
    return this.withErrorHandler(async () => {
      if (!this.storage.activePersonaId) {
        return this.createResponse(ErrorMessages.NO_ACTIVE_PERSONA);
      }

      const activePersona = this.personas.get(this.storage.activePersonaId);
      if (!activePersona) {
        throw McpErrorHandler.internalError(ErrorMessages.ACTIVE_PERSONA_NOT_IN_REGISTRY);
      }

      Logger.info(`Retrieved active persona: ${activePersona.name}`);
      return this.createJsonResponse({
        id: activePersona.id,
        name: activePersona.name,
        description: activePersona.description,
        communicationStyle: activePersona.communicationStyle,
      });
    }, 'get active persona');
  }

  private async handleSwitchPersona(args: PersonaSwitchArgs) {
    return this.withErrorHandler(async () => {
      const { persona_id } = args;
      const newPersona = this.validatePersonaExists(persona_id);

      const previousPersona = this.storage.activePersonaId ? this.personas.get(this.storage.activePersonaId) : null;
      
      // Track stats for the switch
      if (previousPersona) {
        // Determine if the previous session was successful (simple heuristic: session > 30 seconds)
        const wasSuccessful = !this.switchStartTime || 
          (new Date().getTime() - this.switchStartTime.getTime()) > 30000;
        this.statsManager.recordPersonaSwitchAway(previousPersona.id, wasSuccessful);
      }
      
      this.storage.activePersonaId = persona_id;
      this.switchStartTime = new Date();
      this.statsManager.recordPersonaSwitch(persona_id);
      
      // Save the active persona change
      this.savePersonas();

      Logger.info(`Switched persona from "${previousPersona?.name || 'None'}" to "${newPersona.name}"`);
      return this.createResponse(
        `Switched from "${previousPersona?.name || 'None'}" to "${newPersona.name}"\n\n` +
        `Active Persona: ${newPersona.name}\n` +
        `Description: ${newPersona.description}\n` +
        `Communication Style: ${newPersona.communicationStyle}`
      );
    }, 'switch persona');
  }

  private async handleGetPersonaDetails(args: PersonaDetailsArgs) {
    return this.withErrorHandler(async () => {
      const { persona_id } = args;
      const persona = this.validatePersonaExists(persona_id);
      return this.createJsonResponse(persona);
    }, 'get persona details');
  }

  private async handleCreateCustomPersona(args: CreatePersonaArgs) {
    return this.withErrorHandler(async () => {
      const { id, name, description, system_prompt, traits = [], communication_style = '', expertise = [] } = args;

      if (this.personas.has(id)) {
        throw McpErrorHandler.alreadyExists('Persona', id);
      }

      const newPersona: Persona = {
        id,
        name,
        description,
        systemPrompt: system_prompt,
        traits,
        communicationStyle: communication_style,
        expertise,
      };

      this.personas.set(id, newPersona);
      this.savePersonas();
      Logger.info(`Created custom persona: "${name}" (${id})`);

      return this.createResponse(`Custom persona "${name}" created successfully with ID: ${id}`);
    }, 'create custom persona');
  }

  private async handleDeletePersona(args: DeletePersonaArgs) {
    return this.withErrorHandler(async () => {
      const { persona_id } = args;
      const persona = this.validatePersonaExists(persona_id);
      this.personas.delete(persona_id);

      // If deleting default, choose a new default
      if (this.storage.defaultPersonaId === persona_id) {
        let newDefault: string | null = null;
        if (this.personas.has(CONFIG.PERSONA.DEFAULT_ID)) {
          newDefault = CONFIG.PERSONA.DEFAULT_ID;
        } else {
          const iter = this.personas.keys().next();
          newDefault = iter.done ? null : iter.value;
        }
        if (newDefault) {
          Logger.info(`Default persona deleted. Reassigning default to "${newDefault}"`);
          this.storage.defaultPersonaId = newDefault;
        }
      }

      // If deleting active, reset to configured default ID (even if not present in map), per expected behavior
      if (this.storage.activePersonaId === persona_id) {
        this.storage.activePersonaId = CONFIG.PERSONA.DEFAULT_ID as any;
        Logger.info(`Active persona deleted. Reassigning active to "${this.storage.activePersonaId}"`);
      }
      
      this.savePersonas();

      return this.createResponse(`Persona "${persona.name}" deleted successfully`);
    }, 'delete persona');
  }

  private async handleGetPersonaPrompt() {
    return this.withErrorHandler(async () => {
      // Ensure we have an active persona
      if (!this.storage.activePersonaId) {
        this.storage.activePersonaId = this.storage.defaultPersonaId;
        Logger.info(`No active persona, setting to default: ${this.storage.activePersonaId}`);
      }

      const activePersona = this.personas.get(this.storage.activePersonaId);
      if (!activePersona) {
        throw McpErrorHandler.internalError(ErrorMessages.ACTIVE_PERSONA_NOT_IN_REGISTRY);
      }

      Logger.info(`Providing system prompt for active persona: ${activePersona.name} (${activePersona.id})`);
      
      // Return both the prompt and metadata about which persona is active
      return this.createResponse(`[Active Persona: ${activePersona.name}]\n\n${activePersona.systemPrompt}`);
    }, 'get persona prompt');
  }

  private async handleGeneratePersona(args: GeneratePersonaArgs) {
    return this.withErrorHandler(async () => {
      const { description, id } = args;
      
      const personaId = id || PersonaUtils.generatePersonaId(description);
      
      if (this.personas.has(personaId)) {
        throw McpErrorHandler.alreadyExists('Persona', personaId);
      }

      const generatedPersona = PersonaUtils.generatePersonaFromDescription(description);
      
      const newPersona: Persona = {
        ...generatedPersona,
        id: personaId,
      };

      this.personas.set(personaId, newPersona);
      this.savePersonas();
      Logger.info(`Generated persona: "${newPersona.name}" (${personaId}) from description: "${description}"`);

      return this.createResponse(
        this.formatPersonaSuccessResponse('Generated', newPersona)
      );
    }, 'generate persona');
  }

  private async handleUpdatePersona(args: UpdatePersonaArgs) {
    return this.withErrorHandler(async () => {
      const { persona_id, modifications } = args;
      const existingPersona = this.validatePersonaExists(persona_id);

      // Apply modifications and mutate the existing persona in place so references remain consistent
      const updatedPersona = PersonaUtils.applyPersonaModifications(existingPersona, modifications);
      Object.assign(existingPersona, updatedPersona);
      this.personas.set(persona_id, existingPersona);
      this.savePersonas();
      Logger.info(`Updated persona: "${existingPersona.name}" (${persona_id}) with modifications: "${modifications}"`);

      return this.createResponse(
        this.formatPersonaSuccessResponse(
          'Updated', 
          existingPersona, 
          `Modifications applied: ${modifications}\n\nUpdated persona details:`
        )
      );
    }, 'update persona');
  }

  private async handleSetDefaultPersona(args: SetDefaultPersonaArgs) {
    return this.withErrorHandler(async () => {
      const { persona_id } = args;
      this.validatePersonaExists(persona_id);

      const previousDefault = this.storage.defaultPersonaId;
      this.storage.defaultPersonaId = persona_id;
      this.savePersonas();
      
      const persona = this.personas.get(persona_id)!;
      Logger.info(`Changed default persona from "${previousDefault}" to "${persona_id}"`);

      return this.createResponse(
        `Default persona changed from "${previousDefault}" to "${persona.name}" (${persona_id})\n\n` +
        `This persona will be automatically activated when the server starts.`
      );
    }, 'set default persona');
  }

  private async handleRequestPersonaGeneration(args: RequestPersonaGenerationArgs) {
    return this.withErrorHandler(async () => {
      const { description, suggested_id } = args;
      
      // Generate suggested ID if not provided
      const suggestedId = suggested_id || PersonaUtils.generatePersonaId(description);
      
      // Get the prompt library instance
      const promptLibrary = PromptLibrary.getInstance();
      
      // Get the persona generation prompt with substituted variables
      const prompt = promptLibrary.getPrompt('generate-persona', {
        description,
        suggested_id: suggestedId
      });
      
      if (!prompt) {
        throw McpErrorHandler.internalError('Persona generation prompt not found. Please check prompt library configuration.');
      }
      
      Logger.info(`Generated persona generation request for: "${description}" with ID: "${suggestedId}"`);
      
      return this.createResponse(prompt);
    }, 'request persona generation');
  }

  private async handleSaveAIGeneratedPersona(args: SaveAIGeneratedPersonaArgs) {
    return this.withErrorHandler(async () => {
      const { persona_json, generation_description } = args;
      
      let parsedPersona: any;
      try {
        parsedPersona = JSON.parse(persona_json);
      } catch (error) {
        throw McpErrorHandler.invalidRequest('Invalid JSON format for persona data');
      }
      
      // Validate required fields
      const requiredFields = ['id', 'name', 'description', 'systemPrompt', 'traits', 'communicationStyle', 'expertise'];
      const missingFields = requiredFields.filter(field => !parsedPersona[field]);
      
      if (missingFields.length > 0) {
        throw McpErrorHandler.invalidRequest(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      // Validate field types
      if (typeof parsedPersona.id !== 'string' || typeof parsedPersona.name !== 'string' ||
          typeof parsedPersona.description !== 'string' || typeof parsedPersona.systemPrompt !== 'string' ||
          typeof parsedPersona.communicationStyle !== 'string' ||
          !Array.isArray(parsedPersona.traits) || !Array.isArray(parsedPersona.expertise)) {
        throw McpErrorHandler.invalidRequest('Invalid field types in persona data');
      }
      
      // Check if persona ID already exists
      if (this.personas.has(parsedPersona.id)) {
        throw McpErrorHandler.alreadyExists('Persona', parsedPersona.id);
      }
      
      // Create the persona object
      const newPersona: Persona = {
        id: parsedPersona.id,
        name: parsedPersona.name,
        description: parsedPersona.description,
        systemPrompt: parsedPersona.systemPrompt,
        traits: parsedPersona.traits,
        communicationStyle: parsedPersona.communicationStyle,
        expertise: parsedPersona.expertise,
      };
      
      // Save the persona
      this.personas.set(newPersona.id, newPersona);
      this.savePersonas();
      
      Logger.info(`Saved AI-generated persona: "${newPersona.name}" (${newPersona.id}) from description: "${generation_description}"`);
      
      return this.createResponse(
        this.formatPersonaSuccessResponse(
          'Created AI-generated',
          newPersona,
          `Generated from description: "${generation_description}"`
        )
      );
    }, 'save AI generated persona');
  }

  // Intelligent Persona Switching Methods

  private async handleSuggestPersona(args: SuggestPersonaArgs) {
    return this.withErrorHandler(async () => {
      const { task_description } = args;
      
      if (!task_description || task_description.trim().length === 0) {
        throw McpErrorHandler.invalidRequest('Task description cannot be empty');
      }

      const taskLower = task_description.toLowerCase();
      const taskWords = taskLower.split(/\s+/);
      
      // Score each persona
      const suggestions: PersonaSuggestion[] = [];
      
      for (const [personaId, persona] of this.personas) {
        let score = 0;
        const reasons: string[] = [];
        
        // Score based on expertise (10 points per match)
        const expertiseMatches = persona.expertise.filter(exp => {
          const expLower = exp.toLowerCase();
          return taskWords.some(word => expLower.includes(word) || word.includes(expLower));
        });
        score += expertiseMatches.length * 10;
        if (expertiseMatches.length > 0) {
          reasons.push(`Expertise match: ${expertiseMatches.join(', ')}`);
        }
        
        // Score based on description relevance (5 points)
        const descWords = persona.description.toLowerCase().split(/\s+/);
        const descMatches = taskWords.filter(word => 
          descWords.some(descWord => descWord.includes(word) || word.includes(descWord))
        );
        if (descMatches.length > 0) {
          score += 5;
          reasons.push(`Description relevance: ${descMatches.length} keyword matches`);
        }
        
        // Score based on communication style fit (3 points)
        const styleKeywords = {
          'technical': ['code', 'debug', 'implement', 'optimize', 'refactor', 'api', 'database'],
          'creative': ['design', 'create', 'innovate', 'brainstorm', 'idea', 'concept'],
          'teaching': ['explain', 'learn', 'understand', 'guide', 'help', 'tutorial'],
          'formal': ['document', 'report', 'present', 'professional', 'business'],
        };
        
        for (const [style, keywords] of Object.entries(styleKeywords)) {
          if (persona.communicationStyle.toLowerCase().includes(style)) {
            const styleMatches = taskWords.filter(word => keywords.includes(word));
            if (styleMatches.length > 0) {
              score += 3;
              reasons.push(`Communication style fit: ${style}`);
            }
          }
        }
        
        // Add trait-based scoring (2 points per match)
        const traitMatches = persona.traits.filter(trait => {
          const traitLower = trait.toLowerCase();
          return taskWords.some(word => traitLower.includes(word) || word.includes(traitLower));
        });
        score += traitMatches.length * 2;
        if (traitMatches.length > 0) {
          reasons.push(`Trait alignment: ${traitMatches.join(', ')}`);
        }
        
        if (score > 0) {
          suggestions.push({
            personaId: persona.id,
            name: persona.name,
            score,
            reasoning: reasons.join('; '),
            expertise: persona.expertise,
          });
        }
      }
      
      // Sort by score and take top 3
      suggestions.sort((a, b) => b.score - a.score);
      const topSuggestions = suggestions.slice(0, 3);
      
      // Normalize scores to confidence (0-1)
      const maxScore = topSuggestions[0]?.score || 1;
      topSuggestions.forEach(s => {
        s.score = s.score / maxScore;
      });
      
      const response = {
        task: task_description,
        suggestions: topSuggestions,
        topRecommendation: topSuggestions[0]?.personaId || null,
      };
      
      Logger.info(`Suggested personas for task "${task_description}": ${topSuggestions.map(s => s.name).join(', ')}`);
      return this.createJsonResponse(response);
    }, 'suggest persona');
  }

  private async handleAutoSwitchPersona(args: AutoSwitchPersonaArgs) {
    return this.withErrorHandler(async () => {
      const { context, user_preference, confidence_threshold = 0.7 } = args;
      
      // If user has a preference, validate and use it
      if (user_preference) {
        const preferredPersona = this.personas.get(user_preference);
        if (preferredPersona) {
          // Track stats for previous persona
          if (this.storage.activePersonaId) {
            const wasSuccessful = !this.switchStartTime || 
              (new Date().getTime() - this.switchStartTime.getTime()) > 30000;
            this.statsManager.recordPersonaSwitchAway(this.storage.activePersonaId, wasSuccessful);
          }
          
          this.storage.activePersonaId = user_preference;
          this.switchStartTime = new Date();
          this.statsManager.recordPersonaSwitch(user_preference, context);
          this.savePersonas();
          
          Logger.info(`Auto-switched to user-preferred persona: ${preferredPersona.name}`);
          return this.createResponse(
            `Switched to your preferred persona: ${preferredPersona.name}\n\n` +
            `Reasoning: User preference override\n` +
            this.formatPersonaDetails(preferredPersona)
          );
        }
      }
      
      // Get suggestions based on context
      const suggestions = await this.handleSuggestPersona({ task_description: context });
      const suggestData = JSON.parse(suggestions.content[0].text);
      
      if (!suggestData.suggestions || suggestData.suggestions.length === 0) {
        return this.createResponse('No suitable persona found for the given context. Keeping current persona.');
      }
      
      const topSuggestion = suggestData.suggestions[0];
      
      // Check if confidence meets threshold
      if (topSuggestion.score < confidence_threshold) {
        return this.createResponse(
          `Confidence too low to auto-switch (${(topSuggestion.score * 100).toFixed(1)}% < ${(confidence_threshold * 100).toFixed(1)}%)\n` +
          `Suggested: ${topSuggestion.name} for "${context}"\n` +
          `Reasoning: ${topSuggestion.reasoning}`
        );
      }
      
      // Check if already using this persona
      if (this.storage.activePersonaId === topSuggestion.personaId) {
        return this.createResponse(
          `Already using the best persona for this context: ${topSuggestion.name}\n` +
          `Confidence: ${(topSuggestion.score * 100).toFixed(1)}%`
        );
      }
      
      // Perform the switch
      const previousPersona = this.storage.activePersonaId ? this.personas.get(this.storage.activePersonaId) : null;
      
      // Track stats
      if (previousPersona) {
        const wasSuccessful = !this.switchStartTime || 
          (new Date().getTime() - this.switchStartTime.getTime()) > 30000;
        this.statsManager.recordPersonaSwitchAway(previousPersona.id, wasSuccessful);
      }
      
      this.storage.activePersonaId = topSuggestion.personaId;
      this.switchStartTime = new Date();
      this.statsManager.recordPersonaSwitch(topSuggestion.personaId, context);
      this.savePersonas();
      
      const newPersona = this.personas.get(topSuggestion.personaId)!;
      
      Logger.info(`Auto-switched from "${previousPersona?.name || 'None'}" to "${newPersona.name}" (confidence: ${(topSuggestion.score * 100).toFixed(1)}%)`);
      
      return this.createResponse(
        `Auto-switched from "${previousPersona?.name || 'None'}" to "${newPersona.name}"\n\n` +
        `Context: ${context}\n` +
        `Confidence: ${(topSuggestion.score * 100).toFixed(1)}%\n` +
        `Reasoning: ${topSuggestion.reasoning}\n\n` +
        this.formatPersonaDetails(newPersona)
      );
    }, 'auto switch persona');
  }

  private async handleBlendPersonas(args: BlendPersonasArgs) {
    return this.withErrorHandler(async () => {
      const { persona_ids, task, blend_mode = 'merge' } = args;
      
      if (!persona_ids || persona_ids.length < 2) {
        throw McpErrorHandler.invalidRequest('At least 2 personas are required for blending');
      }
      
      // Validate all personas exist
      const personas: Persona[] = [];
      for (const id of persona_ids) {
        const persona = this.personas.get(id);
        if (!persona) {
          throw McpErrorHandler.notFound('Persona', id);
        }
        personas.push(persona);
      }
      
      // Move expired temporary personas to expired map
      const now = new Date();
      for (const [id, blend] of this.temporaryPersonas) {
        if (blend.expiresAt < now) {
          // Move to expired map with expiration timestamp
          const expiredBlend = { ...blend, expiredAt: now };
          this.expiredPersonas.set(id, expiredBlend);
          this.temporaryPersonas.delete(id);
          this.personas.delete(id);
          Logger.info(`Moved expired blended persona to expired collection: ${id}`);
        }
      }

      // Clean up expired personas after 24 hours
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      for (const [id, blend] of this.expiredPersonas) {
        if (blend.expiredAt && blend.expiredAt < dayAgo) {
          this.expiredPersonas.delete(id);
          Logger.info(`Permanently cleaned up expired persona: ${id}`);
        }
      }
      
      // Generate blend ID
      const blendId = `blend_${Date.now()}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL
      
      // Create blended system prompt
      let blendedPrompt = '';
      let blendedName = '';
      let blendedDescription = '';
      const allExpertise = new Set<string>();
      const allTraits = new Set<string>();
      
      if (blend_mode === 'merge') {
        // Merge mode: Combine all aspects into one unified prompt
        blendedName = `Blended: ${personas.map(p => p.name).join(' + ')}`;
        blendedDescription = `A fusion of ${personas.length} personas for: ${task}`;
        
        blendedPrompt = `You are a unique blend of multiple expert personas, combining their best qualities for the task: "${task}"\n\n`;
        blendedPrompt += `Your combined expertise includes:\n`;
        
        personas.forEach(persona => {
          persona.expertise.forEach(exp => allExpertise.add(exp));
          persona.traits.forEach(trait => allTraits.add(trait));
          blendedPrompt += `- ${persona.name}: ${persona.expertise.join(', ')}\n`;
        });
        
        blendedPrompt += `\nYour unified approach:\n`;
        personas.forEach(persona => {
          blendedPrompt += `\nFrom ${persona.name}:\n${persona.systemPrompt}\n`;
        });
        
        blendedPrompt += `\nSynthesize these perspectives to provide comprehensive assistance for: ${task}`;
        
      } else if (blend_mode === 'sequential') {
        // Sequential mode: Switch between personas as needed
        blendedName = `Sequential: ${personas.map(p => p.name).join(' → ')}`;
        blendedDescription = `Sequential application of ${personas.length} personas for: ${task}`;
        
        blendedPrompt = `You have access to multiple expert personas that you can channel sequentially for the task: "${task}"\n\n`;
        blendedPrompt += `Available personas (use in order of relevance):\n\n`;
        
        personas.forEach((persona, index) => {
          persona.expertise.forEach(exp => allExpertise.add(exp));
          persona.traits.forEach(trait => allTraits.add(trait));
          
          blendedPrompt += `[Persona ${index + 1}: ${persona.name}]\n`;
          blendedPrompt += `Expertise: ${persona.expertise.join(', ')}\n`;
          blendedPrompt += `Approach: ${persona.systemPrompt}\n\n`;
        });
        
        blendedPrompt += `Channel each persona as needed, clearly indicating transitions when switching perspectives.`;
      }
      
      // Create the blended persona
      const blendedPersona: Persona = {
        id: blendId,
        name: blendedName,
        description: blendedDescription,
        systemPrompt: blendedPrompt,
        traits: Array.from(allTraits),
        communicationStyle: `Adaptive blend of: ${personas.map(p => p.communicationStyle).join(', ')}`,
        expertise: Array.from(allExpertise),
      };
      
      // Store the blend
      const blend: PersonaBlend = {
        id: blendId,
        sourcePersonaIds: persona_ids,
        task,
        blendMode: blend_mode as 'merge' | 'sequential',
        systemPrompt: blendedPrompt,
        expiresAt,
      };
      
      this.temporaryPersonas.set(blendId, blend);
      this.personas.set(blendId, blendedPersona);
      
      // Auto-switch to the blended persona
      this.storage.activePersonaId = blendId;
      this.switchStartTime = new Date();
      
      Logger.info(`Created blended persona "${blendedName}" (${blendId}) from: ${persona_ids.join(', ')}`);
      
      return this.createJsonResponse({
        blend,
        persona: blendedPersona,
        message: `Created and activated blended persona. Expires at: ${expiresAt.toISOString()}`,
      });
    }, 'blend personas');
  }

  // Persona Usage Analytics Methods

  private async handleGetPersonaStats(args: GetPersonaStatsArgs = {}) {
    return this.withErrorHandler(async () => {
      const { persona_id } = args;
      const stats = this.statsManager.getStats(persona_id);
      
      if (persona_id && stats.length === 0) {
        return this.createResponse(`No statistics found for persona: ${persona_id}`);
      }
      
      // Enrich stats with persona names
      const enrichedStats = stats.map(stat => {
        const persona = this.personas.get(stat.personaId);
        return {
          ...stat,
          personaName: persona?.name || 'Unknown',
          description: persona?.description || '',
        };
      });
      
      const summary = this.statsManager.getUsageSummary();
      
      const response = {
        stats: enrichedStats,
        summary: {
          ...summary,
          mostUsedPersonaName: summary.mostUsedPersona ? 
            this.personas.get(summary.mostUsedPersona)?.name || 'Unknown' : null,
        },
      };
      
      Logger.info(`Retrieved stats for ${stats.length} personas`);
      return this.createJsonResponse(response);
    }, 'get persona stats');
  }

  private async handleResetStats(args: ResetStatsArgs = {}) {
    return this.withErrorHandler(async () => {
      const { persona_id } = args;
      
      if (persona_id) {
        // Validate persona exists
        this.validatePersonaExists(persona_id);
        this.statsManager.resetStats(persona_id);
        return this.createResponse(`Reset statistics for persona: ${persona_id}`);
      } else {
        this.statsManager.resetStats();
        return this.createResponse('Reset all persona statistics');
      }
    }, 'reset stats');
  }

  private async handleGetSmartRecommendations(args: GetSmartRecommendationsArgs) {
    return this.withErrorHandler(async () => {
      const { context } = args;
      
      // Get smart recommendations from stats
      const statsRecommendations = this.statsManager.getSmartRecommendations(context);
      
      // Get suggestions based on persona matching
      const suggestions = await this.handleSuggestPersona({ task_description: context });
      const suggestData = JSON.parse(suggestions.content[0].text);
      
      // Combine both recommendation sources
      const combinedRecommendations: PersonaSuggestion[] = [];
      const seenPersonaIds = new Set<string>();
      
      // Add stats-based recommendations with boosted scores
      for (const rec of statsRecommendations) {
        const persona = this.personas.get(rec.personaId);
        if (persona && !seenPersonaIds.has(rec.personaId)) {
          seenPersonaIds.add(rec.personaId);
          combinedRecommendations.push({
            personaId: rec.personaId,
            name: persona.name,
            score: Math.min(1.0, (rec.score + 20) / 100), // Boost historical scores
            reasoning: `Historical pattern: ${rec.reason}`,
            expertise: persona.expertise,
          });
        }
      }
      
      // Add content-based suggestions
      for (const sugg of suggestData.suggestions || []) {
        if (!seenPersonaIds.has(sugg.personaId)) {
          seenPersonaIds.add(sugg.personaId);
          combinedRecommendations.push({
            ...sugg,
            score: sugg.score * 0.8, // Slightly reduce pure content-based scores
            reasoning: `Content match: ${sugg.reasoning}`,
          });
        } else {
          // Boost score if persona appears in both lists
          const existing = combinedRecommendations.find(r => r.personaId === sugg.personaId);
          if (existing) {
            existing.score = Math.min(1.0, existing.score + 0.2);
            existing.reasoning += `; ${sugg.reasoning}`;
          }
        }
      }
      
      // Sort by score and take top 3
      combinedRecommendations.sort((a, b) => b.score - a.score);
      const topRecommendations = combinedRecommendations.slice(0, 3);
      
      const response = {
        context,
        recommendations: topRecommendations,
        topRecommendation: topRecommendations[0]?.personaId || null,
        basedOn: {
          historicalPatterns: statsRecommendations.length > 0,
          contentAnalysis: (suggestData.suggestions || []).length > 0,
        },
      };
      
      Logger.info(`Generated smart recommendations for context: "${context}"`);
      return this.createJsonResponse(response);
    }, 'get smart recommendations');
  }

  private async handleListExpiredPersonas() {
    return this.withErrorHandler(async () => {
      const expiredList = Array.from(this.expiredPersonas.values()).map((blend) => ({
        id: blend.id,
        name: `Blended: ${blend.sourcePersonaIds.join(' + ')}`,
        description: `${blend.blendMode} blend for: ${blend.task}`,
        sourcePersonaIds: blend.sourcePersonaIds,
        task: blend.task,
        blendMode: blend.blendMode,
        expiresAt: blend.expiresAt.toISOString(),
        expiredAt: blend.expiredAt?.toISOString(),
        timeUntilDeletion: blend.expiredAt ? 
          Math.max(0, new Date(blend.expiredAt.getTime() + 24 * 60 * 60 * 1000).getTime() - Date.now()) : 0,
      }));

      // Sort by most recently expired first
      expiredList.sort((a, b) => 
        new Date(b.expiredAt || 0).getTime() - new Date(a.expiredAt || 0).getTime()
      );

      Logger.info(`Listed ${expiredList.length} expired personas`);
      
      if (expiredList.length === 0) {
        return this.createResponse('No expired personas available for promotion.');
      }

      return this.createJsonResponse({
        expiredPersonas: expiredList,
        message: `Found ${expiredList.length} expired persona(s) available for promotion. They will be permanently deleted after 24 hours from expiration.`
      });
    }, 'list expired personas');
  }

  private async handlePromoteExpiredPersona(args: PersonaSwitchArgs) {
    return this.withErrorHandler(async () => {
      const { persona_id } = args;
      
      const expiredBlend = this.expiredPersonas.get(persona_id);
      if (!expiredBlend) {
        throw McpErrorHandler.invalidRequest(`Expired persona "${persona_id}" not found. Use list_expired_personas to see available options.`);
      }

      // Generate a new permanent ID
      const permanentId = `saved_${Date.now()}`;
      
      // Create a permanent persona from the expired blend
      const permanentPersona: Persona = {
        id: permanentId,
        name: `Saved: ${expiredBlend.sourcePersonaIds.join(' + ')}`,
        description: `Promoted blend: ${expiredBlend.task}`,
        systemPrompt: expiredBlend.systemPrompt,
        traits: ['collaborative', 'multi-faceted'], // Default traits for blended personas
        communicationStyle: 'adaptive',
        expertise: [], // Will be populated from source personas
      };

      // Collect expertise from source personas
      const allExpertise = new Set<string>();
      for (const sourceId of expiredBlend.sourcePersonaIds) {
        const sourcePersona = this.personas.get(sourceId);
        if (sourcePersona) {
          sourcePersona.expertise.forEach(exp => allExpertise.add(exp));
        }
      }
      permanentPersona.expertise = Array.from(allExpertise);

      // Add to personas map and storage
      this.personas.set(permanentId, permanentPersona);
      this.storage.personas.push(permanentPersona);
      PersonaUtils.savePersonaStorage(this.storage);

      // Remove from expired personas
      this.expiredPersonas.delete(persona_id);

      Logger.info(`Promoted expired persona "${persona_id}" to permanent persona "${permanentId}"`);
      
      return this.createResponse(
        `Successfully promoted expired persona to permanent persona "${permanentPersona.name}" (${permanentId}). ` +
        `You can now use this persona indefinitely and switch to it using switch_persona.`
      );
    }, 'promote expired persona');
  }
}
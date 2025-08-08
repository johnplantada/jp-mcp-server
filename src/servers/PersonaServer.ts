import { McpServerBase } from '../base/McpServerBase.js';
import { CONFIG } from '../config/index.js';
import { SchemaBuilder } from '../utils/schemaBuilder.js';
import { McpErrorHandler, ErrorMessages } from '../utils/errors.js';
import { PersonaUtils } from '../utils/personaUtils.js';
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
  PersonaListItem,
  ServerConfig,
} from '../types/index.js';

export class PersonaServer extends McpServerBase {
  private storage!: PersonaStorage;
  private personas: Map<string, Persona> = new Map();

  constructor(config: ServerConfig) {
    super(config);
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

  protected setupTools(): void {
    // List personas
    this.registerTool(
      'list_personas',
      this.handleListPersonas.bind(this),
      SchemaBuilder.createTool('list_personas', 'List all available AI personas')
    );

    // Get active persona
    this.registerTool(
      'get_active_persona',
      this.handleGetActivePersona.bind(this),
      SchemaBuilder.createTool('get_active_persona', 'Get the currently active persona')
    );

    // Switch persona
    this.registerTool(
      'switch_persona',
      this.handleSwitchPersona.bind(this),
      SchemaBuilder.createTool(
        'switch_persona',
        'Switch to a different AI persona',
        {
          persona_id: SchemaBuilder.stringProperty('The ID of the persona to switch to'),
        },
        ['persona_id']
      )
    );

    // Get persona details
    this.registerTool(
      'get_persona_details',
      this.handleGetPersonaDetails.bind(this),
      SchemaBuilder.createTool(
        'get_persona_details',
        'Get detailed information about a specific persona',
        {
          persona_id: SchemaBuilder.stringProperty('The ID of the persona to get details for'),
        },
        ['persona_id']
      )
    );

    // Create custom persona
    this.registerTool(
      'create_custom_persona',
      this.handleCreateCustomPersona.bind(this),
      SchemaBuilder.createTool(
        'create_custom_persona',
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
      )
    );

    // Delete persona
    this.registerTool(
      'delete_persona',
      this.handleDeletePersona.bind(this),
      SchemaBuilder.createTool(
        'delete_persona',
        'Delete a persona',
        {
          persona_id: SchemaBuilder.stringProperty('The ID of the persona to delete'),
        },
        ['persona_id']
      )
    );

    // Get persona prompt
    this.registerTool(
      'get_persona_prompt',
      this.handleGetPersonaPrompt.bind(this),
      SchemaBuilder.createTool('get_persona_prompt', 'Get the system prompt for the active persona')
    );

    // Generate persona
    this.registerTool(
      'generate_persona',
      this.handleGeneratePersona.bind(this),
      SchemaBuilder.createTool(
        'generate_persona',
        'Generate a new persona using LLM based on a description',
        {
          description: SchemaBuilder.stringProperty('Description of the persona you want to create (e.g., "a pirate who loves coding", "a zen master developer", "a startup founder mindset")'),
          id: SchemaBuilder.stringProperty('Optional custom ID for the persona (auto-generated if not provided)'),
        },
        ['description']
      )
    );

    // Update persona
    this.registerTool(
      'update_persona',
      this.handleUpdatePersona.bind(this),
      SchemaBuilder.createTool(
        'update_persona',
        'Update an existing persona using LLM based on modification instructions',
        {
          persona_id: SchemaBuilder.stringProperty('The ID of the persona to update'),
          modifications: SchemaBuilder.stringProperty('Description of how to modify the persona (e.g., "make it more formal", "add expertise in React", "change communication style to be more concise")'),
        },
        ['persona_id', 'modifications']
      )
    );

    // Set default persona
    this.registerTool(
      'set_default_persona',
      this.handleSetDefaultPersona.bind(this),
      SchemaBuilder.createTool(
        'set_default_persona',
        'Set which persona should be active by default when the server starts',
        {
          persona_id: SchemaBuilder.stringProperty('The ID of the persona to set as default'),
        },
        ['persona_id']
      )
    );
  }

  private async handleListPersonas() {
    return McpErrorHandler.handleAsync(async () => {
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

      Logger.info(`Listed ${personaList.length} personas, active: ${this.storage.activePersonaId}, default: ${this.storage.defaultPersonaId}`);
      return this.createJsonResponse(personaList);
    }, 'list personas');
  }

  private async handleGetActivePersona() {
    return McpErrorHandler.handleAsync(async () => {
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
    return McpErrorHandler.handleAsync(async () => {
      const { persona_id } = args;

      if (!this.personas.has(persona_id)) {
        throw McpErrorHandler.notFound('Persona', persona_id);
      }

      const previousPersona = this.storage.activePersonaId ? this.personas.get(this.storage.activePersonaId) : null;
      this.storage.activePersonaId = persona_id;
      const newPersona = this.personas.get(persona_id)!;
      
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
    return McpErrorHandler.handleAsync(async () => {
      const { persona_id } = args;

      const persona = this.personas.get(persona_id);
      if (!persona) {
        throw McpErrorHandler.notFound('Persona', persona_id);
      }

      return this.createJsonResponse(persona);
    }, 'get persona details');
  }

  private async handleCreateCustomPersona(args: CreatePersonaArgs) {
    return McpErrorHandler.handleAsync(async () => {
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
    return McpErrorHandler.handleAsync(async () => {
      const { persona_id } = args;

      if (!this.personas.has(persona_id)) {
        throw McpErrorHandler.notFound('Persona', persona_id);
      }

      const persona = this.personas.get(persona_id)!;
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
    return McpErrorHandler.handleAsync(async () => {
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
    return McpErrorHandler.handleAsync(async () => {
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
        `Generated persona "${newPersona.name}" successfully!\n\n` +
        `ID: ${personaId}\n` +
        `Name: ${newPersona.name}\n` +
        `Description: ${newPersona.description}\n` +
        `Communication Style: ${newPersona.communicationStyle}\n` +
        `Traits: ${newPersona.traits.join(', ')}\n` +
        `Expertise: ${newPersona.expertise.join(', ')}\n\n` +
        `System Prompt:\n${newPersona.systemPrompt}`
      );
    }, 'generate persona');
  }

  private async handleUpdatePersona(args: UpdatePersonaArgs) {
    return McpErrorHandler.handleAsync(async () => {
      const { persona_id, modifications } = args;

      const existingPersona = this.personas.get(persona_id);
      if (!existingPersona) {
        throw McpErrorHandler.notFound('Persona', persona_id);
      }

      // Apply modifications and mutate the existing persona in place so references remain consistent
      const updatedPersona = PersonaUtils.applyPersonaModifications(existingPersona, modifications);
      Object.assign(existingPersona, updatedPersona);
      this.personas.set(persona_id, existingPersona);
      this.savePersonas();
      Logger.info(`Updated persona: "${existingPersona.name}" (${persona_id}) with modifications: "${modifications}"`);

      return this.createResponse(
        `Updated persona "${existingPersona.name}" successfully!\n\n` +
        `Modifications applied: ${modifications}\n\n` +
        `Updated persona details:\n` +
        `Name: ${existingPersona.name}\n` +
        `Description: ${existingPersona.description}\n` +
        `Communication Style: ${existingPersona.communicationStyle}\n` +
        `Traits: ${existingPersona.traits.join(', ')}\n` +
        `Expertise: ${existingPersona.expertise.join(', ')}\n\n` +
        `Updated System Prompt:\n${existingPersona.systemPrompt}`
      );
    }, 'update persona');
  }

  private async handleSetDefaultPersona(args: SetDefaultPersonaArgs) {
    return McpErrorHandler.handleAsync(async () => {
      const { persona_id } = args;

      if (!this.personas.has(persona_id)) {
        throw McpErrorHandler.notFound('Persona', persona_id);
      }

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
}
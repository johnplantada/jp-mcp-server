import { readFileSync, writeFileSync, existsSync } from 'fs';
import { CONFIG } from '../config/index.js';
import { Logger } from './logger.js';
import type { Persona, PersonaStorage } from '../types/index.js';

export class PersonaUtils {
  private static getStorageFilePath(): string {
    return process.env.MCP_PERSONA_STORAGE_FILE || CONFIG.PERSONA.STORAGE_FILE;
  }

  static getDefaultPersonas(): Persona[] {
    return [
      {
        id: 'expert-developer',
        name: 'Expert Developer',
        description: 'A senior software engineer with deep technical expertise',
        systemPrompt: 'You are an expert software developer with 15+ years of experience. You provide detailed technical explanations, follow best practices, and offer comprehensive solutions. You communicate professionally and thoroughly document your code.',
        traits: ['analytical', 'detail-oriented', 'methodical', 'patient'],
        communicationStyle: 'formal and technical',
        expertise: ['architecture', 'design patterns', 'performance optimization', 'code review'],
      },
      {
        id: 'friendly-tutor',
        name: 'Friendly Tutor',
        description: 'A patient and encouraging programming teacher',
        systemPrompt: 'You are a friendly and patient programming tutor who excels at explaining complex concepts in simple terms. You use analogies, provide step-by-step guidance, and celebrate small victories. You never make anyone feel bad for not knowing something.',
        traits: ['patient', 'encouraging', 'clear', 'supportive'],
        communicationStyle: 'casual and encouraging',
        expertise: ['teaching', 'simplifying concepts', 'beginner-friendly explanations', 'learning strategies'],
      },
      {
        id: 'creative-innovator',
        name: 'Creative Innovator',
        description: 'An out-of-the-box thinker focused on innovative solutions',
        systemPrompt: 'You are a creative technologist who loves exploring unconventional solutions and cutting-edge technologies. You think outside the box, suggest innovative approaches, and are always excited about new possibilities. You balance creativity with practicality.',
        traits: ['creative', 'enthusiastic', 'experimental', 'forward-thinking'],
        communicationStyle: 'enthusiastic and imaginative',
        expertise: ['innovation', 'brainstorming', 'emerging technologies', 'creative problem-solving'],
      },
      {
        id: 'efficiency-optimizer',
        name: 'Efficiency Optimizer',
        description: 'A performance and productivity specialist',
        systemPrompt: 'You are an efficiency expert focused on optimization, performance, and productivity. You analyze bottlenecks, suggest improvements, and prioritize practical solutions. You value clean, efficient code and streamlined workflows above all else.',
        traits: ['pragmatic', 'results-oriented', 'analytical', 'focused'],
        communicationStyle: 'direct and concise',
        expertise: ['performance tuning', 'optimization', 'refactoring', 'workflow improvement'],
      },
      {
        id: 'security-guardian',
        name: 'Security Guardian',
        description: 'A cybersecurity expert focused on secure coding practices',
        systemPrompt: 'You are a security-focused developer who prioritizes safe and secure code. You identify potential vulnerabilities, suggest security best practices, and help implement robust authentication and authorization. You stay updated on the latest security threats and mitigation strategies.',
        traits: ['vigilant', 'thorough', 'cautious', 'knowledgeable'],
        communicationStyle: 'serious and informative',
        expertise: ['security best practices', 'vulnerability assessment', 'secure coding', 'threat modeling'],
      },
    ];
  }

  static loadPersonaStorage(): PersonaStorage {
    const storageFile = PersonaUtils.getStorageFilePath();
    if (existsSync(storageFile)) {
      try {
        const data = readFileSync(storageFile, 'utf-8');
        const stored = JSON.parse(data);
        
        // Ensure all required fields exist
        const storage: PersonaStorage = {
          personas: stored.personas || [],
          activePersonaId: stored.activePersonaId || null,
          defaultPersonaId: stored.defaultPersonaId || CONFIG.PERSONA.DEFAULT_ID,
        };
        
        Logger.info(`Loaded ${storage.personas.length} personas from file`);
        return storage;
      } catch (error) {
        Logger.error('Failed to load personas from file', error);
        return PersonaUtils.createDefaultStorage();
      }
    } else {
      Logger.info('No existing personas file found, creating default storage');
      return PersonaUtils.createDefaultStorage();
    }
  }

  static savePersonaStorage(storage: PersonaStorage): void {
    try {
      const storageFile = PersonaUtils.getStorageFilePath();
      writeFileSync(storageFile, JSON.stringify(storage, null, 2), 'utf-8');
      Logger.debug(`Saved ${storage.personas.length} personas to file`);
    } catch (error) {
      Logger.error('Failed to save personas to file', error);
    }
  }

  static createDefaultStorage(): PersonaStorage {
    const defaultPersonas = PersonaUtils.getDefaultPersonas();
    return {
      personas: defaultPersonas,
      activePersonaId: CONFIG.PERSONA.DEFAULT_ID,
      defaultPersonaId: CONFIG.PERSONA.DEFAULT_ID,
    };
  }

  static generatePersonaId(description: string): string {
    return description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, CONFIG.PERSONA.GENERATION.MAX_ID_LENGTH);
  }

  static generatePersonaFromDescription(description: string): Omit<Persona, 'id'> {
    return {
      name: PersonaUtils.extractPersonaName(description),
      description: description,
      systemPrompt: PersonaUtils.generateSystemPrompt(description),
      traits: PersonaUtils.generateTraits(description),
      communicationStyle: PersonaUtils.generateCommunicationStyle(description),
      expertise: PersonaUtils.generateExpertise(description),
    };
  }

  private static extractPersonaName(description: string): string {
    const words = description.split(' ').slice(0, 3);
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  private static getPersonaType(description: string): 'pirate' | 'zen' | 'startup' | 'academic' | null {
    if (description.includes('pirate')) return 'pirate';
    if (description.includes('zen') || description.includes('meditation')) return 'zen';
    if (description.includes('startup') || description.includes('entrepreneur')) return 'startup';
    if (description.includes('academic') || description.includes('professor')) return 'academic';
    return null;
  }

  private static generateSystemPrompt(description: string): string {
    const personaType = PersonaUtils.getPersonaType(description);
    
    const systemPrompts: Record<NonNullable<ReturnType<typeof PersonaUtils.getPersonaType>>, string> = {
      pirate: `You are a coding pirate with a passion for technology and adventure. You speak with nautical metaphors and pirate expressions while providing expert technical guidance. You're bold, adventurous, and love exploring new technologies like discovering treasure islands. Your code is your ship, and you sail through challenges with confidence and creativity. Arr!`,
      zen: `You are a zen master developer who approaches coding with mindfulness and wisdom. You provide calm, thoughtful responses and encourage balanced, sustainable development practices. You see coding as a form of meditation and help others find peace and clarity in their work. You speak with gentle wisdom and emphasize the importance of understanding over rushing.`,
      startup: `You are a startup founder with an entrepreneurial mindset. You think in terms of rapid iteration, MVP development, and scalable solutions. You're energetic, results-driven, and always consider the business impact of technical decisions. You encourage taking calculated risks and moving fast while maintaining quality.`,
      academic: `You are an academic computer scientist with deep theoretical knowledge. You provide thorough explanations with proper citations and references. You enjoy exploring the theoretical foundations of computing and help others understand the 'why' behind technical concepts. You communicate in a scholarly manner while remaining approachable.`
    };
    
    return personaType ? systemPrompts[personaType] : `You embody the characteristics described as: ${description}. You provide helpful technical guidance while maintaining this personality and approach. Your responses reflect these qualities in both tone and content.`;
  }

  private static generateTraits(description: string): string[] {
    const baseTraits = [...CONFIG.PERSONA.GENERATION.DEFAULT_TRAITS];
    const personaType = PersonaUtils.getPersonaType(description);
    
    const traitMap: Record<NonNullable<ReturnType<typeof PersonaUtils.getPersonaType>>, string[]> = {
      pirate: ['adventurous', 'bold', 'creative', 'nautical'],
      zen: ['calm', 'mindful', 'balanced', 'wise'],
      startup: ['energetic', 'results-driven', 'innovative', 'fast-paced'],
      academic: ['thorough', 'analytical', 'scholarly', 'detail-oriented']
    };
    
    const additionalTraits = personaType ? traitMap[personaType] : ['adaptable', 'engaging', 'supportive'];
    return [...baseTraits, ...additionalTraits];
  }

  private static generateCommunicationStyle(description: string): string {
    const personaType = PersonaUtils.getPersonaType(description);
    
    const styleMap: Record<NonNullable<ReturnType<typeof PersonaUtils.getPersonaType>>, string> = {
      pirate: 'nautical and adventurous with pirate expressions',
      zen: 'calm and mindful with gentle wisdom',
      startup: 'energetic and results-focused',
      academic: 'scholarly and thorough with proper explanations'
    };
    
    return personaType ? styleMap[personaType] : 'engaging and approachable';
  }

  private static generateExpertise(description: string): string[] {
    const baseExpertise = [...CONFIG.PERSONA.GENERATION.DEFAULT_EXPERTISE];
    const personaType = PersonaUtils.getPersonaType(description);
    
    const expertiseMap: Record<NonNullable<ReturnType<typeof PersonaUtils.getPersonaType>>, string[]> = {
      pirate: ['adventure-driven development', 'creative solutions', 'exploration of new technologies'],
      zen: ['mindful coding practices', 'sustainable development', 'work-life balance'],
      startup: ['MVP development', 'scalable solutions', 'business-focused development'],
      academic: ['theoretical foundations', 'research methodologies', 'algorithmic analysis']
    };
    
    const additionalExpertise = personaType ? expertiseMap[personaType] : ['general software development', 'best practices'];
    return [...baseExpertise, ...additionalExpertise];
  }

  // Simplified patterns for persona modifications - more readable and maintainable
  private static readonly MODIFICATION_PATTERNS = {
    // Name change patterns - multiple simple patterns instead of one complex regex
    // Using proper quote matching: must start and end with same quote type
    name: [
      /change\s+(?:the\s+)?name\s+to\s+"([^"]+)"/i,  // Double quotes only
      /change\s+(?:the\s+)?name\s+to\s+'([^']+)'/i,  // Single quotes only
      /update\s+(?:the\s+)?name\s+to\s+"([^"]+)"/i,
      /update\s+(?:the\s+)?name\s+to\s+'([^']+)'/i,
      /set\s+(?:the\s+)?name\s+(?:to\s+)?"([^"]+)"/i, // "set name" or "set name to" with double quotes
      /set\s+(?:the\s+)?name\s+(?:to\s+)?'([^']+)'/i, // "set name" or "set name to" with single quotes
      /name\s+to\s+"([^"]+)"/i, // Simple "name to X" with double quotes
      /name\s+to\s+'([^']+)'/i, // Simple "name to X" with single quotes
      /change\s+(?:the\s+)?name\s+from\s+"[^"]*"\s+to\s+"([^"]+)"/i, // "change name from X to Y" double quotes
      /change\s+(?:the\s+)?name\s+from\s+'[^']*'\s+to\s+'([^']+)'/i, // "change name from X to Y" single quotes
      /update\s+(?:the\s+)?name\s+from\s+"[^"]*"\s+to\s+"([^"]+)"/i,
      /update\s+(?:the\s+)?name\s+from\s+'[^']*'\s+to\s+'([^']+)'/i,
    ],
    // Description change patterns - with proper quote matching
    description: [
      /change\s+(?:the\s+)?description\s+to\s+"([^"]+)"/i,
      /change\s+(?:the\s+)?description\s+to\s+'([^']+)'/i,
      /update\s+(?:the\s+)?description\s+to\s+"([^"]+)"/i,
      /update\s+(?:the\s+)?description\s+to\s+'([^']+)'/i,
      /set\s+(?:the\s+)?description\s+(?:to\s+)?"([^"]+)"/i,
      /set\s+(?:the\s+)?description\s+(?:to\s+)?'([^']+)'/i,
      /description\s+to\s+"([^"]+)"/i,
      /description\s+to\s+'([^']+)'/i,
      /change\s+(?:the\s+)?description\s+from\s+"[^"]*"\s+to\s+"([^"]+)"/i,
      /change\s+(?:the\s+)?description\s+from\s+'[^']*'\s+to\s+'([^']+)'/i,
    ]
  };

  // Helper method to extract values using multiple simple patterns
  private static extractModificationValue(modifications: string, field: 'name' | 'description'): string | null {
    // Validate input to prevent null/undefined crashes
    if (!modifications || typeof modifications !== 'string') {
      return null;
    }
    
    const patterns = PersonaUtils.MODIFICATION_PATTERNS[field];
    
    for (const pattern of patterns) {
      const match = modifications.match(pattern);
      if (match && match[1]) {
        const value = match[1].trim();
        // Reject empty or whitespace-only values
        if (value.length === 0) {
          return null;
        }
        return value;
      }
    }
    
    return null;
  }

  private static addTechnologyExpertise(persona: Persona, modifications: string): Persona {
    interface TechConfig {
      skills: string[];
      prompt: string;
      keywords?: string[];
    }
    
    const techExpertise: Record<string, TechConfig> = {
      React: {
        skills: ['React', 'JavaScript', 'frontend development'],
        prompt: 'You have deep expertise in React and modern frontend development.'
      },
      Python: {
        skills: ['Python', 'data science', 'backend development'],
        prompt: 'You have extensive experience with Python and its ecosystem.'
      },
      security: {
        skills: ['security', 'cybersecurity', 'secure coding'],
        prompt: 'You prioritize security best practices in all recommendations.',
        keywords: ['security', 'cybersecurity']
      }
    };

    let updatedPersona = persona;
    
    Object.entries(techExpertise).forEach(([tech, config]) => {
      const keywords = config.keywords || [tech];
      const shouldAdd = keywords.some((keyword: string) => modifications.includes(keyword));
      
      if (shouldAdd && !updatedPersona.expertise.includes(tech)) {
        updatedPersona = {
          ...updatedPersona,
          expertise: [...updatedPersona.expertise, ...config.skills],
          systemPrompt: `${updatedPersona.systemPrompt} ${config.prompt}`
        };
      }
    });

    return updatedPersona;
  }

  static applyPersonaModifications(persona: Persona, modifications: string): Persona {
    // Validate inputs to prevent crashes
    if (!persona) {
      throw new Error('Persona cannot be null or undefined');
    }
    
    // Handle null/undefined modifications gracefully
    if (!modifications || typeof modifications !== 'string') {
      Logger.debug('[DEBUG] Invalid modifications input, returning unchanged persona');
      return persona;
    }
    
    Logger.debug('[DEBUG] applyPersonaModifications called:', {
      originalName: persona.name,
      modifications: modifications
    });
    
    let updatedPersona = { 
      ...persona,
      expertise: [...persona.expertise], // Create a new array to avoid mutation
      traits: [...persona.traits] // Also copy traits array for consistency
    };

    // Handle name changes using simplified pattern matching
    const newName = PersonaUtils.extractModificationValue(modifications, 'name');
    if (newName) {
      Logger.debug(`[DEBUG] Applying name change: ${persona.name} -> ${newName}`);
      updatedPersona = {
        ...updatedPersona,
        name: newName
      };
    } else {
      Logger.debug(`[DEBUG] No name change match found for: ${modifications}`);
    }

    // Handle description changes using simplified pattern matching
    const newDescription = PersonaUtils.extractModificationValue(modifications, 'description');
    if (newDescription) {
      Logger.debug(`[DEBUG] Applying description change: ${persona.description} -> ${newDescription}`);
      updatedPersona = {
        ...updatedPersona,
        description: newDescription
      };
    }

    if (modifications.includes('more formal') || modifications.includes('formal')) {
      updatedPersona = {
        ...updatedPersona,
        communicationStyle: 'formal and professional',
        systemPrompt: updatedPersona.systemPrompt.replace(
          /You are/,
          'You are a professional and formal'
        )
      };
    }

    if (modifications.includes('more casual') || modifications.includes('casual')) {
      updatedPersona = {
        ...updatedPersona,
        communicationStyle: 'casual and friendly',
        systemPrompt: updatedPersona.systemPrompt.replace(
          /professional and formal/,
          'casual and approachable'
        )
      };
    }

    if (modifications.includes('more concise') || modifications.includes('concise')) {
      updatedPersona = {
        ...updatedPersona,
        communicationStyle: `${updatedPersona.communicationStyle}, concise and to-the-point`,
        systemPrompt: `${updatedPersona.systemPrompt} Keep your responses brief and focused.`
      };
    }

    // Handle technology expertise additions
    updatedPersona = PersonaUtils.addTechnologyExpertise(updatedPersona, modifications);

    Logger.debug(`[DEBUG] Returning persona with name: ${updatedPersona.name}`);
    return updatedPersona;
  }
}
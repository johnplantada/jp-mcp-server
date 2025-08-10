import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { Logger } from './logger.js';
import type { PersonaStats, PersonaStatsStorage } from '../types/index.js';

export class PersonaStatsManager {
  private static instance: PersonaStatsManager | null = null;
  private storage: PersonaStatsStorage;
  private readonly storageFilePath: string;
  private sessionStartTimes: Map<string, Date> = new Map();

  private constructor() {
    this.storageFilePath = join(homedir(), '.mcp-persona-stats.json');
    this.storage = this.loadStatsStorage();
  }

  static getInstance(): PersonaStatsManager {
    if (!PersonaStatsManager.instance) {
      PersonaStatsManager.instance = new PersonaStatsManager();
    }
    return PersonaStatsManager.instance;
  }

  private loadStatsStorage(): PersonaStatsStorage {
    if (existsSync(this.storageFilePath)) {
      try {
        const data = readFileSync(this.storageFilePath, 'utf-8');
        const stored = JSON.parse(data);
        
        // Ensure all required fields exist and convert dates
        const storage: PersonaStatsStorage = {
          stats: (stored.stats || []).map((stat: any) => ({
            ...stat,
            lastUsed: new Date(stat.lastUsed),
          })),
          lastUpdated: stored.lastUpdated ? new Date(stored.lastUpdated) : new Date(),
        };
        
        Logger.info(`Loaded stats for ${storage.stats.length} personas from ${this.storageFilePath}`);
        return storage;
      } catch (error) {
        Logger.error('Failed to load persona stats from file', error);
        return this.createDefaultStorage();
      }
    } else {
      Logger.info('No existing stats file found, creating default storage');
      return this.createDefaultStorage();
    }
  }

  private saveStatsStorage(): void {
    try {
      this.storage.lastUpdated = new Date();
      writeFileSync(this.storageFilePath, JSON.stringify(this.storage, null, 2), 'utf-8');
      Logger.debug(`Saved stats for ${this.storage.stats.length} personas to ${this.storageFilePath}`);
    } catch (error) {
      Logger.error('Failed to save persona stats to file', error);
    }
  }

  private createDefaultStorage(): PersonaStatsStorage {
    const storage: PersonaStatsStorage = {
      stats: [],
      lastUpdated: new Date(),
    };

    this.storage = storage;
    this.saveStatsStorage();
    Logger.info(`Created default stats file at ${this.storageFilePath}`);
    
    return storage;
  }

  private getOrCreateStats(personaId: string): PersonaStats {
    let stats = this.storage.stats.find(s => s.personaId === personaId);
    
    if (!stats) {
      stats = {
        personaId,
        usageCount: 0,
        lastUsed: new Date(),
        averageSessionDuration: 0,
        successRate: 1.0,
        commonTasks: [],
      };
      this.storage.stats.push(stats);
    }
    
    return stats;
  }

  /**
   * Record when a persona is switched to
   */
  recordPersonaSwitch(personaId: string, context?: string): void {
    const stats = this.getOrCreateStats(personaId);
    
    stats.usageCount++;
    stats.lastUsed = new Date();
    
    // Track session start time
    this.sessionStartTimes.set(personaId, new Date());
    
    // Track common tasks/contexts
    if (context) {
      // Extract key words from context (simple approach)
      const keywords = context.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4)
        .slice(0, 3)
        .join(' ');
      
      if (keywords && !stats.commonTasks.includes(keywords)) {
        stats.commonTasks.push(keywords);
        // Keep only top 10 most recent tasks
        if (stats.commonTasks.length > 10) {
          stats.commonTasks.shift();
        }
      }
    }
    
    this.saveStatsStorage();
    Logger.debug(`Recorded switch to persona: ${personaId}`);
  }

  /**
   * Record when switching away from a persona
   */
  recordPersonaSwitchAway(personaId: string, wasSuccessful: boolean = true): void {
    const stats = this.getOrCreateStats(personaId);
    const sessionStart = this.sessionStartTimes.get(personaId);
    
    if (sessionStart) {
      const sessionDuration = (new Date().getTime() - sessionStart.getTime()) / 1000; // in seconds
      
      // Update average session duration (rolling average)
      if (stats.averageSessionDuration === 0) {
        stats.averageSessionDuration = sessionDuration;
      } else {
        stats.averageSessionDuration = 
          (stats.averageSessionDuration * (stats.usageCount - 1) + sessionDuration) / stats.usageCount;
      }
      
      this.sessionStartTimes.delete(personaId);
    }
    
    // Update success rate
    const totalSessions = stats.usageCount;
    const previousSuccesses = Math.round(stats.successRate * (totalSessions - 1));
    const newSuccesses = previousSuccesses + (wasSuccessful ? 1 : 0);
    stats.successRate = newSuccesses / totalSessions;
    
    this.saveStatsStorage();
    Logger.debug(`Recorded switch away from persona: ${personaId}, duration: ${stats.averageSessionDuration}s`);
  }

  /**
   * Get stats for a specific persona or all personas
   */
  getStats(personaId?: string): PersonaStats[] {
    if (personaId) {
      const stats = this.storage.stats.find(s => s.personaId === personaId);
      return stats ? [stats] : [];
    }
    
    // Return all stats sorted by usage count
    return [...this.storage.stats].sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Get personalized recommendations based on usage patterns
   */
  getSmartRecommendations(context: string): Array<{ personaId: string; score: number; reason: string }> {
    const recommendations: Array<{ personaId: string; score: number; reason: string }> = [];
    const contextWords = context.toLowerCase().split(/\s+/);
    const currentHour = new Date().getHours();
    
    for (const stats of this.storage.stats) {
      let score = 0;
      const reasons: string[] = [];
      
      // Score based on task similarity
      const taskMatches = stats.commonTasks.filter(task => {
        const taskWords = task.split(/\s+/);
        return taskWords.some(word => contextWords.includes(word));
      });
      
      if (taskMatches.length > 0) {
        score += taskMatches.length * 15;
        reasons.push(`Similar to previous tasks: ${taskMatches.join(', ')}`);
      }
      
      // Score based on recent usage (recency bonus)
      const hoursSinceLastUse = (new Date().getTime() - new Date(stats.lastUsed).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastUse < 24) {
        score += 10;
        reasons.push('Recently used');
      } else if (hoursSinceLastUse < 72) {
        score += 5;
        reasons.push('Used this week');
      }
      
      // Score based on success rate
      if (stats.successRate > 0.8) {
        score += 8;
        reasons.push(`High success rate: ${(stats.successRate * 100).toFixed(0)}%`);
      }
      
      // Score based on time of day patterns
      const lastUsedHour = new Date(stats.lastUsed).getHours();
      if (Math.abs(lastUsedHour - currentHour) < 2) {
        score += 5;
        reasons.push('Often used at this time');
      }
      
      // Score based on overall usage frequency
      if (stats.usageCount > 10) {
        score += 3;
        reasons.push('Frequently used');
      }
      
      if (score > 0) {
        recommendations.push({
          personaId: stats.personaId,
          score,
          reason: reasons.join('; '),
        });
      }
    }
    
    // Sort by score and return top recommendations
    recommendations.sort((a, b) => b.score - a.score);
    return recommendations.slice(0, 5);
  }

  /**
   * Reset stats for a specific persona or all personas
   */
  resetStats(personaId?: string): void {
    if (personaId) {
      this.storage.stats = this.storage.stats.filter(s => s.personaId !== personaId);
      Logger.info(`Reset stats for persona: ${personaId}`);
    } else {
      this.storage.stats = [];
      Logger.info('Reset all persona stats');
    }
    
    this.saveStatsStorage();
  }

  /**
   * Get usage summary for reporting
   */
  getUsageSummary(): {
    totalSwitches: number;
    mostUsedPersona: string | null;
    averageSessionDuration: number;
    personaCount: number;
  } {
    const totalSwitches = this.storage.stats.reduce((sum, stat) => sum + stat.usageCount, 0);
    const mostUsed = this.storage.stats.sort((a, b) => b.usageCount - a.usageCount)[0];
    const avgDuration = this.storage.stats.reduce((sum, stat) => sum + stat.averageSessionDuration, 0) / 
                        (this.storage.stats.length || 1);
    
    return {
      totalSwitches,
      mostUsedPersona: mostUsed?.personaId || null,
      averageSessionDuration: avgDuration,
      personaCount: this.storage.stats.length,
    };
  }
}
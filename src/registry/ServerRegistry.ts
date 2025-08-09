import { McpServerBase } from '../base/McpServerBase.js';
import { Logger } from '../utils/logger.js';
import type { ServerConfig } from '../types/index.js';

export interface ServerEntry {
  name: string;
  description: string;
  serverClass: new (config: ServerConfig) => McpServerBase;
  config: ServerConfig;
  entryPoint: string;
}

export class ServerRegistry {
  private static servers = new Map<string, ServerEntry>();

  static register(entry: ServerEntry): void {
    Logger.info(`Registering server: ${entry.name}`);
    this.servers.set(entry.name, entry);
  }

  static getServer(name: string): ServerEntry | undefined {
    return this.servers.get(name);
  }

  static getAllServers(): ServerEntry[] {
    return Array.from(this.servers.values());
  }

  static listServerNames(): string[] {
    return Array.from(this.servers.keys());
  }

  static createServer(name: string): McpServerBase {
    const entry = this.getServer(name);
    if (!entry) {
      throw new Error(`Server not found: ${name}`);
    }

    Logger.info(`Creating server instance: ${name}`);
    return new entry.serverClass(entry.config);
  }

  static getServerEntryPoint(name: string): string {
    const entry = this.getServer(name);
    if (!entry) {
      throw new Error(`Server not found: ${name}`);
    }
    return entry.entryPoint;
  }
}
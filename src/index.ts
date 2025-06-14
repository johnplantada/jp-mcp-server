#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import Fuse from 'fuse.js';

interface Document {
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

class TextSearchServer {
  private server: Server;
  private documents: Map<string, Document> = new Map();
  private fuse?: Fuse<Document>;

  constructor() {
    this.server = new Server(
      {
        name: 'text-search-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'add_document',
          description: 'Add a document to the search index',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for the document',
              },
              title: {
                type: 'string',
                description: 'Title of the document',
              },
              content: {
                type: 'string',
                description: 'Content of the document',
              },
              metadata: {
                type: 'object',
                description: 'Optional metadata for the document',
                additionalProperties: true,
              },
            },
            required: ['id', 'title', 'content'],
          },
        },
        {
          name: 'search',
          description: 'Search for documents using fuzzy text search',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 10,
              },
              threshold: {
                type: 'number',
                description: 'Minimum score threshold (0-1)',
                default: 0.6,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_document',
          description: 'Retrieve a document by ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Document ID',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'remove_document',
          description: 'Remove a document from the search index',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Document ID',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'list_documents',
          description: 'List all documents in the search index',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'add_document':
          return this.handleAddDocument(request.params.arguments);
        case 'search':
          return this.handleSearch(request.params.arguments);
        case 'get_document':
          return this.handleGetDocument(request.params.arguments);
        case 'remove_document':
          return this.handleRemoveDocument(request.params.arguments);
        case 'list_documents':
          return this.handleListDocuments();
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private updateSearchIndex() {
    const documents = Array.from(this.documents.values());
    this.fuse = new Fuse(documents, {
      keys: ['title', 'content'],
      includeScore: true,
      threshold: 0.6,
      ignoreLocation: true,
      findAllMatches: true,
    });
  }

  private async handleAddDocument(args: any) {
    const { id, title, content, metadata } = args;
    
    const document: Document = {
      id,
      title,
      content,
      metadata,
    };
    
    this.documents.set(id, document);
    this.updateSearchIndex();
    
    return {
      content: [
        {
          type: 'text',
          text: `Document added successfully. ID: ${id}`,
        },
      ],
    };
  }

  private async handleSearch(args: any) {
    const { query, limit = 10, threshold = 0.6 } = args;
    
    if (!this.fuse) {
      return {
        content: [
          {
            type: 'text',
            text: 'No documents in the search index.',
          },
        ],
      };
    }
    
    const results = this.fuse.search(query, { limit });
    const filteredResults = results.filter(
      (result) => result.score !== undefined && result.score <= (1 - threshold)
    );
    
    const formattedResults = filteredResults.map((result) => ({
      id: result.item.id,
      title: result.item.title,
      score: result.score ? 1 - result.score : 0,
      snippet: result.item.content.substring(0, 200) + '...',
    }));
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formattedResults, null, 2),
        },
      ],
    };
  }

  private async handleGetDocument(args: any) {
    const { id } = args;
    const document = this.documents.get(id);
    
    if (!document) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Document not found: ${id}`
      );
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(document, null, 2),
        },
      ],
    };
  }

  private async handleRemoveDocument(args: any) {
    const { id } = args;
    
    if (!this.documents.has(id)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Document not found: ${id}`
      );
    }
    
    this.documents.delete(id);
    this.updateSearchIndex();
    
    return {
      content: [
        {
          type: 'text',
          text: `Document removed successfully. ID: ${id}`,
        },
      ],
    };
  }

  private async handleListDocuments() {
    const documentList = Array.from(this.documents.values()).map((doc) => ({
      id: doc.id,
      title: doc.title,
      metadataKeys: doc.metadata ? Object.keys(doc.metadata) : [],
    }));
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(documentList, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Text Search MCP server running on stdio');
  }
}

const server = new TextSearchServer();
server.run().catch(console.error);
# JP MCP Server

A Model Context Protocol (MCP) server that provides text search capabilities using fuzzy matching.

## Features

- Add documents with title, content, and metadata
- Fuzzy text search across documents
- Retrieve documents by ID
- Remove documents from the index
- List all indexed documents

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Usage

The server runs on stdio and can be integrated with MCP-compatible clients.

### Available Tools

1. **add_document** - Add a document to the search index
2. **search** - Search for documents using fuzzy text matching
3. **get_document** - Retrieve a specific document by ID
4. **remove_document** - Remove a document from the index
5. **list_documents** - List all documents in the index

## Development

```bash
npm run dev
```

## License

MIT
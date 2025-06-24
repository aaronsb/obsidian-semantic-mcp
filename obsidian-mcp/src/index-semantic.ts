#!/usr/bin/env node
// Temporary file for testing semantic tools
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ObsidianAPI } from './utils/obsidian-api.js';
import { semanticTools } from './tools/semantic-tools.js';

// Get configuration from environment
const API_KEY = process.env.OBSIDIAN_API_KEY;
const API_URL = process.env.OBSIDIAN_API_URL;
const VAULT_NAME = process.env.OBSIDIAN_VAULT_NAME || 'Obsidian Vault';

if (!API_KEY) {
  console.error('Error: OBSIDIAN_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize Obsidian API
const obsidianAPI = new ObsidianAPI({
  apiKey: API_KEY,
  apiUrl: API_URL,
  vaultName: VAULT_NAME
});

// Create MCP server
const server = new Server(
  {
    name: 'obsidian-semantic-mcp',
    version: '1.4.0-beta',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: semanticTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const tool = semanticTools.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }
  
  return await tool.handler(obsidianAPI, args);
});

// Error handling
server.onerror = (error) => {
  console.error('[MCP Server Error]', error);
};

// Handle shutdown
process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[Semantic Tools Active] - 5 operations: vault, edit, view, workflow, system');
  
  // Keep the process alive
  process.stdin.resume();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
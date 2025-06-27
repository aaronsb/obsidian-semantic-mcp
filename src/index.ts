#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ObsidianAPI } from './utils/obsidian-api.js';
import { semanticTools } from './tools/semantic-tools.js';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables with proper precedence:
// 1. Existing environment variables take precedence
// 2. .env in current working directory (where MCP is invoked)
// 3. .env in the directory containing this script
if (!process.env.OBSIDIAN_API_KEY) {
  // First try .env in current working directory
  dotenv.config();
  
  // If still not found, try .env next to the script
  if (!process.env.OBSIDIAN_API_KEY) {
    const scriptDir = new URL('.', import.meta.url).pathname;
    const scriptEnvPath = resolve(scriptDir, '../.env');
    if (existsSync(scriptEnvPath)) {
      dotenv.config({ path: scriptEnvPath });
    }
  }
}

// Get configuration from environment
const API_KEY = process.env.OBSIDIAN_API_KEY;
const API_URL = process.env.OBSIDIAN_API_URL;
const VAULT_NAME = process.env.OBSIDIAN_VAULT_NAME || 'Obsidian Vault';

if (!API_KEY) {
  console.error('Error: OBSIDIAN_API_KEY environment variable is required');
  console.error('Searched for .env files in:');
  console.error(`  1. Current directory: ${process.cwd()}`);
  console.error(`  2. Script directory: ${resolve(new URL('.', import.meta.url).pathname, '..')}`);
  console.error('Please ensure a .env file exists with OBSIDIAN_API_KEY defined');
  process.exit(1);
}

// Initialize Obsidian API
const obsidianAPI = new ObsidianAPI({
  apiKey: API_KEY,
  apiUrl: API_URL,
  vaultName: VAULT_NAME
});

// Read version from package.json
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packageJsonPath = resolve(__dirname, '../package.json');
let version = '1.0.0'; // fallback version

try {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  version = packageJson.version;
} catch (error) {
  console.error('Warning: Could not read version from package.json, using fallback');
}

// Create MCP server
const server = new Server(
  {
    name: 'obsidian-semantic-mcp',
    version: version,
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
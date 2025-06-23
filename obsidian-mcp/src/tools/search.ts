import { ObsidianAPI } from '../utils/obsidian-api.js';

export const searchTools = [
  {
    name: 'search_vault_simple',
    description: 'Simple text search across the vault with context',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        }
      },
      required: ['query']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        const results = await api.searchSimple(args.query);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    }
  },
  {
    name: 'show_file_in_obsidian',
    description: 'Open a document in the Obsidian UI',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to open'
        }
      },
      required: ['path']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.openFile(args.path);
        return {
          content: [{
            type: 'text',
            text: `Opened file in Obsidian: ${args.path}`
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    }
  }
];
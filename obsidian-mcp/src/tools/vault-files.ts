import { ObsidianAPI } from '../utils/obsidian-api.js';

export const vaultFileTools = [
  {
    name: 'list_vault_files',
    description: 'List files in the Obsidian vault or a specific directory',
    inputSchema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Directory path to list (optional)'
        }
      },
      required: []
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        const files = await api.listFiles(args.directory);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(files, null, 2)
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
    name: 'get_vault_file',
    description: 'Get the content of a specific file from the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file'
        }
      },
      required: ['path']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        const file = await api.getFile(args.path);
        return {
          content: [{
            type: 'text',
            text: file.content
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
    name: 'create_vault_file',
    description: 'Create a new file in the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path for the new file'
        },
        content: {
          type: 'string',
          description: 'Content for the new file'
        }
      },
      required: ['path', 'content']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.createFile(args.path, args.content);
        return {
          content: [{
            type: 'text',
            text: `File created: ${args.path}`
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
    name: 'update_vault_file',
    description: 'Update the content of an existing file in the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file'
        },
        content: {
          type: 'string',
          description: 'New content for the file'
        }
      },
      required: ['path', 'content']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.updateFile(args.path, args.content);
        return {
          content: [{
            type: 'text',
            text: `File updated: ${args.path}`
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
    name: 'delete_vault_file',
    description: 'Delete a file from the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to delete'
        }
      },
      required: ['path']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.deleteFile(args.path);
        return {
          content: [{
            type: 'text',
            text: `File deleted: ${args.path}`
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
    name: 'append_to_vault_file',
    description: 'Append content to an existing file in the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file'
        },
        content: {
          type: 'string',
          description: 'Content to append'
        }
      },
      required: ['path', 'content']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.appendToFile(args.path, args.content);
        return {
          content: [{
            type: 'text',
            text: `Content appended to: ${args.path}`
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
    name: 'patch_vault_file',
    description: 'Insert or modify content in a vault file relative to headings, blocks, or frontmatter',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to patch'
        },
        operation: {
          type: 'string',
          enum: ['append', 'prepend', 'replace'],
          description: 'The operation to perform'
        },
        targetType: {
          type: 'string',
          enum: ['heading', 'block', 'frontmatter'],
          description: 'The type of target to modify'
        },
        target: {
          type: 'string',
          description: 'The target identifier (heading path, block ID, or frontmatter field)'
        },
        targetDelimiter: {
          type: 'string',
          description: 'Delimiter for heading paths (default: "::")',
          default: '::'
        },
        trimTargetWhitespace: {
          type: 'boolean',
          description: 'Whether to trim whitespace from target (default: false)',
          default: false
        },
        content: {
          type: 'string',
          description: 'The content to insert or use for replacement'
        },
        contentType: {
          type: 'string',
          enum: ['text/markdown', 'application/json'],
          description: 'Content type (default: text/markdown)',
          default: 'text/markdown'
        }
      },
      required: ['path', 'operation', 'targetType', 'target', 'content']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.patchVaultFile(args.path, {
          operation: args.operation,
          targetType: args.targetType,
          target: args.target,
          targetDelimiter: args.targetDelimiter || '::',
          trimTargetWhitespace: args.trimTargetWhitespace || false,
          content: args.content,
          contentType: args.contentType || 'text/markdown'
        });
        return {
          content: [{
            type: 'text',
            text: `File patched successfully: ${args.path}`
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
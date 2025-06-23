import { ObsidianAPI } from '../utils/obsidian-api.js';

export const activeFileTools = [
  {
    name: 'get_active_file',
    description: 'Get the content of the currently active file in Obsidian',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    handler: async (api: ObsidianAPI) => {
      try {
        const file = await api.getActiveFile();
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
    name: 'update_active_file',
    description: 'Update the content of the currently active file in Obsidian',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The new content for the file'
        }
      },
      required: ['content']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.updateActiveFile(args.content);
        return {
          content: [{
            type: 'text',
            text: 'Active file updated successfully'
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
    name: 'append_to_active_file',
    description: 'Append content to the currently active file in Obsidian',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The content to append'
        }
      },
      required: ['content']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.appendToActiveFile(args.content);
        return {
          content: [{
            type: 'text',
            text: 'Content appended to active file successfully'
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
    name: 'delete_active_file',
    description: 'Delete the currently active file in Obsidian',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    handler: async (api: ObsidianAPI) => {
      try {
        await api.deleteActiveFile();
        return {
          content: [{
            type: 'text',
            text: 'Active file deleted successfully'
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
    name: 'patch_active_file',
    description: 'Insert or modify content in the active file relative to headings, blocks, or frontmatter',
    inputSchema: {
      type: 'object',
      properties: {
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
      required: ['operation', 'targetType', 'target', 'content']
    },
    handler: async (api: ObsidianAPI, args: any) => {
      try {
        await api.patchActiveFile({
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
            text: 'Active file patched successfully'
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
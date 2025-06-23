import axios from 'axios';
import TurndownService from 'turndown';

export const fetchTool = {
  name: 'fetch',
  description: 'Fetch and convert web content to markdown',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch content from'
      },
      raw: {
        type: 'boolean',
        description: 'Return raw HTML instead of converting to markdown (default: false)',
        default: false
      },
      maxLength: {
        type: 'number',
        description: 'Maximum content length to return (optional)'
      },
      startIndex: {
        type: 'number',
        description: 'Starting index for content pagination (optional)'
      }
    },
    required: ['url']
  },
  handler: async (_: any, args: any) => {
    try {
      const response = await axios.get(args.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      let content = response.data;

      if (!args.raw && typeof content === 'string' && content.includes('<')) {
        const turndown = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced'
        });
        content = turndown.turndown(content);
      }

      if (args.startIndex || args.maxLength) {
        const start = args.startIndex || 0;
        const end = args.maxLength ? start + args.maxLength : undefined;
        content = content.slice(start, end);
      }

      return {
        content: [{
          type: 'text',
          text: content
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error fetching URL: ${error.message}`
        }],
        isError: true
      };
    }
  }
};
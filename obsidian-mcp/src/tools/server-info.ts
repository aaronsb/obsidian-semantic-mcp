import { ObsidianAPI } from '../utils/obsidian-api.js';

export const serverInfoTool = {
  name: 'get_server_info',
  description: 'Get information about the Obsidian Local REST API server',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  handler: async (api: ObsidianAPI) => {
    try {
      const info = await api.getServerInfo();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(info, null, 2)
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
};
import { serverInfoTool } from './server-info.js';
import { activeFileTools } from './active-file.js';
import { vaultFileTools } from './vault-files.js';
import { searchTools } from './search.js';
import { searchPaginatedTool } from './search-paginated.js';
import { fetchTool } from './fetch.js';
import { windowEditTools } from './window-edit.js';

export const allTools = [
  serverInfoTool,
  ...activeFileTools,
  ...vaultFileTools,
  ...searchTools,
  searchPaginatedTool,
  fetchTool,
  ...windowEditTools
];
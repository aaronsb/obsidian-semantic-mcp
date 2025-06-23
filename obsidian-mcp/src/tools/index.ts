import { serverInfoTool } from './server-info.js';
import { activeFileTools } from './active-file.js';
import { vaultFileTools } from './vault-files.js';
import { searchTools } from './search.js';
import { fetchTool } from './fetch.js';

export const allTools = [
  serverInfoTool,
  ...activeFileTools,
  ...vaultFileTools,
  ...searchTools,
  fetchTool
];
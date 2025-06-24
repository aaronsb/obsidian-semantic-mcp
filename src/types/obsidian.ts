export interface ObsidianConfig {
  apiKey: string;
  apiUrl?: string;
  vaultName?: string;
}

export interface ObsidianFile {
  path: string;
  content: string;
  tags?: string[];
  frontmatter?: Record<string, any>;
}

export interface SearchResult {
  path: string;
  content: string;
  score?: number;
  context?: string;
}
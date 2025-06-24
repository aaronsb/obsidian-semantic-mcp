import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Configuration for response limiting
 */
export interface ResponseLimiterConfig {
  maxTokens: number;
  contentPreviewLength: number;
  includeContentHash: boolean;
}

/**
 * Load configuration from file or use defaults
 */
function loadConfig(): ResponseLimiterConfig {
  try {
    const configPath = join(__dirname, '../config/response-limits.json');
    const configContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    return {
      maxTokens: config.maxTokens || 20000,
      contentPreviewLength: config.contentPreviewLength || 200,
      includeContentHash: config.includeContentHash ?? true
    };
  } catch {
    // Use defaults if config file not found
    return {
      maxTokens: 20000,
      contentPreviewLength: 200,
      includeContentHash: true
    };
  }
}

/**
 * Default configuration
 */
export const DEFAULT_LIMITER_CONFIG: ResponseLimiterConfig = loadConfig();

/**
 * Estimates token count for a string (rough approximation)
 * Assumes ~4 characters per token on average
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generates a hash for content verification
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 8);
}

/**
 * Truncates content intelligently, preserving structure
 */
export function truncateContent(
  content: string, 
  maxLength: number,
  addEllipsis: boolean = true
): string {
  if (content.length <= maxLength) {
    return content;
  }
  
  // Try to break at a word boundary
  let truncated = content.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    truncated = truncated.substring(0, lastSpace);
  }
  
  return addEllipsis ? truncated + '...' : truncated;
}

/**
 * Process search results to limit response size
 */
export function limitSearchResults(
  results: any[],
  config: ResponseLimiterConfig = DEFAULT_LIMITER_CONFIG
): {
  results: any[];
  truncated: boolean;
  originalCount: number;
} {
  const originalCount = results.length;
  let currentTokens = 0;
  const processedResults: any[] = [];
  let truncated = false;
  
  for (const result of results) {
    // Create a minimal result object
    const minimalResult: any = {
      path: result.path || result.filename || '',
      title: result.title || result.basename || result.path?.split('/').pop()?.replace('.md', '') || ''
    };
    
    // Add score if available
    if (typeof result.score === 'number') {
      minimalResult.score = result.score;
    }
    
    // Process content
    if (result.content || result.context) {
      const fullContent = result.content || result.context;
      const preview = truncateContent(fullContent, config.contentPreviewLength);
      minimalResult.preview = preview;
      
      if (config.includeContentHash) {
        minimalResult.contentHash = hashContent(fullContent);
      }
      
      // Store original content length for reference
      minimalResult.contentLength = fullContent.length;
    }
    
    // Estimate tokens for this result
    const resultJson = JSON.stringify(minimalResult);
    const resultTokens = estimateTokens(resultJson);
    
    // Check if adding this result would exceed limit
    if (currentTokens + resultTokens > config.maxTokens) {
      truncated = true;
      break;
    }
    
    processedResults.push(minimalResult);
    currentTokens += resultTokens;
  }
  
  return {
    results: processedResults,
    truncated,
    originalCount
  };
}

/**
 * Process any response to ensure it fits within token limits
 */
export function limitResponse(
  response: any,
  config: ResponseLimiterConfig = DEFAULT_LIMITER_CONFIG
): any {
  const responseStr = JSON.stringify(response);
  const tokens = estimateTokens(responseStr);
  
  if (tokens <= config.maxTokens) {
    return response;
  }
  
  // If response is too large, we need to truncate it
  if (Array.isArray(response)) {
    // Handle array responses
    return limitArrayResponse(response, config);
  } else if (typeof response === 'object' && response !== null) {
    // Handle object responses
    return limitObjectResponse(response, config);
  }
  
  // For other types, just truncate
  return truncateContent(String(response), config.maxTokens * 4);
}

/**
 * Limit array responses
 */
function limitArrayResponse(arr: any[], config: ResponseLimiterConfig): any[] {
  const limited: any[] = [];
  let currentTokens = 2; // For array brackets
  
  for (const item of arr) {
    const itemStr = JSON.stringify(item);
    const itemTokens = estimateTokens(itemStr);
    
    if (currentTokens + itemTokens > config.maxTokens) {
      break;
    }
    
    limited.push(item);
    currentTokens += itemTokens;
  }
  
  return limited;
}

/**
 * Limit object responses
 */
function limitObjectResponse(obj: any, config: ResponseLimiterConfig): any {
  const limited: any = {};
  let currentTokens = 2; // For object brackets
  
  // Prioritize certain keys
  const priorityKeys = ['error', 'message', 'path', 'title', 'query', 'page', 'totalResults'];
  const otherKeys = Object.keys(obj).filter(k => !priorityKeys.includes(k));
  const allKeys = [...priorityKeys.filter(k => k in obj), ...otherKeys];
  
  for (const key of allKeys) {
    if (!(key in obj)) continue;
    
    const value = obj[key];
    const entryStr = JSON.stringify({ [key]: value });
    const entryTokens = estimateTokens(entryStr);
    
    if (currentTokens + entryTokens > config.maxTokens) {
      // Try to add a truncation notice
      if (currentTokens + 50 < config.maxTokens) {
        limited._truncated = true;
      }
      break;
    }
    
    limited[key] = value;
    currentTokens += entryTokens;
  }
  
  return limited;
}
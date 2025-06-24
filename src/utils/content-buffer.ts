/**
 * Content buffer manager for storing generated content between edit attempts
 */

export interface BufferedContent {
  content: string;
  timestamp: number;
  filePath?: string;
  searchText?: string;
}

export class ContentBufferManager {
  private static instance: ContentBufferManager;
  private buffer: Map<string, BufferedContent> = new Map();
  private defaultKey = '_last_generated';
  private maxAge = 30 * 60 * 1000; // 30 minutes
  
  private constructor() {}
  
  static getInstance(): ContentBufferManager {
    if (!ContentBufferManager.instance) {
      ContentBufferManager.instance = new ContentBufferManager();
    }
    return ContentBufferManager.instance;
  }
  
  /**
   * Store content in buffer
   */
  store(content: string, key?: string, metadata?: { filePath?: string; searchText?: string }): void {
    const bufferKey = key || this.defaultKey;
    this.buffer.set(bufferKey, {
      content,
      timestamp: Date.now(),
      ...metadata
    });
    
    // Clean old entries
    this.cleanOldEntries();
  }
  
  /**
   * Retrieve content from buffer
   */
  retrieve(key?: string): BufferedContent | null {
    const bufferKey = key || this.defaultKey;
    const entry = this.buffer.get(bufferKey);
    
    if (!entry) return null;
    
    // Check if entry is too old
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.buffer.delete(bufferKey);
      return null;
    }
    
    return entry;
  }
  
  /**
   * Clear specific buffer or all buffers
   */
  clear(key?: string): void {
    if (key) {
      this.buffer.delete(key);
    } else {
      this.buffer.clear();
    }
  }
  
  /**
   * Get all buffer keys
   */
  getKeys(): string[] {
    return Array.from(this.buffer.keys());
  }
  
  /**
   * Clean entries older than maxAge
   */
  private cleanOldEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.buffer.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.buffer.delete(key);
      }
    }
  }
}
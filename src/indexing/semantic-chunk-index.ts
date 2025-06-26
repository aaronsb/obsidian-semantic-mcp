import {
  Chunk,
  SemanticSegment,
  ExpandedContext,
  SearchOptions,
  ContextualFragment
} from '../types/fragment.js';

/**
 * Semantic chunking with context preservation
 * Splits documents into meaningful chunks and maintains relationships
 */
export class SemanticChunkIndex {
  private chunks = new Map<string, Chunk>();
  private chunkGraph = new Map<string, Set<string>>(); // chunk relationships
  private termChunkIndex = new Map<string, Set<string>>();
  private filePathMap = new Map<string, string>();
  
  indexDocument(docId: string, filePath: string, content: string) {
    const semanticChunks = this.createSemanticChunks(content);
    
    semanticChunks.forEach((chunk, idx) => {
      const chunkId = `${docId}:${idx}`;
      
      // Store chunk with context
      this.chunks.set(chunkId, {
        id: chunkId,
        docId,
        content: chunk.text,
        context: {
          before: chunk.before,
          after: chunk.after,
          type: chunk.type // paragraph, list, heading, etc
        },
        metadata: {
          start: chunk.start,
          end: chunk.end,
          depth: chunk.depth
        }
      });
      
      // Build relationships
      if (idx > 0) {
        this.addChunkRelation(chunkId, `${docId}:${idx-1}`);
      }
      if (idx < semanticChunks.length - 1) {
        this.addChunkRelation(chunkId, `${docId}:${idx+1}`);
      }
      
      // Index terms
      const terms = this.extractTerms(chunk.text);
      terms.forEach(term => {
        if (!this.termChunkIndex.has(term)) {
          this.termChunkIndex.set(term, new Set());
        }
        this.termChunkIndex.get(term)!.add(chunkId);
      });
    });
    
    // Store file path mapping
    this.filePathMap.set(docId, filePath);
  }
  
  searchWithContext(query: string, options: SearchOptions = {}): ContextualFragment[] {
    const { 
      maxFragments = 5, 
      includeContext = true,
      expandNeighbors = true 
    } = options;
    
    // Handle undefined or empty query
    if (!query || query.trim().length === 0) {
      return [];
    }
    
    const queryTerms = this.extractTerms(query);
    const chunkScores = new Map<string, number>();
    
    // Score chunks based on term overlap
    queryTerms.forEach(term => {
      const chunks = this.termChunkIndex.get(term);
      if (chunks) {
        chunks.forEach(chunkId => {
          chunkScores.set(chunkId, (chunkScores.get(chunkId) || 0) + 1);
        });
      }
    });
    
    // Boost scores based on chunk relationships
    if (expandNeighbors) {
      this.boostNeighborScores(chunkScores);
    }
    
    // Select top chunks with context
    const topChunks = Array.from(chunkScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxFragments);
    
    return topChunks.map(([chunkId, score]) => {
      const chunk = this.chunks.get(chunkId)!;
      const filePath = this.filePathMap.get(chunk.docId)!;
      const doc = this.getDocumentContent(chunk.docId);
      
      return {
        id: chunkId,
        docId: chunk.docId,
        docPath: filePath,
        content: chunk.content,
        score,
        lineStart: this.getLineNumber(doc, chunk.metadata.start),
        lineEnd: this.getLineNumber(doc, chunk.metadata.end),
        context: includeContext ? this.gatherContext(chunkId) : undefined,
        metadata: {
          ...chunk.metadata,
          chunkType: chunk.context.type
        }
      };
    });
  }
  
  private createSemanticChunks(content: string): SemanticSegment[] {
    const segments: SemanticSegment[] = [];
    
    // Split by multiple indicators
    const lines = content.split('\n');
    let currentSegment: string[] = [];
    let segmentStart = 0;
    let charOffset = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Detect semantic boundaries
      const isHeading = /^#+\s/.test(trimmed) || /^[A-Z][^.!?]*:$/.test(trimmed);
      const isListStart = /^[-*•]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed);
      const isEmptyLine = trimmed.length === 0;
      const isLongParagraph = currentSegment.join(' ').length > 500;
      const isCodeBlock = trimmed.startsWith('```');
      const inList = currentSegment.length > 0 && this.detectSegmentType(currentSegment) === 'list';
      
      // Decide whether to start new segment
      if ((isHeading || (isEmptyLine && currentSegment.length > 0 && !inList) || 
          isLongParagraph || isCodeBlock) && !isListStart) {
        if (currentSegment.length > 0) {
          segments.push({
            text: currentSegment.join('\n').trim(),
            type: this.detectSegmentType(currentSegment),
            start: segmentStart,
            end: charOffset - 1,
            depth: this.calculateDepth(currentSegment),
            before: segments.length > 0 ? segments[segments.length - 1].text.slice(-100) : '',
            after: '' // Will be filled later
          });
          currentSegment = [];
          segmentStart = charOffset;
        }
      }
      
      if (trimmed.length > 0 || isCodeBlock) {
        currentSegment.push(line);
      }
      
      charOffset += line.length + 1; // +1 for newline
    }
    
    // Add final segment
    if (currentSegment.length > 0) {
      segments.push({
        text: currentSegment.join('\n').trim(),
        type: this.detectSegmentType(currentSegment),
        start: segmentStart,
        end: charOffset - 1,
        depth: this.calculateDepth(currentSegment),
        before: segments.length > 0 ? segments[segments.length - 1].text.slice(-100) : '',
        after: ''
      });
    }
    
    // Fill in 'after' context
    for (let i = 0; i < segments.length - 1; i++) {
      segments[i].after = segments[i + 1].text.slice(0, 100);
    }
    
    return segments;
  }
  
  private detectSegmentType(lines: string[]): string {
    const firstLine = lines[0]?.trim() || '';
    
    if (/^#+\s/.test(firstLine)) return 'heading';
    if (/^```/.test(firstLine)) return 'code';
    if (/^[-*•]\s/.test(firstLine) || /^\d+\.\s/.test(firstLine)) return 'list';
    if (/^[A-Z][^.!?]*:$/.test(firstLine)) return 'section';
    if (lines.every(l => l.trim().startsWith('>'))) return 'quote';
    
    return 'paragraph';
  }
  
  private calculateDepth(lines: string[]): number {
    // Calculate semantic depth/importance
    const avgLineLength = lines.reduce((sum, l) => sum + l.length, 0) / lines.length;
    const hasCapitals = lines.some(l => /[A-Z]/.test(l));
    const hasPunctuation = lines.some(l => /[.!?]/.test(l));
    
    let depth = 1;
    if (avgLineLength > 50) depth++;
    if (hasCapitals) depth++;
    if (hasPunctuation) depth++;
    
    return depth;
  }
  
  private extractTerms(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }
  
  private addChunkRelation(chunk1: string, chunk2: string) {
    if (!this.chunkGraph.has(chunk1)) {
      this.chunkGraph.set(chunk1, new Set());
    }
    if (!this.chunkGraph.has(chunk2)) {
      this.chunkGraph.set(chunk2, new Set());
    }
    
    this.chunkGraph.get(chunk1)!.add(chunk2);
    this.chunkGraph.get(chunk2)!.add(chunk1);
  }
  
  private boostNeighborScores(scores: Map<string, number>) {
    const boosts = new Map<string, number>();
    
    scores.forEach((score, chunkId) => {
      const neighbors = this.chunkGraph.get(chunkId) || new Set();
      neighbors.forEach(neighbor => {
        // Give a small boost to neighboring chunks
        boosts.set(neighbor, (boosts.get(neighbor) || 0) + score * 0.1);
      });
    });
    
    // Apply boosts
    boosts.forEach((boost, chunkId) => {
      scores.set(chunkId, (scores.get(chunkId) || 0) + boost);
    });
  }
  
  private gatherContext(chunkId: string): ExpandedContext {
    const neighbors = this.chunkGraph.get(chunkId) || new Set();
    const chunk = this.chunks.get(chunkId)!;
    
    return {
      before: chunk.context.before,
      after: chunk.context.after,
      related: Array.from(neighbors).map(id => ({
        id,
        preview: this.chunks.get(id)?.content.slice(0, 100) || ''
      }))
    };
  }
  
  private getDocumentContent(docId: string): string {
    // Reconstruct document from chunks for line number calculation
    const docChunks = Array.from(this.chunks.values())
      .filter(chunk => chunk.docId === docId)
      .sort((a, b) => a.metadata.start - b.metadata.start);
    
    return docChunks.map(chunk => chunk.content).join('\n');
  }
  
  private getLineNumber(content: string, position: number): number {
    const lines = content.substring(0, position).split('\n');
    return lines.length;
  }
}
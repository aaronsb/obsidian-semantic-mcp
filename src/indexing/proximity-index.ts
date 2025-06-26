import {
  Fragment,
  TermPositions,
  TokenPosition,
  ProcessedDocument,
  PositionCluster
} from '../types/fragment.js';

/**
 * Proximity-based fragment extraction
 * Finds fragments where query terms appear close together
 */
export class ProximityFragmentIndex {
  private documents = new Map<string, ProcessedDocument>();
  private positionIndex = new Map<string, TermPositions[]>();
  private filePathMap = new Map<string, string>();
  
  indexDocument(docId: string, filePath: string, content: string) {
    const tokens = this.tokenizeWithPositions(content);
    
    // Store processed document
    this.documents.set(docId, {
      id: docId,
      content,
      tokens: tokens.map(t => t.token),
      positions: tokens
    });
    
    // Store file path mapping
    this.filePathMap.set(docId, filePath);
    
    // Build position index
    tokens.forEach(({ token, start, end }) => {
      if (!this.positionIndex.has(token)) {
        this.positionIndex.set(token, []);
      }
      this.positionIndex.get(token)!.push({
        docId,
        start,
        end
      });
    });
  }
  
  searchWithProximity(query: string, maxDistance: number = 50): Fragment[] {
    // Handle undefined or empty query
    if (!query || query.trim().length === 0) {
      return [];
    }
    
    const queryTokens = this.tokenize(query);
    const fragments: Fragment[] = [];
    
    // Find documents containing all query terms
    const docCandidates = this.findDocsWithAllTerms(queryTokens);
    
    for (const docId of docCandidates) {
      const doc = this.documents.get(docId)!;
      const filePath = this.filePathMap.get(docId)!;
      const termPositions = this.getTermPositionsInDoc(queryTokens, docId);
      
      // Find clusters where terms appear close together
      const clusters = this.findProximityClusters(
        termPositions, 
        maxDistance
      );
      
      // Extract fragments around clusters
      clusters.forEach((cluster, idx) => {
        const fragment = this.extractFragmentAroundCluster(
          doc.content,
          cluster,
          300 // context size
        );
        
        fragments.push({
          id: `${docId}:prox${idx}`,
          docId,
          docPath: filePath,
          content: fragment.text,
          score: this.scoreCluster(cluster, queryTokens.length),
          lineStart: this.getLineNumber(doc.content, fragment.start),
          lineEnd: this.getLineNumber(doc.content, fragment.end),
          metadata: {
            clusterSize: cluster.terms.size,
            proximity: cluster.end - cluster.start
          }
        });
      });
    }
    
    return fragments.sort((a, b) => b.score - a.score);
  }
  
  private tokenizeWithPositions(content: string): TokenPosition[] {
    const tokens: TokenPosition[] = [];
    const regex = /\b\w+\b/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const token = match[0].toLowerCase();
      if (token.length > 2) {
        tokens.push({
          token,
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }
    
    return tokens;
  }
  
  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .match(/\b\w+\b/g)
      ?.filter(t => t.length > 2) || [];
  }
  
  private findDocsWithAllTerms(queryTokens: string[]): Set<string> {
    if (queryTokens.length === 0) return new Set();
    
    // Start with documents containing the first term
    const firstTermDocs = new Set<string>();
    const firstTermPositions = this.positionIndex.get(queryTokens[0]);
    if (firstTermPositions) {
      firstTermPositions.forEach(pos => firstTermDocs.add(pos.docId));
    }
    
    // Intersect with documents containing other terms
    const candidates = new Set(firstTermDocs);
    for (let i = 1; i < queryTokens.length; i++) {
      const termDocs = new Set<string>();
      const termPositions = this.positionIndex.get(queryTokens[i]);
      if (termPositions) {
        termPositions.forEach(pos => termDocs.add(pos.docId));
      }
      
      // Keep only documents that have all terms so far
      candidates.forEach(doc => {
        if (!termDocs.has(doc)) candidates.delete(doc);
      });
    }
    
    return candidates;
  }
  
  private getTermPositionsInDoc(terms: string[], docId: string): Map<string, number[]> {
    const positions = new Map<string, number[]>();
    
    terms.forEach(term => {
      const termPositions = this.positionIndex.get(term);
      if (termPositions) {
        const docPositions = termPositions
          .filter(p => p.docId === docId)
          .map(p => p.start);
        if (docPositions.length > 0) {
          positions.set(term, docPositions);
        }
      }
    });
    
    return positions;
  }
  
  private findProximityClusters(
    termPositions: Map<string, number[]>,
    maxDistance: number
  ): PositionCluster[] {
    // Find groups of terms that appear near each other
    const allPositions: Array<{pos: number, term: string}> = [];
    
    termPositions.forEach((positions, term) => {
      positions.forEach(pos => allPositions.push({ pos, term }));
    });
    
    allPositions.sort((a, b) => a.pos - b.pos);
    
    const clusters: PositionCluster[] = [];
    let currentCluster: PositionCluster | null = null;
    
    for (const { pos, term } of allPositions) {
      if (!currentCluster || pos - currentCluster.end > maxDistance) {
        // Start new cluster
        currentCluster = {
          start: pos,
          end: pos,
          terms: new Set([term]),
          positions: [pos]
        };
        clusters.push(currentCluster);
      } else {
        // Extend current cluster
        currentCluster.end = pos;
        currentCluster.terms.add(term);
        currentCluster.positions.push(pos);
      }
    }
    
    return clusters.filter(c => c.terms.size >= 2); // At least 2 query terms
  }
  
  private scoreCluster(cluster: PositionCluster, totalQueryTerms: number): number {
    // Score based on term coverage and proximity
    const coverage = cluster.terms.size / totalQueryTerms;
    const density = cluster.terms.size / (cluster.end - cluster.start + 1);
    const proximityScore = 1 / (1 + Math.log(cluster.end - cluster.start + 1));
    
    return coverage * 0.5 + density * 0.3 + proximityScore * 0.2;
  }
  
  private extractFragmentAroundCluster(
    content: string,
    cluster: PositionCluster,
    contextSize: number
  ): { text: string; start: number; end: number } {
    // Find sentence boundaries around the cluster
    const start = Math.max(0, cluster.start - contextSize / 2);
    const end = Math.min(content.length, cluster.end + contextSize / 2);
    
    // Extend to sentence boundaries
    let fragmentStart = start;
    let fragmentEnd = end;
    
    // Look backward for sentence start
    for (let i = start; i >= 0; i--) {
      if (i === 0 || (i > 0 && '.!?'.includes(content[i - 1]))) {
        fragmentStart = i;
        break;
      }
    }
    
    // Look forward for sentence end
    for (let i = end; i < content.length; i++) {
      if ('.!?'.includes(content[i])) {
        fragmentEnd = i + 1;
        break;
      }
    }
    
    return {
      text: content.substring(fragmentStart, fragmentEnd).trim(),
      start: fragmentStart,
      end: fragmentEnd
    };
  }
  
  private getLineNumber(content: string, position: number): number {
    const lines = content.substring(0, position).split('\n');
    return lines.length;
  }
}
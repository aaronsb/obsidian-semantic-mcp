/**
 * Fuzzy matching utilities for finding approximate string matches
 */

export interface FuzzyMatch {
  line: string;
  lineNumber: number;
  similarity: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - (distance / maxLength);
}

/**
 * Find fuzzy matches in content
 */
export function findFuzzyMatches(
  content: string,
  searchText: string,
  threshold: number = 0.7,
  maxMatches: number = 5
): FuzzyMatch[] {
  const lines = content.split('\n');
  const matches: FuzzyMatch[] = [];
  
  // Normalize search text
  const normalizedSearch = searchText.toLowerCase().trim();
  const searchWords = normalizedSearch.split(/\s+/);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const normalizedLine = line.toLowerCase();
    
    // Try substring match first (more efficient)
    if (normalizedLine.includes(normalizedSearch)) {
      const startIndex = normalizedLine.indexOf(normalizedSearch);
      matches.push({
        line,
        lineNumber: i + 1,
        similarity: 1.0,
        startIndex,
        endIndex: startIndex + searchText.length
      });
      continue;
    }
    
    // Try matching key phrases
    let bestSimilarity = 0;
    let bestStart = 0;
    let bestEnd = line.length;
    
    // Sliding window approach for phrase matching
    const words = line.split(/\s+/);
    for (let start = 0; start < words.length; start++) {
      for (let end = start + 1; end <= Math.min(words.length, start + searchWords.length + 2); end++) {
        const phrase = words.slice(start, end).join(' ');
        const similarity = calculateSimilarity(phrase, searchText);
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestStart = line.indexOf(words[start]);
          bestEnd = line.indexOf(words[end - 1]) + words[end - 1].length;
        }
      }
    }
    
    if (bestSimilarity >= threshold) {
      matches.push({
        line,
        lineNumber: i + 1,
        similarity: bestSimilarity,
        startIndex: bestStart,
        endIndex: bestEnd
      });
    }
  }
  
  // Sort by similarity and return top matches
  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxMatches);
}

/**
 * Extract context around a line number
 */
export function extractContext(
  content: string,
  lineNumber: number,
  contextLines: number = 3
): { lines: string[]; startLine: number; endLine: number } {
  const allLines = content.split('\n');
  const startLine = Math.max(1, lineNumber - contextLines);
  const endLine = Math.min(allLines.length, lineNumber + contextLines);
  
  return {
    lines: allLines.slice(startLine - 1, endLine),
    startLine,
    endLine
  };
}
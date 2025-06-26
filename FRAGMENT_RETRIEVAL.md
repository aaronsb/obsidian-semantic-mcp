# Fragment Retrieval System

## Overview

The fragment retrieval system is designed to handle large Obsidian documents efficiently by automatically extracting and returning only the most relevant sections. This significantly reduces token consumption while maintaining high relevance for AI interactions.

## Architecture

### Core Components

1. **UniversalFragmentRetriever** (`src/indexing/fragment-retriever.ts`)
   - Orchestrates multiple indexing strategies
   - Auto-selects optimal strategy based on query characteristics
   - Manages document indexing and retrieval

2. **AdaptiveTextIndex** (`src/indexing/adaptive-index.ts`)
   - Implements TF-IDF (Term Frequency-Inverse Document Frequency) scoring
   - Best for keyword-based searches
   - Handles flexible term matching and scoring

3. **ProximityFragmentIndex** (`src/indexing/proximity-index.ts`)
   - Finds fragments where query terms appear close together
   - Uses positional indexing for proximity clustering
   - Optimal for multi-word phrases and concepts

4. **SemanticChunkIndex** (`src/indexing/semantic-chunk-index.ts`)
   - Splits documents into meaningful sections
   - Preserves context boundaries (paragraphs, sections)
   - Maintains relationships between chunks

### Data Flow

1. **Document Indexing**
   ```
   Document → Tokenization → Index Storage → Fragment Creation
   ```

2. **Fragment Retrieval**
   ```
   Query → Strategy Selection → Index Search → Fragment Scoring → Result Ranking
   ```

## Strategy Selection Algorithm

The system automatically selects the optimal strategy based on query characteristics:

```typescript
if (queryWords.length <= 2) {
  return 'adaptive';    // Short queries → keyword matching
} else if (queryWords.length <= 5) {
  return 'proximity';   // Medium queries → proximity search
} else {
  return 'semantic';    // Long queries → conceptual chunking
}
```

## Fragment Structure

Each fragment contains:

```typescript
interface Fragment {
  id: string;              // Unique identifier
  docId: string;           // Source document ID
  docPath: string;         // File path in vault
  content: string;         // Fragment text
  score: number;           // Relevance score
  lineStart: number;       // Starting line number
  lineEnd: number;         // Ending line number
  metadata?: {             // Optional metadata
    lineCount: number;
    clusterSize?: number;
    proximity?: number;
  };
  context?: {              // Optional context
    before?: string;
    after?: string;
    related?: Array<{id: string; preview: string}>;
  };
}
```

## Scoring Mechanisms

### Adaptive (TF-IDF) Scoring
- Term frequency in fragment
- Inverse document frequency across corpus
- Flexible matching (exact, partial, fuzzy)

### Proximity Scoring
- Distance between query terms
- Cluster density
- Context window size

### Semantic Scoring
- Chunk boundaries
- Structural importance
- Content coherence

## Integration with Semantic Router

The fragment retrieval system integrates seamlessly with the semantic router:

1. **Automatic Activation**: When reading files through `vault` operations
2. **Query Enhancement**: Uses file path as default query if none provided
3. **Metadata Preservation**: Maintains file metadata while replacing content
4. **Efficiency Hints**: Provides guidance on strategy selection

## Performance Characteristics

### Token Reduction
- Average reduction: 90-95% for large documents
- Typical fragment size: 500-2000 tokens
- Full document fallback available

### Speed
- Indexing: O(n) where n is document length
- Retrieval: O(log n) for most operations
- Memory: Efficient inverted index structure

### Accuracy
- Precision improves with query specificity
- Recall maintained through multiple strategies
- Context preservation ensures coherence

## Configuration

### Parameters

- `maxFragments`: Maximum fragments to return (default: 5)
- `strategy`: Force specific strategy (default: 'auto')
- `returnFullFile`: Bypass fragment retrieval (default: false)
- `fuzzyThreshold`: Matching tolerance (default: 0.8)

### Environment Variables

No specific environment variables required. The system uses the same configuration as the main MCP server.

## Error Handling

The system gracefully handles:
- Empty or undefined queries
- Missing documents
- Large files exceeding token limits
- Invalid strategy specifications

## Best Practices

1. **Query Formulation**
   - Use specific keywords for targeted results
   - Include context terms for better relevance
   - Let auto-strategy selection optimize retrieval

2. **Strategy Selection**
   - Trust auto-selection for most cases
   - Use 'adaptive' for known keywords
   - Use 'proximity' for phrases
   - Use 'semantic' for exploratory searches

3. **Performance Optimization**
   - Index documents once, search multiple times
   - Clear indexes when switching vaults
   - Monitor fragment count for efficiency

## Future Enhancements

Potential improvements:
- Vector embeddings for semantic similarity
- Learning from user feedback
- Cross-document fragment linking
- Incremental indexing updates
- Custom fragment boundaries
import { describe, it, expect, beforeEach } from '@jest/globals';
import { UniversalFragmentRetriever } from '../src/indexing/fragment-retriever';

describe('Fragment Retrieval Tests', () => {
  let retriever: UniversalFragmentRetriever;
  
  beforeEach(() => {
    retriever = new UniversalFragmentRetriever();
  });
  
  describe('AdaptiveTextIndex', () => {
    it('should index and retrieve fragments based on query', async () => {
      const content = `
# Financial Review Meeting
Date: May 7, 2025

## Key Topics

### Tax Recovery
We're expecting to recover about $200,000 in ITCs over the next few weeks. December alone accounts for $40,000.

### Employee Compensation
The total annual payroll is approximately $3.3-3.4 million across all entities. We need better visibility into these costs.

### Peru Write-off
There's a significant write-off of $2.5 million from Peru operations that needs to be handled for tax purposes.

### Controller Position
We're looking for a fractional controller based in Miami who can work about 1000 hours per year.
`;
      
      await retriever.indexDocument('doc1', 'financial-review.md', content);
      
      const result = await retriever.retrieveFragments('tax recovery', {
        strategy: 'adaptive',
        maxFragments: 3
      });
      
      expect(result.result.length).toBeGreaterThan(0);
      expect(result.result[0].content).toContain('$200,000');
      expect(result.result[0].lineStart).toBeGreaterThan(0);
      expect(result.result[0].docPath).toBe('financial-review.md');
    });
  });
  
  describe('ProximityIndex', () => {
    it('should find fragments where query terms appear close together', async () => {
      const content = `
The employee compensation system needs review. Our compensation analysis shows significant variations.

In another section, we discuss employee benefits separately from compensation structures.

The employee compensation review meeting is scheduled for next week to discuss salary adjustments.
`;
      
      await retriever.indexDocument('doc2', 'hr-notes.md', content);
      
      const result = await retriever.retrieveFragments('employee compensation', {
        strategy: 'proximity',
        maxFragments: 2
      });
      
      expect(result.result.length).toBeGreaterThan(0);
      // First and third paragraphs should score higher due to proximity
      expect(result.result[0].content).toMatch(/employee compensation/);
    });
  });
  
  describe('SemanticChunkIndex', () => {
    it('should create semantic chunks and preserve context', async () => {
      const content = `
# Project Overview

This is the introduction paragraph that sets the context.

## Technical Details

The implementation uses TypeScript and follows SOLID principles.
We ensure clean architecture throughout the codebase.

## Performance Metrics

- Response time: < 100ms
- Memory usage: < 512MB
- Concurrent users: 1000+

## Conclusion

The system meets all requirements.
`;
      
      await retriever.indexDocument('doc3', 'project-doc.md', content);
      
      const result = await retriever.retrieveFragments('performance metrics', {
        strategy: 'semantic',
        maxFragments: 2
      });
      
      expect(result.result.length).toBeGreaterThan(0);
      const firstFragment = result.result[0];
      // The chunk might be just the heading or include the list items
      expect(firstFragment.content).toMatch(/Performance Metrics|Response time/);
      expect(firstFragment.metadata?.chunkType).toBeDefined();
    });
  });
  
  describe('Auto Strategy Selection', () => {
    it('should select appropriate strategy based on query length', async () => {
      await retriever.indexDocument('doc4', 'test.md', 'Test content for strategy selection');
      
      // Short query - should use adaptive
      const shortResult = await retriever.retrieveFragments('test', { strategy: 'auto' });
      expect(shortResult.efficiency_hints).toBeDefined();
      expect(shortResult.efficiency_hints?.message).toContain('adaptive');
      
      // Medium query - should use proximity
      const mediumResult = await retriever.retrieveFragments('test content strategy', { strategy: 'auto' });
      expect(mediumResult.efficiency_hints).toBeDefined();
      expect(mediumResult.efficiency_hints?.message).toContain('proximity');
      
      // Long query - should use semantic
      const longResult = await retriever.retrieveFragments('test content for strategy selection and validation', { strategy: 'auto' });
      expect(longResult.efficiency_hints).toBeDefined();
      expect(longResult.efficiency_hints?.message).toContain('semantic');
    });
  });
  
  describe('Semantic Response Integration', () => {
    it('should provide workflow hints and context', async () => {
      const content = 'Sample content for testing semantic response integration';
      await retriever.indexDocument('doc5', 'sample.md', content);
      
      const result = await retriever.retrieveFragments('sample');
      
      expect(result.workflow).toBeDefined();
      expect(result.workflow?.suggested_next).toHaveLength(2);
      expect(result.context?.search_results).toBe(result.result.length);
      expect(result.context?.linked_files).toContain('sample.md');
    });
  });
});
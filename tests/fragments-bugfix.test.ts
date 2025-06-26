import { describe, it, expect } from '@jest/globals';
import { UniversalFragmentRetriever } from '../src/indexing/fragment-retriever';

describe('Fragment Retriever Bug Fixes', () => {
  it('should handle undefined query without throwing', async () => {
    const retriever = new UniversalFragmentRetriever();
    
    // Index a test document
    await retriever.indexDocument('doc1', 'test.md', 'This is a test document with some content');
    
    // This should not throw
    await expect(async () => {
      await retriever.retrieveFragments(undefined as any, { maxFragments: 3 });
    }).not.toThrow();
  });
  
  it('should handle empty query without throwing', async () => {
    const retriever = new UniversalFragmentRetriever();
    
    // Index a test document
    await retriever.indexDocument('doc1', 'test.md', 'This is a test document with some content');
    
    // This should not throw
    const result = await retriever.retrieveFragments('', { maxFragments: 3 });
    expect(result).toBeDefined();
    expect(result.result).toBeInstanceOf(Array);
  });
  
  it('should handle whitespace-only query', async () => {
    const retriever = new UniversalFragmentRetriever();
    
    // Index a test document
    await retriever.indexDocument('doc1', 'test.md', 'This is a test document with some content');
    
    // This should not throw
    const result = await retriever.retrieveFragments('   ', { maxFragments: 3 });
    expect(result).toBeDefined();
    expect(result.result).toBeInstanceOf(Array);
  });
});
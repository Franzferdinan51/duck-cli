/**
 * Duck Agent - Full-Text Search Module
 * TF-IDF based semantic search for the Sub-Conscious memory store
 * Works on top of the JSON file store (no native modules needed)
 */

import { StoredMemory } from './persistence/sqlite-store.js';

export interface SearchResult {
  memory: StoredMemory;
  score: number;
  highlights: string[];
}

export interface FTSIndex {
  documents: Map<string, FTSDocument>;
  idf: Map<string, number>;
  documentCount: number;
}

interface FTSDocument {
  id: string;
  terms: Map<string, number>;  // term → frequency
  termCount: number;
  content: string;
}

/**
 * TF-IDF powered full-text search
 * Lightweight implementation that doesn't require SQLite FTS5
 */
export class FTSSearch {
  private index: FTSIndex = {
    documents: new Map(),
    idf: new Map(),
    documentCount: 0
  };
  private minTermLength = 2;
  private maxTerms = 5000;

  /**
   * Tokenize text into search terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= this.minTermLength && t.length <= 30)
      .slice(0, this.maxTerms);
  }

  /**
   * Build or rebuild the FTS index from a list of memories
   */
  buildIndex(memories: StoredMemory[]): void {
    this.index = {
      documents: new Map(),
      idf: new Map(),
      documentCount: memories.length
    };

    // Count document frequencies for IDF
    const docFreq = new Map<string, number>();

    for (const memory of memories) {
      const content = `${memory.content} ${memory.context} ${memory.tags.join(' ')}`;
      const terms = this.tokenize(content);
      const uniqueTerms = new Set(terms);

      const doc: FTSDocument = {
        id: memory.id,
        terms: new Map(),
        termCount: terms.length,
        content
      };

      // Count term frequencies
      for (const term of terms) {
        doc.terms.set(term, (doc.terms.get(term) || 0) + 1);
      }

      this.index.documents.set(memory.id, doc);

      // Update document frequency
      for (const term of uniqueTerms) {
        docFreq.set(term, (docFreq.get(term) || 0) + 1);
      }
    }

    // Calculate IDF (Inverse Document Frequency)
    const N = this.index.documentCount;
    for (const [term, df] of docFreq) {
      // Smooth IDF to avoid division by zero
      this.index.idf.set(term, Math.log((N + 1) / (df + 1)) + 1);
    }
  }

  /**
   * Add or update a single document in the index
   */
  indexDocument(memory: StoredMemory): void {
    const content = `${memory.content} ${memory.context} ${memory.tags.join(' ')}`;
    const terms = this.tokenize(content);
    const uniqueTerms = new Set(terms);

    const doc: FTSDocument = {
      id: memory.id,
      terms: new Map(),
      termCount: terms.length,
      content
    };

    for (const term of terms) {
      doc.terms.set(term, (doc.terms.get(term) || 0) + 1);
    }

    // Update IDF for new terms
    const N = this.index.documentCount + 1;
    for (const term of uniqueTerms) {
      if (!this.index.idf.has(term)) {
        this.index.idf.set(term, Math.log((N + 1) / 2) + 1);
      }
    }

    this.index.documents.set(memory.id, doc);
    this.index.documentCount++;
  }

  /**
   * Remove a document from the index
   */
  removeDocument(id: string): void {
    this.index.documents.delete(id);
    this.index.documentCount = Math.max(1, this.index.documentCount - 1);
  }

  /**
   * Search indexed documents using TF-IDF scoring
   */
  search(query: string, memories: StoredMemory[], limit = 10): SearchResult[] {
    if (this.index.documentCount === 0) {
      return this.basicSearch(query, memories, limit);
    }

    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) {
      return this.basicSearch(query, memories, limit);
    }

    const scores = new Map<string, number>();
    const highlights = new Map<string, string[]>();

    for (const memory of memories) {
      const doc = this.index.documents.get(memory.id);
      if (!doc) continue;

      let score = 0;
      const matchedTerms: string[] = [];

      for (const queryTerm of queryTerms) {
        const tf = doc.terms.get(queryTerm) || 0;
        const idf = this.index.idf.get(queryTerm) || 1;

        // TF-IDF score for this term
        const termScore = tf * idf;
        if (termScore > 0) {
          matchedTerms.push(queryTerm);
        }
        score += termScore;
      }

      // Normalize by document length
      if (doc.termCount > 0) {
        score = score / Math.sqrt(doc.termCount);
      }

      // Boost by importance
      score *= (memory.importance || 1);

      // Boost by recency (fresh memories rank higher)
      const ageMs = Date.now() - new Date(memory.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyBoost = 1 / (1 + ageDays * 0.01);
      score *= recencyBoost;

      if (score > 0) {
        scores.set(memory.id, score);
        highlights.set(memory.id, matchedTerms);
      }
    }

    // Sort by score descending
    const sortedIds = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    return sortedIds.map(id => {
      const memory = memories.find(m => m.id === id)!;
      return {
        memory,
        score: scores.get(id) || 0,
        highlights: this.generateHighlights(highlights.get(id) || [], memory)
      };
    });
  }

  /**
   * Semantic search - expand query with related terms
   */
  async semanticSearch(
    query: string,
    memories: StoredMemory[],
    limit = 10
  ): Promise<SearchResult[]> {
    // First do regular search
    const results = this.search(query, memories, limit * 2);

    // If we have results, expand query with terms from top results
    if (results.length > 0) {
      const topDoc = this.index.documents.get(results[0].memory.id);
      if (topDoc) {
        // Get top terms from the best matching document
        const expansionTerms = Array.from(topDoc.terms.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([term]) => term)
          .filter(t => !query.toLowerCase().includes(t));

        if (expansionTerms.length > 0) {
          const expandedQuery = `${query} ${expansionTerms.join(' ')}`;
          return this.search(expandedQuery, memories, limit);
        }
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Generate highlighted snippets showing matched terms
   */
  private generateHighlights(terms: string[], memory: StoredMemory): string[] {
    const highlights: string[] = [];
    const content = memory.content.slice(0, 300);

    for (const term of terms.slice(0, 3)) {
      const regex = new RegExp(`(.{0,30})(${term})(.{0,30})`, 'gi');
      const match = regex.exec(content);
      if (match) {
        highlights.push(`...${match[1]}<mark>${match[2]}</mark>${match[3]}...`);
      }
    }

    return highlights;
  }

  /**
   * Fallback basic substring search
   */
  private basicSearch(query: string, memories: StoredMemory[], limit: number): SearchResult[] {
    const q = query.toLowerCase();

    return memories
      .map(memory => {
        let score = 0;
        const highlights: string[] = [];

        if (memory.content.toLowerCase().includes(q)) score += 10;
        if (memory.context.toLowerCase().includes(q)) score += 5;
        if (memory.tags.some(t => t.toLowerCase().includes(q))) score += 3;

        if (memory.importance) score *= memory.importance;

        if (score > 0) {
          const idx = memory.content.toLowerCase().indexOf(q);
          if (idx >= 0) {
            const start = Math.max(0, idx - 30);
            const end = Math.min(memory.content.length, idx + q.length + 30);
            highlights.push(`...${memory.content.slice(start, end)}...`);
          }
        }

        return { memory, score, highlights };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get index statistics
   */
  getStats(): { indexedDocs: number; vocabularySize: number; avgDocLength: number } {
    let totalTerms = 0;
    for (const doc of this.index.documents.values()) {
      totalTerms += doc.termCount;
    }

    return {
      indexedDocs: this.index.documents.size,
      vocabularySize: this.index.idf.size,
      avgDocLength: this.index.documents.size > 0
        ? Math.round(totalTerms / this.index.documents.size)
        : 0
    };
  }
}

// Singleton FTS index for the daemon
let ftsInstance: FTSSearch | null = null;

export function getFTSIndex(): FTSSearch {
  if (!ftsInstance) {
    ftsInstance = new FTSSearch();
  }
  return ftsInstance;
}

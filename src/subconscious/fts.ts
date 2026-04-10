/**
 * Full Text Search - Simple FTS implementation
 */

export class FullTextSearch {
  private documents: Map<string, { title: string; content: string }> = new Map();

  addDocument(id: string, title: string, content: string): void {
    this.documents.set(id, { title, content });
  }

  search(query: string): Array<{ id: string; title: string; score: number }> {
    const results: Array<{ id: string; title: string; score: number }> = [];
    const lowerQuery = query.toLowerCase();

    for (const [id, doc] of this.documents) {
      let score = 0;
      if (doc.title.toLowerCase().includes(lowerQuery)) score += 2;
      if (doc.content.toLowerCase().includes(lowerQuery)) score += 1;
      
      if (score > 0) {
        results.push({ id, title: doc.title, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}

export default FullTextSearch;

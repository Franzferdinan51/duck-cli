/**
 * 🦆 Duck CLI - Wiki Ingestion and Search System
 * Ingest markdown files, URLs, text into a searchable wiki knowledge base
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname, relative } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

export interface WikiPage {
  id: string;
  title: string;
  content: string;
  source: string;        // file path or URL
  sourceType: 'file' | 'url' | 'text' | 'directory';
  tags: string[];
  headings: string[];    // extracted H1-H6 headings
  links: string[];      // outbound links in the content
  createdAt: number;
  updatedAt: number;
  wordCount: number;
  language: string;
}

export interface WikiSearchResult {
  page: WikiPage;
  matchType: 'title' | 'heading' | 'content';
  snippet: string;
  lineNumber?: number;
}

// ─── Markdown Parser ─────────────────────────────────────────────────────────

export class MarkdownParser {
  extractHeadings(content: string): string[] {
    const headings: string[] = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const m = line.match(/^(#{1,6})\s+(.+)$/);
      if (m) headings.push(m[2].trim());
    }
    return headings;
  }

  extractLinks(content: string): string[] {
    const links: string[] = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      if (!m[2].startsWith('#')) links.push(m[2]);
    }
    return [...new Set(links)];
  }

  extractTitle(content: string, filename?: string): string {
    // Try H1 first
    const h1 = content.match(/^#\s+(.+)$/m);
    if (h1) return h1[1].trim();
    // Try first non-empty line
    const firstLine = content.split('\n').find(l => l.trim().length > 0);
    if (firstLine) return firstLine.trim().substring(0, 100);
    // Fallback to filename
    return filename || 'Untitled';
  }

  detectLanguage(content: string): string {
    const langPatterns: [RegExp, string][] = [
      [/import\s+.*\s+from\s+['"][^'"]+['"]/g, 'typescript'],
      [/from\s+['"][^'"]+['"]\s+import/g, 'typescript'],
      [/interface\s+\w+\s*\{/g, 'typescript'],
      [/def\s+\w+\s*\(/g, 'python'],
      [/class\s+\w+.*:\s*$/gm, 'python'],
      [/func\s+\w+\s*\(/g, 'go'],
      [/func\s+\w+\s*\(/g, 'go'],
      [/package\s+\w+/g, 'go'],
      [/public\s+(class|interface|enum)/g, 'java'],
      [/<\?php/g, 'php'],
      [/<[a-z]+[^>]*>/gi, 'html'],
      [/\.md\b|\.markdown\b/, 'markdown'],
    ];
    for (const [pattern, lang] of langPatterns) {
      if (pattern.test(content)) return lang;
    }
    return 'text';
  }

  getWordCount(content: string): number {
    return content.split(/\s+/).filter(w => w.length > 0).length;
  }

  cleanContent(content: string): string {
    return content
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]+`/g, '')         // Remove inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/[#*_~>`-]/g, '')      // Remove markdown syntax
      .replace(/\s+/g, ' ')            // Collapse whitespace
      .trim();
  }
}

// ─── Wiki System ─────────────────────────────────────────────────────────────

export class WikiSystem {
  private wikiDir: string;
  private storePath: string;
  private pages: Map<string, WikiPage> = new Map();
  private index: Map<string, Set<string>> = new Map(); // word → page IDs
  private parser = new MarkdownParser();
  private initialized = false;

  constructor(wikiDir?: string) {
    this.wikiDir = wikiDir || join(homedir(), '.duck', 'wiki');
    this.storePath = join(this.wikiDir, 'wiki-store.json');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!existsSync(this.wikiDir)) {
      mkdirSync(this.wikiDir, { recursive: true });
    }
    if (existsSync(this.storePath)) {
      try {
        const data = JSON.parse(readFileSync(this.storePath, 'utf-8'));
        this.pages = new Map(Object.entries(data.pages || {}));
        this.rebuildIndex();
      } catch { /* corrupted, start fresh */ }
    }
    this.initialized = true;
  }

  async ingestFile(filePath: string, options?: { tags?: string[]; overwrite?: boolean }): Promise<string> {
    await this.initialize();
    if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

    const content = readFileSync(filePath, 'utf-8');
    return this.ingestText(content, basename(filePath), {
      source: filePath,
      sourceType: 'file',
      tags: options?.tags,
      overwrite: options?.overwrite,
    });
  }

  async ingestDirectory(dirPath: string, options?: {
    recursive?: boolean;
    extensions?: string[];
    tags?: string[];
    overwrite?: boolean;
  }): Promise<{ ingested: number; skipped: number; errors: string[] }> {
    await this.initialize();
    const exts = options?.extensions || ['.md', '.markdown', '.txt', '.html'];
    const result = { ingested: 0, skipped: 0, errors: [] as string[] };

    const scan = async (dir: string) => {
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory() && options?.recursive) {
            await scan(fullPath);
          } else if (stat.isFile() && exts.includes(extname(entry))) {
            const id = await this.ingestFile(fullPath, {
              tags: options?.tags,
              overwrite: options?.overwrite,
            });
            if (id) result.ingested++;
            else result.skipped++;
          }
        } catch (e: any) {
          result.errors.push(`${entry}: ${e.message}`);
        }
      }
    };

    await scan(dirPath);
    return result;
  }

  async ingestText(
    content: string,
    title: string,
    options?: {
      source?: string;
      sourceType?: WikiPage['sourceType'];
      tags?: string[];
      id?: string;
      overwrite?: boolean;
    }
  ): Promise<string> {
    await this.initialize();
    const id = options?.id || this.genId();
    const headings = this.parser.extractHeadings(content);
    const links = this.parser.extractLinks(content);
    const detectedTitle = title || this.parser.extractTitle(content);
    const wordCount = this.parser.getWordCount(content);

    const page: WikiPage = {
      id,
      title: detectedTitle,
      content,
      source: options?.source || 'text',
      sourceType: options?.sourceType || 'text',
      tags: options?.tags || [],
      headings,
      links,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      wordCount,
      language: this.parser.detectLanguage(content),
    };

    if (this.pages.has(id) && !options?.overwrite) {
      return ''; // already exists, skip
    }

    this.pages.set(id, page);
    this.indexPage(page);
    this.persist();

    return id;
  }

  async ingestUrl(url: string, options?: { tags?: string[]; title?: string }): Promise<string> {
    await this.initialize();
    // Use web_fetch if available
    let content = '';
    let title = options?.title || url;

    try {
      const { execSync } = await import('child_process');
      const fetchResult = execSync(
        `curl -sL "${url}" | head -c 50000`,
        { encoding: 'utf-8', timeout: 15000 }
      );
      // Simple HTML → text strip
      content = fetchResult
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (e) {
      throw new Error(`Failed to fetch URL: ${e}`);
    }

    return this.ingestText(content, title, {
      source: url,
      sourceType: 'url',
      tags: options?.tags,
    });
  }

  async search(query: string, options?: {
    limit?: number;
    tags?: string[];
    sourceType?: WikiPage['sourceType'];
  }): Promise<WikiSearchResult[]> {
    await this.initialize();
    const limit = options?.limit || 10;
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const results: WikiSearchResult[] = [];

    for (const page of this.pages.values()) {
      // Filter
      if (options?.tags?.length && !options.tags.some(t => page.tags.includes(t))) continue;
      if (options?.sourceType && page.sourceType !== options.sourceType) continue;

      // Score
      const titleLower = page.title.toLowerCase();
      const contentLower = page.content.toLowerCase();
      const headingsText = page.headings.join(' ').toLowerCase();

      let matchType: WikiSearchResult['matchType'] = 'content';
      let score = 0;
      let snippet = '';

      // Title match (highest)
      if (queryWords.every(w => titleLower.includes(w))) {
        matchType = 'title';
        score = 10;
        snippet = page.title;
      } else if (queryWords.some(w => headingsText.includes(w))) {
        matchType = 'heading';
        score = 5;
        // Find matching heading
        for (const h of page.headings) {
          if (queryWords.some(w => h.toLowerCase().includes(w))) {
            snippet = h;
            break;
          }
        }
      } else if (queryWords.every(w => contentLower.includes(w))) {
        score = 2;
        // Extract snippet around match
        const idx = contentLower.indexOf(queryWords[0]);
        const start = Math.max(0, idx - 60);
        const end = Math.min(page.content.length, idx + 120);
        snippet = (start > 0 ? '...' : '') + page.content.substring(start, end).replace(/\n/g, ' ') + (end < page.content.length ? '...' : '');
      }

      if (score > 0) {
        results.push({ page, matchType, snippet });
      }
    }

    results.sort((a, b) => {
      const typeOrder = { title: 0, heading: 1, content: 2 };
      return typeOrder[a.matchType] - typeOrder[b.matchType];
    });

    return results.slice(0, limit);
  }

  get(id: string): WikiPage | null {
    return this.pages.get(id) || null;
  }

  list(options?: {
    tags?: string[];
    sourceType?: WikiPage['sourceType'];
    limit?: number;
    offset?: number;
  }): WikiPage[] {
    let results = Array.from(this.pages.values());
    if (options?.tags?.length) {
      results = results.filter(p => options.tags!.some(t => p.tags.includes(t)));
    }
    if (options?.sourceType) {
      results = results.filter(p => p.sourceType === options.sourceType);
    }
    results.sort((a, b) => b.updatedAt - a.updatedAt);
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return results.slice(offset, offset + limit);
  }

  async delete(id: string): Promise<boolean> {
    await this.initialize();
    if (!this.pages.has(id)) return false;
    this.pages.delete(id);
    this.rebuildIndex();
    this.persist();
    return true;
  }

  stats(): {
    total: number;
    bySourceType: Record<string, number>;
    byTag: Record<string, number>;
    totalWords: number;
    totalHeadings: number;
  } {
    const bySourceType: Record<string, number> = {};
    const byTag: Record<string, number> = {};
    let totalWords = 0;
    let totalHeadings = 0;

    for (const page of this.pages.values()) {
      bySourceType[page.sourceType] = (bySourceType[page.sourceType] || 0) + 1;
      totalWords += page.wordCount;
      totalHeadings += page.headings.length;
      for (const tag of page.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }

    return {
      total: this.pages.size,
      bySourceType,
      byTag,
      totalWords,
      totalHeadings,
    };
  }

  exportJson(path?: string): string {
    const data = Object.fromEntries(this.pages);
    const out = JSON.stringify(data, null, 2);
    if (path) {
      writeFileSync(path, out, { mode: 0o600 });
    }
    return out;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private indexPage(page: WikiPage): void {
    // Remove old index entries for this page
    for (const ids of this.index.values()) {
      ids.delete(page.id);
    }

    // Index title and headings with high weight
    const titleWords = this.tokenize(page.title);
    const headingWords = page.headings.flatMap(h => this.tokenize(h));
    const contentWords = this.tokenize(page.content.substring(0, 10000));

    for (const word of [...titleWords, ...headingWords, ...contentWords]) {
      if (!this.index.has(word)) {
        this.index.set(word, new Set());
      }
      this.index.get(word)!.add(page.id);
    }
  }

  private rebuildIndex(): void {
    this.index.clear();
    for (const page of this.pages.values()) {
      this.indexPage(page);
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  }

  private genId(): string {
    return randomBytes(6).toString('hex');
  }

  private persist(): void {
    const data = Object.fromEntries(this.pages);
    writeFileSync(this.storePath, JSON.stringify(data), { mode: 0o600 });
  }
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one',
  'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now',
  'old', 'see', 'two', 'way', 'who', 'did', 'get', 'got', 'let', 'put', 'set', 'run',
  'use', 'via', 'from', 'this', 'that', 'with', 'have', 'been', 'were', 'they',
]);

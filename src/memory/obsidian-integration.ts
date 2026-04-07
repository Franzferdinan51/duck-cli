/**
 * 🦆 Duck CLI - Obsidian Memory Integration
 * 
 * Uses Obsidian as the memory UI while keeping data in markdown files.
 * No vendor lock-in, full local control.
 * 
 * Setup:
 * 1. Install Obsidian: https://obsidian.md
 * 2. Create vault at: ~/.openclaw/workspace/memory-vault
 * 3. Install "Local REST API" plugin in Obsidian
 * 4. Configure API key in .env: OBSIDIAN_API_KEY=your_key
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || 
  join(homedir(), '.openclaw', 'workspace', 'memory-vault');
const API_URL = process.env.OBSIDIAN_API_URL || 'http://127.0.0.1:27123';
const API_KEY = process.env.OBSIDIAN_API_KEY;

export interface Memory {
  id: string;
  content: string;
  type: 'session' | 'insight' | 'decision' | 'code' | 'learning';
  source: string;
  timestamp: Date;
  tags: string[];
  relatedIds: string[];
}

/**
 * Ensure vault directory exists
 */
function ensureVault(): void {
  if (!existsSync(VAULT_PATH)) {
    mkdirSync(VAULT_PATH, { recursive: true });
    console.log(`[Obsidian] Created vault at ${VAULT_PATH}`);
  }
}

/**
 * Generate memory ID
 */
function generateId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Format memory as markdown with frontmatter
 */
function formatMemory(memory: Memory): string {
  const frontmatter = `---
id: ${memory.id}
type: ${memory.type}
source: ${memory.source}
timestamp: ${memory.timestamp.toISOString()}
tags: [${memory.tags.map(t => `"${t}"`).join(', ')}]
related: [${memory.relatedIds.join(', ')}]
---

# ${memory.type.charAt(0).toUpperCase() + memory.type.slice(1)}: ${memory.id.slice(0, 8)}

${memory.content}

## Metadata
- **Created**: ${memory.timestamp.toLocaleString()}
- **Source**: ${memory.source}
- **Tags**: ${memory.tags.join(', ') || 'none'}
${memory.relatedIds.length > 0 ? `- **Related**: ${memory.relatedIds.join(', ')}` : ''}
`;
  return frontmatter;
}

/**
 * Parse markdown file back to memory
 */
function parseMemory(content: string, filename: string): Memory | null {
  try {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) return null;
    
    const frontmatter = frontmatterMatch[1];
    const body = frontmatterMatch[2].trim();
    
    const parseField = (field: string): string => {
      const match = frontmatter.match(new RegExp(`${field}:\\s*(.+)`));
      return match ? match[1].trim() : '';
    };
    
    const parseArray = (field: string): string[] => {
      const match = frontmatter.match(new RegExp(`${field}:\\s*\\[(.*?)\\]`));
      if (!match) return [];
      return match[1].split(',').map(s => s.trim().replace(/"/g, '')).filter(Boolean);
    };
    
    return {
      id: parseField('id') || basename(filename, '.md'),
      content: body.replace(/^#.*\n/, '').trim(), // Remove title
      type: parseField('type') as Memory['type'] || 'session',
      source: parseField('source') || 'unknown',
      timestamp: new Date(parseField('timestamp') || Date.now()),
      tags: parseArray('tags'),
      relatedIds: parseArray('related'),
    };
  } catch (e) {
    console.error(`[Obsidian] Failed to parse ${filename}:`, e);
    return null;
  }
}

/**
 * Save a memory to the vault
 */
export function saveMemory(memory: Partial<Memory>): Memory {
  ensureVault();
  
  const fullMemory: Memory = {
    id: memory.id || generateId(),
    content: memory.content || '',
    type: memory.type || 'session',
    source: memory.source || 'duck-cli',
    timestamp: memory.timestamp || new Date(),
    tags: memory.tags || [],
    relatedIds: memory.relatedIds || [],
  };
  
  const filename = `${fullMemory.id}.md`;
  const filepath = join(VAULT_PATH, filename);
  
  writeFileSync(filepath, formatMemory(fullMemory));
  console.log(`[Obsidian] Saved memory: ${filename}`);
  
  return fullMemory;
}

/**
 * Load a memory by ID
 */
export function loadMemory(id: string): Memory | null {
  const filepath = join(VAULT_PATH, `${id}.md`);
  
  if (!existsSync(filepath)) {
    return null;
  }
  
  const content = readFileSync(filepath, 'utf-8');
  return parseMemory(content, `${id}.md`);
}

/**
 * List all memories
 */
export function listMemories(): Memory[] {
  ensureVault();
  
  if (!existsSync(VAULT_PATH)) {
    return [];
  }
  
  const files = readdirSync(VAULT_PATH).filter(f => f.endsWith('.md'));
  const memories: Memory[] = [];
  
  for (const file of files) {
    const content = readFileSync(join(VAULT_PATH, file), 'utf-8');
    const memory = parseMemory(content, file);
    if (memory) memories.push(memory);
  }
  
  // Sort by timestamp (newest first)
  return memories.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Search memories by content
 */
export function searchMemories(query: string): Memory[] {
  const all = listMemories();
  const lowerQuery = query.toLowerCase();
  
  return all.filter(m => 
    m.content.toLowerCase().includes(lowerQuery) ||
    m.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
    m.source.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get memories by type
 */
export function getMemoriesByType(type: Memory['type']): Memory[] {
  return listMemories().filter(m => m.type === type);
}

/**
 * Get recent memories
 */
export function getRecentMemories(limit: number = 10): Memory[] {
  return listMemories().slice(0, limit);
}

/**
 * Create a daily note (Obsidian style)
 */
export function createDailyNote(content: string, tags: string[] = []): Memory {
  const today = new Date().toISOString().split('T')[0];
  return saveMemory({
    id: `daily-${today}`,
    content,
    type: 'session',
    source: 'daily-note',
    tags: ['daily', ...tags],
  });
}

/**
 * Link memories together
 */
export function linkMemories(id1: string, id2: string): void {
  const mem1 = loadMemory(id1);
  const mem2 = loadMemory(id2);
  
  if (mem1 && !mem1.relatedIds.includes(id2)) {
    mem1.relatedIds.push(id2);
    saveMemory(mem1);
  }
  
  if (mem2 && !mem2.relatedIds.includes(id1)) {
    mem2.relatedIds.push(id1);
    saveMemory(mem2);
  }
}

// Export for use in other modules
export { VAULT_PATH, API_URL };

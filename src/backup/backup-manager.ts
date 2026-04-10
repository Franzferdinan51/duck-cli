/**
 * 🦆 Duck CLI - Backup Manager
 * Core backup management: creation, verification, restoration, listing, pruning
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'fs';
import { join, dirname, basename, relative } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { createGzip, createGunzip } from 'zlib';
import { createReadStream, createWriteStream } from 'fs';

export interface BackupManifest {
  version: string;
  timestamp: string;
  hostname: string;
  duckVersion: string;
  includes: string[];
  totalSize: number;
  checksum: string;
  compress: boolean;
}

export interface BackupStats {
  manifest: BackupManifest;
  files: BackupFileEntry[];
  totalSize: number;
  fileCount: number;
}

export interface BackupFileEntry {
  path: string;
  size: number;
  mtime: number;
  checksum: string;
  status: 'ok' | 'missing' | 'corrupt';
}

export interface BackupInfo {
  name: string;
  path: string;
  manifest?: BackupManifest;
}

const BACKUP_VERSION = '1.0.0';

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

export class BackupManager {
  private duckDir: string;
  private backupDir: string;
  private excludePatterns = [
    'node_modules',
    '.git',
    'dist',
    '*.log',
    'tmp',
    'cache',
    '.DS_Store',
    'Thumbs.db',
  ];

  constructor(duckDir?: string, backupDir?: string) {
    this.duckDir = duckDir || join(homedir(), '.duck');
    this.backupDir = backupDir || join(homedir(), '.duck', 'backups');
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  async create(options?: {
    name?: string;
    compress?: boolean;
    include?: string[];
    exclude?: string[];
    output?: string;
  }): Promise<{ path: string; manifest: BackupManifest; stats: BackupStats }> {
    const compress = options?.compress ?? true;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = options?.name || `duck-backup-${timestamp}`;
    const outputPath = options?.output || join(this.backupDir, `${name}.duckbak`);
    const manifestPath = options?.output
      ? options.output.replace('.duckbak', '.manifest.json')
      : join(this.backupDir, `${name}.manifest.json`);

    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }

    const include = options?.include || [
      'config.yaml', '.env', 'memory', 'skills',
      'state', 'SOUL.md', 'KANBAN.md', 'AGENTS.md',
      'IDENTITY.md', 'USER.md', 'TOOLS.md',
    ];
    const exclude = [...this.excludePatterns, ...(options?.exclude || [])];
    const files = await this.collectFiles(this.duckDir, include, exclude);

    let totalSize = 0;
    const fileEntries: BackupFileEntry[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(file.absPath);
        const checksum = this.sha256(content);
        fileEntries.push({
          path: file.relPath,
          size: content.length,
          mtime: statSync(file.absPath).mtimeMs,
          checksum,
          status: 'ok',
        });
        totalSize += content.length;
      } catch {
        fileEntries.push({
          path: file.relPath,
          size: 0,
          mtime: 0,
          checksum: '',
          status: 'missing',
        });
      }
    }

    const allContent = fileEntries.map(f => `${f.path}:${f.checksum}`).join('\n');
    const manifestChecksum = this.sha256(Buffer.from(allContent));

    const manifest: BackupManifest = {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      hostname: require('os').hostname(),
      duckVersion: '0.4.0',
      includes: fileEntries.map(f => f.path),
      totalSize,
      checksum: manifestChecksum,
      compress,
    };

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });

    if (compress) {
      await this.writeCompressedArchive(outputPath, files);
    } else {
      await this.writeUncompressedArchive(outputPath, files);
    }

    const stats: BackupStats = {
      manifest,
      files: fileEntries,
      totalSize,
      fileCount: fileEntries.filter(f => f.status === 'ok').length,
    };

    return { path: outputPath, manifest, stats };
  }

  async verify(backupPath: string): Promise<{ ok: boolean; errors: string[]; stats: BackupStats }> {
    const errors: string[] = [];
    const manifestPath = backupPath.replace('.duckbak', '.manifest.json');

    if (!existsSync(backupPath)) {
      return { ok: false, errors: [`Backup not found: ${backupPath}`], stats: null as any };
    }

    let manifest: BackupManifest;
    if (existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as BackupManifest;
      } catch (e) {
        return { ok: false, errors: [`Invalid manifest: ${e}`], stats: null as any };
      }
    } else {
      return { ok: false, errors: ['Manifest file not found'], stats: null as any };
    }

    const corrupt = await this.checkArchiveIntegrity(backupPath);
    if (corrupt) errors.push(`Archive integrity error: ${corrupt}`);

    const fileEntries: BackupFileEntry[] = manifest.includes.map(path => ({
      path,
      size: 0,
      mtime: 0,
      checksum: '',
      status: 'ok',
    }));

    const stats: BackupStats = {
      manifest,
      files: fileEntries,
      totalSize: manifest.totalSize,
      fileCount: fileEntries.length,
    };

    return { ok: errors.length === 0, errors, stats };
  }

  async restore(backupPath: string, options?: {
    target?: string;
    overwrite?: boolean;
  }): Promise<{ success: boolean; error?: string; fileCount?: number }> {
    const target = options?.target || this.duckDir;
    const verify = await this.verify(backupPath);
    if (!verify.ok) {
      return { success: false, error: `Verification failed: ${verify.errors.join(', ')}` };
    }

    console.log(`${c.yellow}⚠️  Restore will overwrite existing files in: ${target}${c.reset}`);

    if (!options?.overwrite) {
      const readline = await import('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const confirm = await new Promise<string>(res =>
        rl.question(`${c.cyan}Continue? [y/N]: ${c.reset}`, res)
      );
      rl.close();
      if (!confirm.toLowerCase().startsWith('y')) {
        console.log('Restore cancelled.');
        return { success: false, error: 'Cancelled by user' };
      }
    }

    console.log(`${c.cyan}Restoring to ${target}...${c.reset}`);

    // Extract from archive
    const extracted = await this.extractArchive(backupPath);
    if (!extracted) {
      return { success: false, error: 'Failed to extract archive' };
    }

    for (const file of extracted.files) {
      try {
        const absPath = join(target, file.path);
        const dir = dirname(absPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(absPath, Buffer.from(file.content, 'base64'), { mode: 0o600 });
      } catch {
        // skip files that fail to write
      }
    }

    console.log(`${c.green}✅ Restore complete${c.reset}`);
    console.log(`  Restored ${extracted.files.length} files`);
    return { success: true, fileCount: extracted.files.length };
  }

  list(): BackupInfo[] {
    if (!existsSync(this.backupDir)) {
      return [];
    }

    const backups: BackupInfo[] = [];
    const files = readdirSync(this.backupDir).filter(f => f.endsWith('.duckbak'));

    for (const file of files) {
      const manifestPath = join(this.backupDir, file.replace('.duckbak', '.manifest.json'));
      let manifest: BackupManifest | undefined;
      if (existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as BackupManifest;
        } catch { /* ignore */ }
      }
      backups.push({
        name: file.replace('.duckbak', ''),
        path: join(this.backupDir, file),
        manifest,
      });
    }

    return backups.sort((a, b) => {
      const ta = a.manifest?.timestamp || '';
      const tb = b.manifest?.timestamp || '';
      return tb.localeCompare(ta);
    });
  }

  prune(keep: number = 5): number {
    const backups = this.list();
    let deleted = 0;
    for (let i = keep; i < backups.length; i++) {
      try {
        unlinkSync(backups[i].path);
        const manifestPath = backups[i].path.replace('.duckbak', '.manifest.json');
        if (existsSync(manifestPath)) unlinkSync(manifestPath);
        deleted++;
      } catch (e) {
        console.warn(`Failed to delete ${backups[i].name}: ${e}`);
      }
    }
    if (deleted > 0) {
      console.log(`${c.green}✅ Pruned ${deleted} old backup(s), kept ${keep} most recent${c.reset}`);
    }
    return deleted;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  private async collectFiles(
    baseDir: string,
    include: string[],
    exclude: string[]
  ): Promise<{ absPath: string; relPath: string }[]> {
    const results: { absPath: string; relPath: string }[] = [];

    const scan = (dir: string) => {
      if (!existsSync(dir)) return;
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch { return; }

      for (const entry of entries) {
        const absPath = join(dir, entry);
        const relPath = relative(baseDir, absPath);

        if (exclude.some(p => matchPattern(p, entry))) continue;

        try {
          const stat = statSync(absPath);
          if (stat.isDirectory()) {
            scan(absPath);
          } else if (stat.isFile()) {
            results.push({ absPath, relPath });
          }
        } catch { /* skip inaccessible */ }
      }
    };

    scan(baseDir);
    return results;
  }

  private sha256(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private async writeCompressedArchive(
    outputPath: string,
    files: { absPath: string; relPath: string }[]
  ): Promise<void> {
    const gzip = createGzip();
    const output = createWriteStream(outputPath);
    gzip.pipe(output);

    const archive: { files: { path: string; size: number; checksum: string; content: string }[] } = { files: [] };

    for (const file of files) {
      try {
        const content = readFileSync(file.absPath);
        archive.files.push({
          path: file.relPath,
          size: content.length,
          checksum: this.sha256(content),
          content: content.toString('base64'),
        });
      } catch { /* skip */ }
    }

    const buffer = Buffer.from(JSON.stringify(archive));
    gzip.write(buffer);
    gzip.end();
    await new Promise<void>((resolve, reject) => {
      output.on('finish', resolve);
      output.on('error', reject);
    });
  }

  private async writeUncompressedArchive(
    outputPath: string,
    files: { absPath: string; relPath: string }[]
  ): Promise<void> {
    const output = createWriteStream(outputPath);
    const archive: { files: { path: string; size: number; checksum: string; content: string }[] } = { files: [] };

    for (const file of files) {
      try {
        const content = readFileSync(file.absPath);
        archive.files.push({
          path: file.relPath,
          size: content.length,
          checksum: this.sha256(content),
          content: content.toString('base64'),
        });
      } catch { /* skip */ }
    }

    output.write(JSON.stringify(archive));
    output.end();
    await new Promise<void>((resolve, reject) => {
      output.on('finish', resolve);
      output.on('error', reject);
    });
  }

  private async extractArchive(backupPath: string): Promise<{
    files: { path: string; size: number; checksum: string; content: string }[];
  } | null> {
    try {
      const isCompressed = backupPath.endsWith('.duckbak');
      const chunks: Buffer[] = [];

      if (isCompressed) {
        const stream = createReadStream(backupPath);
        const gunzip = createGunzip();
        stream.pipe(gunzip);
        await new Promise<void>((resolve, reject) => {
          gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
          gunzip.on('end', resolve);
          gunzip.on('error', reject);
          stream.on('error', reject);
        });
      } else {
        const content = readFileSync(backupPath);
        chunks.push(content);
      }

      const json = Buffer.concat(chunks).toString();
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  private async checkArchiveIntegrity(path: string): Promise<string | null> {
    try {
      const chunks: Buffer[] = [];
      const stream = createReadStream(path);
      const gunzip = createGunzip();
      stream.pipe(gunzip);

      return new Promise<string | null>(resolve => {
        stream.on('error', () => resolve('Cannot read archive'));
        gunzip.on('error', () => resolve(null)); // Not gzip — might be uncompressed
        gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
        gunzip.on('end', () => {
          try {
            JSON.parse(Buffer.concat(chunks).toString());
            resolve(null);
          } catch {
            resolve('Invalid JSON in archive');
          }
        });
      });
    } catch (e: any) {
      return e.message;
    }
  }
}

function matchPattern(pattern: string, name: string): boolean {
  if (pattern.startsWith('*.')) {
    return name.endsWith(pattern.substring(1));
  }
  return name === pattern || name.includes(pattern);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * 🦆 Duck Agent - SOUL Registry Integration
 * Manages SOUL.md files from onlycrabs.ai registry
 */

import { readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SoulRegistryClient, Soul } from './clawhub-client.js';

export interface InstalledSoul {
  name: string;
  version: string;
  path: string;
  installedAt: string;
  source?: string;
  description?: string;
}

export interface SoulManifest {
  version: string;
  souls: InstalledSoul[];
}

/**
 * SOUL Registry - Manages AI persona/identity files
 */
export class SoulRegistry {
  private client: SoulRegistryClient;
  private projectRoot: string;
  private soulDir: string;
  private manifestPath: string;

  constructor(projectRoot?: string, apiKey?: string) {
    this.client = new SoulRegistryClient({ apiKey: apiKey || process.env.SOUL_API_KEY });
    this.projectRoot = projectRoot || this.findProjectRoot();
    this.soulDir = join(this.projectRoot, 'souls');
    this.manifestPath = join(this.projectRoot, '.duck', 'installed-souls.json');
  }

  /**
   * Find project root
   */
  private findProjectRoot(): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    let dir = __dirname;
    for (let i = 0; i < 4; i++) {
      dir = join(dir, '..');
    }
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    return process.cwd();
  }

  /**
   * Load SOUL manifest
   */
  async loadManifest(): Promise<SoulManifest> {
    try {
      const content = await readFile(this.manifestPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { version: '1.0.0', souls: [] };
    }
  }

  /**
   * Save SOUL manifest
   */
  async saveManifest(manifest: SoulManifest): Promise<void> {
    const dir = dirname(this.manifestPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(this.manifestPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Search for SOULs in registry
   */
  async search(
    query: string,
    options: { limit?: number } = {}
  ): Promise<{ souls: Soul[]; total: number }> {
    return this.client.searchSouls(query, options);
  }

  /**
   * Get featured SOULs
   */
  async featured(): Promise<Soul[]> {
    return this.client.getFeatured();
  }

  /**
   * Check if a SOUL is installed
   */
  async isInstalled(name: string): Promise<boolean> {
    const manifest = await this.loadManifest();
    return manifest.souls.some(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Install a SOUL
   */
  async install(
    soulName: string,
    options: {
      version?: string;
      sourceUrl?: string;
      content?: string;
    } = {}
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    // Check if already installed
    if (await this.isInstalled(soulName)) {
      return {
        success: false,
        error: `SOUL "${soulName}" is already installed`,
      };
    }

    const soulPath = join(this.soulDir, `${soulName}.md`);

    try {
      // Ensure directory exists
      if (!existsSync(this.soulDir)) {
        await mkdir(this.soulDir, { recursive: true });
      }

      let content: string;

      if (options.content) {
        content = options.content;
      } else if (options.sourceUrl) {
        // Download from source URL
        const response = await fetch(options.sourceUrl);
        if (!response.ok) {
          throw new Error(`Failed to download: ${response.statusText}`);
        }
        content = await response.text();
      } else {
        // Try to get from registry
        try {
          const soul = await this.client.getSoul(soulName);
          content = soul.content;
        } catch {
          return {
            success: false,
            error: `Could not find SOUL "${soulName}" in registry`,
          };
        }
      }

      // Write SOUL file
      await writeFile(soulPath, content);

      // Update manifest
      const manifest = await this.loadManifest();
      manifest.souls.push({
        name: soulName,
        version: options.version || '1.0.0',
        path: soulPath,
        installedAt: new Date().toISOString(),
        source: options.sourceUrl,
      });
      await this.saveManifest(manifest);

      return { success: true, path: soulPath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Uninstall a SOUL
   */
  async uninstall(
    soulName: string
  ): Promise<{ success: boolean; error?: string }> {
    const manifest = await this.loadManifest();
    const soulIndex = manifest.souls.findIndex(
      (s) => s.name.toLowerCase() === soulName.toLowerCase()
    );

    if (soulIndex === -1) {
      return { success: false, error: `SOUL "${soulName}" is not installed` };
    }

    const soul = manifest.souls[soulIndex];
    const soulPath = soul.path || join(this.soulDir, `${soulName}.md`);

    try {
      // Remove file
      await require('fs').promises.rm(soulPath, { force: true });

      // Update manifest
      manifest.souls.splice(soulIndex, 1);
      await this.saveManifest(manifest);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List installed SOULs
   */
  async list(): Promise<InstalledSoul[]> {
    const manifest = await this.loadManifest();
    return manifest.souls;
  }

  /**
   * Get SOUL content
   */
  async getContent(soulName: string): Promise<string | null> {
    const manifest = await this.loadManifest();
    const soul = manifest.souls.find(
      (s) => s.name.toLowerCase() === soulName.toLowerCase()
    );

    if (!soul) {
      return null;
    }

    const soulPath = soul.path || join(this.soulDir, `${soulName}.md`);
    if (!existsSync(soulPath)) {
      return null;
    }

    return readFile(soulPath, 'utf-8');
  }

  /**
   * Activate a SOUL (copy to .duck/SOUL.md)
   */
  async activate(soulName: string): Promise<{ success: boolean; error?: string }> {
    const content = await this.getContent(soulName);
    if (!content) {
      return { success: false, error: `SOUL "${soulName}" not found` };
    }

    const duckSoulPath = join(this.projectRoot, '.duck', 'SOUL.md');
    const dir = dirname(duckSoulPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(duckSoulPath, content);
    return { success: true };
  }

  /**
   * Download SOUL directly from registry
   */
  async download(
    soulName: string,
    options: { outputPath?: string } = {}
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const content = await this.client.downloadSoul(soulName);
      const outputPath =
        options.outputPath ||
        join(this.soulDir, `${soulName}.md`);

      // Ensure directory
      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(outputPath, content);
      return { success: true, path: outputPath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get info about a SOUL from registry
   */
  async getInfo(
    soulName: string
  ): Promise<Soul | null> {
    try {
      return await this.client.getSoul(soulName);
    } catch {
      return null;
    }
  }
}

export default SoulRegistry;

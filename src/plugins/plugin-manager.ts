/**
 * 🦆 Duck CLI - Plugin Manager
 * Handles plugin discovery, installation, uninstallation, and inspection
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';

// Colors (same as main.ts)
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gold: '\x1b[33m',
  magenta: '\x1b[35m',
};

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  main?: string;
  dependencies?: Record<string, string>;
  triggers?: string[];
  skills?: string[];
}

export interface InstalledPlugin {
  name: string;
  version: string;
  description: string;
  author?: string;
  installedAt: number;
  path: string;
  metadata: PluginMetadata;
  enabled: boolean;
}

export interface PluginInstallResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface PluginListResult {
  plugins: InstalledPlugin[];
  total: number;
}

/**
 * Plugin registry stored in ~/.duck/plugins/manifest.json
 */
interface PluginManifest {
  version: string;
  plugins: Record<string, {
    version: string;
    description: string;
    author?: string;
    installedAt: number;
    path: string;
    enabled: boolean;
  }>;
}

export class PluginManager {
  private pluginsDir: string;
  private manifestPath: string;
  private manifest: PluginManifest;

  constructor(pluginsDir?: string) {
    const baseDir = pluginsDir || join(homedir(), '.duck', 'plugins');
    this.pluginsDir = baseDir;
    this.manifestPath = join(baseDir, 'manifest.json');
    this.manifest = this.loadManifest();
  }

  /**
   * Load or initialize the plugin manifest
   */
  private loadManifest(): PluginManifest {
    if (existsSync(this.manifestPath)) {
      try {
        const raw = readFileSync(this.manifestPath, 'utf-8');
        return JSON.parse(raw) as PluginManifest;
      } catch (e) {
        console.warn(`${c.yellow}Warning: Failed to parse plugin manifest, creating new one${c.reset}`);
      }
    }
    return { version: '1.0.0', plugins: {} };
  }

  /**
   * Save the plugin manifest
   */
  private saveManifest(): void {
    if (!existsSync(this.pluginsDir)) {
      mkdirSync(this.pluginsDir, { recursive: true });
    }
    writeFileSync(this.manifestPath, JSON.stringify(this.manifest, null, 2), { mode: 0o600 });
  }

  /**
   * Discover plugin metadata from a plugin directory
   */
  private discoverMetadata(pluginPath: string): PluginMetadata | null {
    // Check for SKILL.md first (OpenClaw skill format)
    const skillPath = join(pluginPath, 'SKILL.md');
    if (existsSync(skillPath)) {
      try {
        const content = readFileSync(skillPath, 'utf-8');
        const metadata = this.parseSkillMetadata(content);
        if (metadata) return metadata;
      } catch { /* ignore */ }
    }

    // Check for package.json
    const pkgPath = join(pluginPath, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        return {
          name: pkg.name || basename(pluginPath),
          version: pkg.version || '1.0.0',
          description: pkg.description || '',
          author: pkg.author,
          main: pkg.main,
          dependencies: pkg.dependencies,
        };
      } catch { /* ignore */ }
    }

    // Fallback: use directory name
    const name = basename(pluginPath);
    return {
      name,
      version: '1.0.0',
      description: 'Plugin description not available',
    };
  }

  /**
   * Parse YAML-style metadata from SKILL.md
   */
  private parseSkillMetadata(content: string): PluginMetadata | null {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) return null;

    const lines = frontMatterMatch[1].split('\n');
    const metadata: Record<string, string> = {};

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (key && value) {
        metadata[key] = value;
      }
    }

    if (!metadata.name) return null;

    return {
      name: metadata.name,
      version: metadata.version || '1.0.0',
      description: metadata.description || '',
      author: metadata.author,
      triggers: metadata.triggers ? metadata.triggers.split(',').map((t: string) => t.trim()) : undefined,
      skills: metadata.skills ? metadata.skills.split(',').map((s: string) => s.trim()) : undefined,
    };
  }

  /**
   * List all installed plugins
   */
  async list(): Promise<PluginListResult> {
    const plugins: InstalledPlugin[] = [];

    for (const [name, info] of Object.entries(this.manifest.plugins)) {
      const pluginPath = info.path;
      const metadata = this.discoverMetadata(pluginPath);

      if (metadata) {
        plugins.push({
          name,
          version: info.version,
          description: info.description || metadata.description,
          author: info.author || metadata.author,
          installedAt: info.installedAt,
          path: pluginPath,
          metadata,
          enabled: info.enabled,
        });
      } else {
        // Plugin path no longer exists, still show entry
        plugins.push({
          name,
          version: info.version,
          description: info.description || 'Plugin description not available',
          author: info.author,
          installedAt: info.installedAt,
          path: pluginPath,
          metadata: { name, version: info.version, description: info.description },
          enabled: info.enabled,
        });
      }
    }

    return { plugins, total: plugins.length };
  }

  /**
   * Inspect a specific plugin - returns detailed info
   */
  async inspect(name: string): Promise<InstalledPlugin | null> {
    const info = this.manifest.plugins[name];
    if (!info) return null;

    const pluginPath = info.path;
    const metadata = this.discoverMetadata(pluginPath);

    if (metadata) {
      return {
        name,
        version: info.version,
        description: info.description || metadata.description,
        author: info.author || metadata.author,
        installedAt: info.installedAt,
        path: pluginPath,
        metadata,
        enabled: info.enabled,
      };
    }

    return {
      name,
      version: info.version,
      description: info.description,
      author: info.author,
      installedAt: info.installedAt,
      path: pluginPath,
      metadata: { name, version: info.version, description: info.description },
      enabled: info.enabled,
    };
  }

  /**
   * Install a plugin from a local path or URL
   */
  async install(source: string, options?: { name?: string }): Promise<PluginInstallResult> {
    // Determine if source is a path or URL
    let sourcePath: string;
    let sourceIsUrl = false;

    if (source.startsWith('http://') || source.startsWith('https://')) {
      sourceIsUrl = true;
      sourcePath = source; // Will download later
    } else if (existsSync(source)) {
      sourcePath = source;
    } else {
      return { success: false, error: `Source not found: ${source}` };
    }

    // Determine plugin name
    let pluginName = options?.name;
    if (!pluginName) {
      if (sourceIsUrl) {
        // Extract name from URL
        const urlParts = source.split('/');
        pluginName = urlParts[urlParts.length - 1]?.replace(/\.(tar\.gz|zip)$/, '') || 'plugin';
      } else {
        pluginName = basename(sourcePath);
      }
    }

    // Check if already installed
    if (this.manifest.plugins[pluginName]) {
      return { success: false, error: `Plugin "${pluginName}" is already installed` };
    }

    // Create plugins directory
    if (!existsSync(this.pluginsDir)) {
      mkdirSync(this.pluginsDir, { recursive: true });
    }

    const destPath = join(this.pluginsDir, pluginName);

    try {
      if (sourceIsUrl) {
        // Download from URL
        console.log(`${c.cyan}📥 Downloading plugin from ${source}...${c.reset}`);
        const destDir = join(this.pluginsDir, '.download');
        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }

        // Use curl to download
        const { execSync } = require('child_process');
        const archiveName = source.split('/').pop() || 'download';
        const archivePath = join(destDir, archiveName);

        try {
          execSync(`curl -L -o "${archivePath}" "${source}"`, { stdio: 'pipe' });
        } catch (e: any) {
          return { success: false, error: `Failed to download: ${e.message}` };
        }

        // Extract archive
        if (archiveName.endsWith('.tar.gz') || archiveName.endsWith('.tgz')) {
          execSync(`tar -xzf "${archivePath}" -C "${this.pluginsDir}"`, { stdio: 'pipe' });
          // Find extracted directory
          const extracted = execSync(`ls "${this.pluginsDir}" | grep -v "^\\." | tail -1`, { encoding: 'utf-8' }).trim();
          const extractedPath = join(this.pluginsDir, extracted);

          // Rename to plugin name
          if (extractedPath !== destPath) {
            // Move contents to destPath
            execSync(`mv "${extractedPath}" "${destPath}"`, { stdio: 'pipe' });
          }
        } else if (archiveName.endsWith('.zip')) {
          execSync(`unzip -o "${archivePath}" -d "${this.pluginsDir}"`, { stdio: 'pipe' });
          const extracted = execSync(`ls "${this.pluginsDir}" | grep -v "^\\." | tail -1`, { encoding: 'utf-8' }).trim();
          const extractedPath = join(this.pluginsDir, extracted);
          if (existsSync(extractedPath) && extractedPath !== destPath) {
            execSync(`mv "${extractedPath}" "${destPath}"`, { stdio: 'pipe' });
          }
        } else {
          return { success: false, error: `Unsupported archive format. Use .tar.gz, .tgz, or .zip` };
        }

        // Cleanup
        try { rmSync(destDir, { recursive: true, force: true }); } catch { /* ignore */ }
      } else {
        // Copy from local path
        if (existsSync(destPath)) {
          return { success: false, error: `Destination path already exists: ${destPath}` };
        }

        const { execSync } = require('child_process');
        execSync(`cp -r "${sourcePath}" "${destPath}"`, { stdio: 'pipe' });
      }

      // Get plugin metadata
      const metadata = this.discoverMetadata(destPath);
      if (!metadata) {
        // Remove partial install
        try { rmSync(destPath, { recursive: true, force: true }); } catch { /* ignore */ }
        return { success: false, error: 'Could not parse plugin metadata from source' };
      }

      // Register in manifest
      this.manifest.plugins[pluginName] = {
        version: metadata.version,
        description: metadata.description,
        author: metadata.author,
        installedAt: Date.now(),
        path: destPath,
        enabled: true,
      };
      this.saveManifest();

      return { success: true, path: destPath };
    } catch (e: any) {
      // Cleanup on error
      try { rmSync(destPath, { recursive: true, force: true }); } catch { /* ignore */ }
      return { success: false, error: e.message };
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(name: string): Promise<{ success: boolean; error?: string }> {
    const info = this.manifest.plugins[name];
    if (!info) {
      return { success: false, error: `Plugin "${name}" is not installed` };
    }

    // Remove plugin files
    try {
      if (existsSync(info.path)) {
        rmSync(info.path, { recursive: true, force: true });
      }
    } catch (e: any) {
      return { success: false, error: `Failed to remove plugin files: ${e.message}` };
    }

    // Remove from manifest
    delete this.manifest.plugins[name];
    this.saveManifest();

    return { success: true };
  }

  /**
   * Enable a plugin
   */
  async enable(name: string): Promise<{ success: boolean; error?: string }> {
    const info = this.manifest.plugins[name];
    if (!info) {
      return { success: false, error: `Plugin "${name}" is not installed` };
    }

    info.enabled = true;
    this.saveManifest();
    return { success: true };
  }

  /**
   * Disable a plugin
   */
  async disable(name: string): Promise<{ success: boolean; error?: string }> {
    const info = this.manifest.plugins[name];
    if (!info) {
      return { success: false, error: `Plugin "${name}" is not installed` };
    }

    info.enabled = false;
    this.saveManifest();
    return { success: true };
  }

  /**
   * Check if a plugin is installed
   */
  isInstalled(name: string): boolean {
    return name in this.manifest.plugins;
  }

  /**
   * Check if a plugin is enabled
   */
  isEnabled(name: string): boolean {
    const info = this.manifest.plugins[name];
    return info?.enabled ?? false;
  }

  /**
   * Get plugin paths for loader
   */
  getEnabledPluginPaths(): string[] {
    return Object.values(this.manifest.plugins)
      .filter(info => info.enabled)
      .map(info => info.path);
  }
}

/**
 * 🦆 Duck Agent - Skill Installer
 * Install, uninstall, and manage skills from ClawHub
 */

import { readFile, writeFile, mkdir, readdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

export interface InstalledSkill {
  name: string;
  version: string;
  path: string;
  installedAt: string;
  source?: string;
  dependencies?: string[];
  readme?: string;
}

export interface SkillManifest {
  version: string;
  skills: InstalledSkill[];
}

/**
 * Skill Installer for Duck Agent
 * Installs skills to src/skills/ directory
 */
export class SkillInstaller {
  private projectRoot: string;
  private skillsDir: string;
  private manifestPath: string;

  constructor(projectRoot?: string) {
    // Default to project root from current file location
    this.projectRoot = projectRoot || this.findProjectRoot();
    // Skills live at: <projectRoot>/skills (source) or <distDir>/skills (installed)
    const distDir = join(dirname(process.argv[1] || process.execPath), '..');
    const installedSkills = join(distDir, 'skills');
    if (existsSync(installedSkills)) {
      this.skillsDir = installedSkills;
      this.projectRoot = distDir;
    } else {
      this.skillsDir = join(this.projectRoot, 'skills');
    }
    this.manifestPath = join(this.projectRoot, '.duck', 'installed-skills.json');
  }

  /**
   * Find project root
   */
  private findProjectRoot(): string {
    // Use current working directory as project root
    return process.cwd();
  }

  /**
   * Load installed skills manifest
   */
  async loadManifest(): Promise<SkillManifest> {
    try {
      const content = await readFile(this.manifestPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Return empty manifest if doesn't exist
      return {
        version: '1.0.0',
        skills: [],
      };
    }
  }

  /**
   * Save installed skills manifest
   */
  async saveManifest(manifest: SkillManifest): Promise<void> {
    const dir = dirname(this.manifestPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(this.manifestPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Check if a skill is already installed
   */
  async isInstalled(name: string): Promise<boolean> {
    const manifest = await this.loadManifest();
    return manifest.skills.some(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Install a skill from ClawHub
   */
  async install(
    skillName: string,
    options: {
      version?: string;
      sourceUrl?: string;
      content?: string;
      dependencies?: string[];
    } = {}
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    // Check if already installed
    if (await this.isInstalled(skillName)) {
      return {
        success: false,
        error: `Skill "${skillName}" is already installed`,
      };
    }

    // Create skill directory
    const skillPath = join(this.skillsDir, skillName);
    if (existsSync(skillPath)) {
      return {
        success: false,
        error: `Directory already exists: ${skillPath}`,
      };
    }

    try {
      await mkdir(skillPath, { recursive: true });

      // If content provided, write SKILL.md directly
      if (options.content) {
        await writeFile(
          join(skillPath, 'SKILL.md'),
          options.content
        );
      } else if (options.sourceUrl) {
        // Download from source URL
        const response = await fetch(options.sourceUrl);
        if (!response.ok) {
          throw new Error(`Failed to download: ${response.statusText}`);
        }
        const content = await response.text();
        
        // Handle both single file and tarball
        if (options.sourceUrl.endsWith('.tar.gz') || options.sourceUrl.endsWith('.tgz')) {
          await this.extractTarball(content, skillPath);
        } else {
          // Single file - assume it's SKILL.md
          await writeFile(join(skillPath, 'SKILL.md'), content);
        }
      }

      // Install dependencies if provided
      if (options.dependencies?.length) {
        for (const dep of options.dependencies) {
          const depResult = await this.install(dep);
          if (!depResult.success) {
            console.warn(`   ⚠ Warning: Failed to install dependency: ${dep}`);
          }
        }
      }

      // Update manifest
      const manifest = await this.loadManifest();
      manifest.skills.push({
        name: skillName,
        version: options.version || '1.0.0',
        path: skillPath,
        installedAt: new Date().toISOString(),
        source: options.sourceUrl,
        dependencies: options.dependencies,
      });
      await this.saveManifest(manifest);

      return {
        success: true,
        path: skillPath,
      };
    } catch (error: any) {
      // Clean up on failure
      try {
        await rm(skillPath, { recursive: true, force: true });
      } catch {}

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Uninstall a skill
   */
  async uninstall(
    skillName: string,
    options: { force?: boolean } = {}
  ): Promise<{ success: boolean; error?: string }> {
    const manifest = await this.loadManifest();
    const skillIndex = manifest.skills.findIndex(
      (s) => s.name.toLowerCase() === skillName.toLowerCase()
    );

    if (skillIndex === -1) {
      return {
        success: false,
        error: `Skill "${skillName}" is not installed`,
      };
    }

    const skill = manifest.skills[skillIndex];
    const skillPath = skill.path || join(this.skillsDir, skillName);

    // Check for dependents (other installed skills that depend on this one)
    if (!options.force) {
      const dependents = manifest.skills.filter(
        (s) => s.dependencies?.includes(skillName)
      );
      if (dependents.length > 0) {
        return {
          success: false,
          error: `Skill "${skillName}" is a dependency of: ${dependents.map((d) => d.name).join(', ')}. Use --force to uninstall anyway.`,
        };
      }
    }

    try {
      // Remove skill directory
      await rm(skillPath, { recursive: true, force: true });

      // Update manifest
      manifest.skills.splice(skillIndex, 1);
      await this.saveManifest(manifest);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * List all installed skills
   */
  async list(): Promise<InstalledSkill[]> {
    const manifest = await this.loadManifest();
    return manifest.skills;
  }

  /**
   * Update a skill to latest version
   */
  async update(
    skillName: string,
    options: { version?: string } = {}
  ): Promise<{ success: boolean; error?: string }> {
    const manifest = await this.loadManifest();
    const skill = manifest.skills.find(
      (s) => s.name.toLowerCase() === skillName.toLowerCase()
    );

    if (!skill) {
      return {
        success: false,
        error: `Skill "${skillName}" is not installed`,
      };
    }

    // Uninstall then reinstall with new version
    const uninstallResult = await this.uninstall(skillName, { force: true });
    if (!uninstallResult.success) {
      return uninstallResult;
    }

    const installResult = await this.install(skillName, {
      version: options.version || skill.version,
      sourceUrl: skill.source,
    });

    if (!installResult.success) {
      // Try to restore original
      await this.install(skillName, {
        version: skill.version,
        sourceUrl: skill.source,
      });
      return {
        success: false,
        error: `Update failed: ${installResult.error}`,
      };
    }

    return { success: true };
  }

  /**
   * Get skill info from installed manifest
   */
  async getInfo(skillName: string): Promise<InstalledSkill | null> {
    const manifest = await this.loadManifest();
    return (
      manifest.skills.find(
        (s) => s.name.toLowerCase() === skillName.toLowerCase()
      ) || null
    );
  }

  /**
   * Check for updates for installed skills
   */
  async checkUpdates(): Promise<
    { name: string; currentVersion: string; latestVersion: string }[]
  > {
    // TODO: Implement when ClawHub has version check API
    // For now, return empty array
    return [];
  }

  /**
   * Extract tarball (basic support)
   * In production, would use a proper tar library
   */
  private async extractTarball(
    _content: string,
    _destPath: string
  ): Promise<void> {
    // Basic implementation - in reality would use tar or similar
    // For now, this is a placeholder that would need proper implementation
    throw new Error(
      'Tarball extraction not implemented. Please provide direct SKILL.md content.'
    );
  }

  /**
   * Verify skill installation (check for SKILL.md)
   */
  async verify(skillName: string): Promise<boolean> {
    const skillPath = join(this.skillsDir, skillName, 'SKILL.md');
    return existsSync(skillPath);
  }

  /**
   * Get skill readme content
   */
  async getReadme(skillName: string): Promise<string | null> {
    const skillPath = join(this.skillsDir, skillName, 'SKILL.md');
    if (!existsSync(skillPath)) {
      return null;
    }
    return readFile(skillPath, 'utf-8');
  }
}

/**
 * Track skill dependencies
 */
export class DependencyTracker {
  private manifestPath: string;

  constructor(projectRoot?: string) {
    const root = projectRoot || process.cwd();
    this.manifestPath = join(root, '.duck', 'skill-dependencies.json');
  }

  async load(): Promise<Map<string, string[]>> {
    try {
      const content = await readFile(this.manifestPath, 'utf-8');
      const data = JSON.parse(content);
      return new Map(Object.entries(data));
    } catch {
      return new Map();
    }
  }

  async save(deps: Map<string, string[]>): Promise<void> {
    const dir = dirname(this.manifestPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const data = Object.fromEntries(deps);
    await writeFile(this.manifestPath, JSON.stringify(data, null, 2));
  }

  async add(skill: string, dependencies: string[]): Promise<void> {
    const deps = await this.load();
    deps.set(skill, dependencies);
    await this.save(deps);
  }

  async remove(skill: string): Promise<void> {
    const deps = await this.load();
    deps.delete(skill);
    await this.save(deps);
  }

  async getDependencies(skill: string): Promise<string[]> {
    const deps = await this.load();
    return deps.get(skill) || [];
  }

  async getDependents(skill: string): Promise<string[]> {
    const deps = await this.load();
    const dependents: string[] = [];
    deps.forEach((value, name) => {
      if (value.includes(skill)) {
        dependents.push(name);
      }
    });
    return dependents;
  }
}

export default SkillInstaller;

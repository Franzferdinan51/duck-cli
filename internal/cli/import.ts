/**
 * Duck CLI - Import OpenClaw/Hermes Setups
 * 
 * Import configurations, skills, memories, and soul from OpenClaw or Hermes
 */

import { readdir, readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';

export interface ImportOptions {
  source: string;
  target?: string;
  includeMemories?: boolean;
  includeSoul?: boolean;
  includeSkills?: boolean;
  includeConfig?: boolean;
  dryRun?: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: string[];
  skipped: string[];
  errors: string[];
}

const MEMORY_FILES = ['MEMORY.md', 'memory.md', 'memory.txt', 'USER.md', 'user.md'];
const SOUL_FILES = ['SOUL.md', 'SOUL.txt', 'soul.md', 'soul.txt'];
const SKILL_PATTERNS = ['skills/', 'Skills/', 'skills'];

export async function importOpenClawSetup(options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: [],
    skipped: [],
    errors: []
  };

  const sourceDir = options.source;
  const targetDir = options.target || process.cwd();
  const duckDir = join(targetDir, '.duck');

  if (!existsSync(sourceDir)) {
    result.success = false;
    result.errors.push(`Source directory not found: ${sourceDir}`);
    return result;
  }

  // Ensure .duck directory exists
  await mkdir(join(duckDir, 'memory'), { recursive: true });
  await mkdir(join(duckDir, 'skills'), { recursive: true });

  // Import memories
  if (options.includeMemories !== false) {
    for (const file of MEMORY_FILES) {
      const sourcePath = join(sourceDir, file);
      if (!existsSync(sourcePath)) continue;

      const targetFile = file.toLowerCase();
      const targetPath = join(duckDir, 'memory', targetFile === 'memory.md' || targetFile === 'memory.txt' ? 'memory.md' : targetFile);

      try {
        if (options.dryRun) {
          result.skipped.push(`Would import: ${file} → ${targetPath}`);
        } else {
          await copyFile(sourcePath, targetPath);
          result.imported.push(`${file} → memory/`);
        }
      } catch (e: any) {
        result.errors.push(`Failed to import ${file}: ${e.message}`);
      }
    }
  }

  // Import soul
  if (options.includeSoul !== false) {
    for (const file of SOUL_FILES) {
      const sourcePath = join(sourceDir, file);
      if (!existsSync(sourcePath)) continue;

      const targetPath = join(duckDir, 'soul.md');

      try {
        if (options.dryRun) {
          result.skipped.push(`Would import soul: ${file} → soul.md`);
        } else {
          await copyFile(sourcePath, targetPath);
          result.imported.push(`SOUL → soul.md`);
        }
        break; // Only import first matching soul file
      } catch (e: any) {
        result.errors.push(`Failed to import soul: ${e.message}`);
      }
    }
  }

  // Import skills
  if (options.includeSkills !== false) {
    const skillsSource = join(sourceDir, 'skills');
    const skillsTarget = join(duckDir, 'skills');

    if (existsSync(skillsSource)) {
      try {
        const skillDirs = await readdir(skillsSource);
        
        for (const dir of skillDirs) {
          const sourceSkill = join(skillsSource, dir);
          const targetSkill = join(skillsTarget, dir);
          
          if ((await Bun.file(sourceSkill).stat()).isDirectory()) {
            await mkdir(targetSkill, { recursive: true });
            
            // Copy SKILL.md and other files
            const files = await readdir(sourceSkill);
            for (const file of files) {
              if (options.dryRun) {
                result.skipped.push(`Would import skill: ${dir}/${file}`);
              } else {
                await copyFile(join(sourceSkill, file), join(targetSkill, file));
                result.imported.push(`skill:${dir}/${file}`);
              }
            }
          }
        }
      } catch (e: any) {
        result.errors.push(`Failed to import skills: ${e.message}`);
      }
    }

    // Also check workspace/skills
    const workspaceSkills = join(sourceDir, 'workspace', 'skills');
    if (existsSync(workspaceSkills)) {
      const skillDirs = await readdir(workspaceSkills);
      for (const dir of skillDirs) {
        const sourceSkill = join(workspaceSkills, dir);
        const targetSkill = join(skillsTarget, dir);
        
        if ((await Bun.file(sourceSkill).stat()).isDirectory()) {
          await mkdir(targetSkill, { recursive: true });
          
          const files = await readdir(sourceSkill);
          for (const file of files) {
            if (options.dryRun) {
              result.skipped.push(`Would import skill: ${dir}/${file}`);
            } else {
              await copyFile(join(sourceSkill, file), join(targetSkill, file));
              result.imported.push(`skill:${dir}/${file}`);
            }
          }
        }
      }
    }
  }

  // Import config
  if (options.includeConfig !== false) {
    const configFiles = ['openclaw.json', '.openclaw.json', 'config.json'];
    
    for (const file of configFiles) {
      const sourcePath = join(sourceDir, file);
      if (!existsSync(sourcePath)) continue;

      const targetPath = join(duckDir, 'config.json');

      try {
        if (options.dryRun) {
          result.skipped.push(`Would import config: ${file} → config.json`);
        } else {
          const content = await readFile(sourcePath, 'utf-8');
          const config = JSON.parse(content);
          // Merge or replace config
          await writeFile(targetPath, JSON.stringify(config, null, 2), 'utf-8');
          result.imported.push(`config → config.json`);
        }
        break;
      } catch (e: any) {
        result.errors.push(`Failed to import config: ${e.message}`);
      }
    }
  }

  // Try to detect source type
  if (existsSync(join(sourceDir, 'SOUL.md')) || existsSync(join(sourceDir, 'soul.md'))) {
    console.log('Detected OpenClaw setup');
  } else if (existsSync(join(sourceDir, 'agents.py'))) {
    console.log('Detected Hermes-agent setup');
  }

  result.success = result.errors.length === 0;
  return result;
}

// CLI helper
export async function runImport(args: string[]): Promise<void> {
  const options: ImportOptions = {
    source: '',
    target: process.cwd(),
    dryRun: false,
    includeMemories: true,
    includeSoul: true,
    includeSkills: true,
    includeConfig: true
  };

  // Parse args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--source' || arg === '-s') {
      options.source = args[++i];
    } else if (arg === '--target' || arg === '-t') {
      options.target = args[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--no-memories') {
      options.includeMemories = false;
    } else if (arg === '--no-soul') {
      options.includeSoul = false;
    } else if (arg === '--no-skills') {
      options.includeSkills = false;
    } else if (arg === '--no-config') {
      options.includeConfig = false;
    } else if (!arg.startsWith('-')) {
      options.source = arg;
    }
  }

  if (!options.source) {
    console.log('Usage: duck import <source-dir> [options]');
    console.log('Options:');
    console.log('  --source, -s <dir>     Source directory');
    console.log('  --target, -t <dir>     Target directory (default: cwd)');
    console.log('  --dry-run              Show what would be imported');
    console.log('  --no-memories          Skip memories');
    console.log('  --no-soul              Skip soul');
    console.log('  --no-skills            Skip skills');
    console.log('  --no-config            Skip config');
    return;
  }

  console.log(`Importing from: ${options.source}`);
  console.log(`Target: ${options.target}`);
  if (options.dryRun) console.log('Mode: DRY RUN\n');

  const result = await importOpenClawSetup(options);

  if (result.imported.length > 0) {
    console.log('\n✅ Imported:');
    for (const item of result.imported) {
      console.log(`  + ${item}`);
    }
  }

  if (result.skipped.length > 0) {
    console.log('\n⏭️  Skipped:');
    for (const item of result.skipped) {
      console.log(`  - ${item}`);
    }
  }

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const err of result.errors) {
      console.log(`  ! ${err}`);
    }
  }

  console.log(`\nTotal: ${result.imported.length} imported, ${result.skipped.length} skipped, ${result.errors.length} errors`);
}

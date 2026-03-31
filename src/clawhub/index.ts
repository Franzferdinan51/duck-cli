/**
 * 🦆 Duck Agent - ClawHub Integration
 * Skill marketplace and SOUL registry for Duck Agent
 *
 * @example
 * ```typescript
 * import { ClawHubClient, SkillInstaller, SoulRegistry } from './clawhub';
 *
 * // Search for skills
 * const client = new ClawHubClient();
 * const results = await client.searchSkills('web scraping');
 *
 * // Install a skill
 * const installer = new SkillInstaller();
 * await installer.install('web-scraping');
 *
 * // Search SOULs
 * const souls = new SoulRegistry();
 * await souls.search('helpful assistant');
 * ```
 */

// ClawHub Client - API interaction
export {
  ClawHubClient,
  SoulRegistryClient,
  type ClawHubSkill,
  type ClawHubSearchResult,
  type ClawHubConfig,
  type Soul,
} from './clawhub-client.js';

// Skill Installer - Install/manage skills
export {
  SkillInstaller,
  DependencyTracker,
  type InstalledSkill,
  type SkillManifest,
} from './skill-installer.js';

// SOUL Registry - SOUL.md management
export {
  SoulRegistry,
  type InstalledSoul,
  type SoulManifest,
} from './soul-registry.js';

// Version info
export const CLAWHUB_VERSION = '1.0.0';
export const CLAWHUB_API_BASE = 'https://clawhub.ai/api';
export const SOUL_REGISTRY_BASE = 'https://onlycrabs.ai/api';

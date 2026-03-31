/**
 * 🦆 Duck Agent - ClawHub API Client
 * Client for interacting with ClawHub skill marketplace (clawhub.ai)
 */

import { z } from 'zod';

// ClawHub API types
export interface ClawHubSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
  downloads: number;
  rating: number;
  sourceUrl?: string;
  readme?: string;
  dependencies?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ClawHubSearchResult {
  skills: ClawHubSkill[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClawHubConfig {
  apiKey?: string;
  baseUrl?: string;
}

// API Response schemas
const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  author: z.string(),
  version: z.string(),
  tags: z.array(z.string()).optional().default([]),
  downloads: z.number().optional().default(0),
  rating: z.number().optional().default(0),
  sourceUrl: z.string().optional(),
  readme: z.string().optional(),
  dependencies: z.array(z.string()).optional().default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const SearchResultSchema = z.object({
  skills: z.array(SkillSchema),
  total: z.number(),
  page: z.number().optional().default(1),
  pageSize: z.number().optional().default(20),
});

/**
 * ClawHub API Client
 * Base URL: https://clawhub.ai/api
 */
export class ClawHubClient {
  private apiKey?: string;
  private baseUrl: string;

  constructor(config: ClawHubConfig = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://clawhub.ai/api';
  }

  /**
   * Set API key for authenticated requests
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Make authenticated request to ClawHub API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`ClawHub API error ${response.status}: ${error}`);
    }

    return response.json();
  }

  /**
   * Search for skills in ClawHub
   * GET /api/skills/search?q=<query>&page=<page>&limit=<limit>
   */
  async searchSkills(
    query: string,
    options: { page?: number; limit?: number; tags?: string[] } = {}
  ): Promise<ClawHubSearchResult> {
    const params = new URLSearchParams({
      q: query,
      page: String(options.page || 1),
      limit: String(options.limit || 20),
    });

    if (options.tags?.length) {
      params.set('tags', options.tags.join(','));
    }

    const data = await this.request<z.infer<typeof SearchResultSchema>>(
      `/skills/search?${params.toString()}`
    );

    return SearchResultSchema.parse(data);
  }

  /**
   * Get skill details by name or ID
   * GET /api/skills/<name>
   */
  async getSkill(nameOrId: string): Promise<ClawHubSkill> {
    const data = await this.request<z.infer<typeof SkillSchema>>(
      `/skills/${encodeURIComponent(nameOrId)}`
    );

    return SkillSchema.parse(data);
  }

  /**
   * Get featured/trending skills
   * GET /api/skills/featured
   */
  async getFeatured(): Promise<ClawHubSkill[]> {
    const data = await this.request<{ skills: z.infer<typeof SkillSchema>[] }>(
      '/skills/featured'
    );

    return data.skills.map((s) => SkillSchema.parse(s));
  }

  /**
   * Get all available skills (catalog)
   * GET /api/skills?page=<page>&limit=<limit>
   */
  async listSkills(options: { page?: number; limit?: number } = {}): Promise<ClawHubSearchResult> {
    const params = new URLSearchParams({
      page: String(options.page || 1),
      limit: String(options.limit || 50),
    });

    const data = await this.request<z.infer<typeof SearchResultSchema>>(
      `/skills?${params.toString()}`
    );

    return SearchResultSchema.parse(data);
  }

  /**
   * Get skill categories/tags
   * GET /api/skills/tags
   */
  async getTags(): Promise<{ name: string; count: number }[]> {
    const data = await this.request<{ tags: { name: string; count: number }[] }>(
      '/skills/tags'
    );

    return data.tags;
  }

  /**
   * Vector search for skills (semantic similarity)
   * POST /api/skills/vector-search
   */
  async vectorSearch(
    query: string,
    options: { limit?: number } = {}
  ): Promise<ClawHubSearchResult> {
    const data = await this.request<z.infer<typeof SearchResultSchema>>(
      '/skills/vector-search',
      {
        method: 'POST',
        body: JSON.stringify({
          query,
          limit: options.limit || 20,
        }),
      }
    );

    return SearchResultSchema.parse(data);
  }

  /**
   * Publish a skill to ClawHub
   * POST /api/skills/publish
   */
  async publishSkill(skill: {
    name: string;
    description: string;
    content: string;
    tags?: string[];
    sourceUrl?: string;
  }): Promise<{ id: string; url: string }> {
    if (!this.apiKey) {
      throw new Error('API key required for publishing. Set with setApiKey() or DUCK_API_KEY env');
    }

    return this.request<{ id: string; url: string }>('/skills/publish', {
      method: 'POST',
      body: JSON.stringify(skill),
    });
  }

  /**
   * Update an existing skill
   * PUT /api/skills/<id>
   */
  async updateSkill(
    id: string,
    updates: Partial<{
      description: string;
      content: string;
      tags: string[];
      version: string;
    }>
  ): Promise<ClawHubSkill> {
    if (!this.apiKey) {
      throw new Error('API key required for updating. Set with setApiKey() or DUCK_API_KEY env');
    }

    const data = await this.request<z.infer<typeof SkillSchema>>(
      `/skills/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );

    return SkillSchema.parse(data);
  }

  /**
   * Delete a skill
   * DELETE /api/skills/<id>
   */
  async deleteSkill(id: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('API key required for deletion. Set with setApiKey() or DUCK_API_KEY env');
    }

    await this.request(`/skills/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get installed skills (local manifest)
   * Not an API call - reads from local .duck/skills.json
   */
  async getInstalledSkills(): Promise<{ name: string; version: string; path: string }[]> {
    // This is handled by SkillInstaller
    return [];
  }
}

// ============ SOUL Registry (onlycrabs.ai) ============

export interface Soul {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  content: string;
  tags: string[];
  downloads: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * SOUL Registry Client (onlycrabs.ai)
 * Registry for AI persona/identity files
 */
export class SoulRegistryClient {
  private apiKey?: string;
  private baseUrl: string;

  constructor(config: ClawHubConfig = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://onlycrabs.ai/api';
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`SOUL Registry API error ${response.status}: ${error}`);
    }

    return response.json();
  }

  /**
   * Search for SOULs
   * GET /api/souls/search?q=<query>
   */
  async searchSouls(
    query: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ souls: Soul[]; total: number }> {
    const params = new URLSearchParams({
      q: query,
      page: String(options.page || 1),
      limit: String(options.limit || 20),
    });

    return this.request<{ souls: Soul[]; total: number }>(
      `/souls/search?${params.toString()}`
    );
  }

  /**
   * Get SOUL details
   * GET /api/souls/<name>
   */
  async getSoul(nameOrId: string): Promise<Soul> {
    return this.request<Soul>(`/souls/${encodeURIComponent(nameOrId)}`);
  }

  /**
   * List featured SOULs
   * GET /api/souls/featured
   */
  async getFeatured(): Promise<Soul[]> {
    const data = await this.request<{ souls: Soul[] }>('/souls/featured');
    return data.souls;
  }

  /**
   * Publish a SOUL
   * POST /api/souls/publish
   */
  async publishSoul(soul: {
    name: string;
    description: string;
    content: string;
    tags?: string[];
  }): Promise<{ id: string; url: string }> {
    if (!this.apiKey) {
      throw new Error('API key required for publishing');
    }

    return this.request<{ id: string; url: string }>('/souls/publish', {
      method: 'POST',
      body: JSON.stringify(soul),
    });
  }

  /**
   * Download SOUL content
   * GET /api/souls/<name>/download
   */
  async downloadSoul(nameOrId: string): Promise<string> {
    const data = await this.request<{ content: string }>(
      `/souls/${encodeURIComponent(nameOrId)}/download`
    );
    return data.content;
  }
}

export default ClawHubClient;

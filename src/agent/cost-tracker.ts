/**
 * 🦆 Duck Agent - Cost Tracking System
 * Based on DuckBot-OS cost_tracker.py
 */

export interface CostRecord {
  timestamp: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  requestType: string;
  userId?: string;
  sessionId?: string;
}

export interface CostSummary {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  projectedMonthly: number;
  averageCostPerRequest: number;
}

export interface ModelPricing {
  provider: string;
  model: string;
  inputCostPer1K: number;
  outputCostPer1K: number;
  isFree: boolean;
}

// Model pricing database (updated regularly)
const MODEL_PRICING: Record<string, ModelPricing> = {
  // MiniMax
  'MiniMax-M2.5': { provider: 'minimax', model: 'MiniMax-M2.5', inputCostPer1K: 0.5, outputCostPer1K: 0.5, isFree: false },
  'abab6.5-chat': { provider: 'minimax', model: 'abab6.5-chat', inputCostPer1K: 0.3, outputCostPer1K: 0.3, isFree: false },
  
  // OpenAI
  'gpt-4o': { provider: 'openai', model: 'gpt-4o', inputCostPer1K: 2.5, outputCostPer1K: 10.0, isFree: false },
  'gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini', inputCostPer1K: 0.15, outputCostPer1K: 0.6, isFree: false },
  'gpt-4-turbo': { provider: 'openai', model: 'gpt-4-turbo', inputCostPer1K: 10.0, outputCostPer1K: 30.0, isFree: false },
  
  // Anthropic
  'claude-3-5-sonnet': { provider: 'anthropic', model: 'claude-3-5-sonnet', inputCostPer1K: 3.0, outputCostPer1K: 15.0, isFree: false },
  'claude-3-haiku': { provider: 'anthropic', model: 'claude-3-haiku', inputCostPer1K: 0.25, outputCostPer1K: 1.25, isFree: false },
  
  // LM Studio (Local - Free)
  'local': { provider: 'lmstudio', model: 'local', inputCostPer1K: 0, outputCostPer1K: 0, isFree: true },
  'lmstudio': { provider: 'lmstudio', model: 'local-model', inputCostPer1K: 0, outputCostPer1K: 0, isFree: true },
  
  // Free models
  'qwen': { provider: 'qwen', model: 'qwen', inputCostPer1K: 0, outputCostPer1K: 0, isFree: true },
  'glm-4': { provider: 'minimax', model: 'glm-4', inputCostPer1K: 0, outputCostPer1K: 0, isFree: true },
};

export class CostTracker {
  private records: CostRecord[] = [];
  private totalCost: number = 0;
  private totalTokens: number = 0;
  private budget: number = 10; // $10 default budget
  
  constructor(budget: number = 10) {
    this.budget = budget;
  }

  /**
   * Calculate cost for a request based on tokens and model
   */
  calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const key = model.toLowerCase();
    const pricing = MODEL_PRICING[key] || MODEL_PRICING[provider.toLowerCase()];
    
    if (!pricing || pricing.isFree) {
      return 0;
    }

    const inputCost = (inputTokens / 1000) * pricing.inputCostPer1K;
    const outputCost = (outputTokens / 1000) * pricing.outputCostPer1K;
    
    return inputCost + outputCost;
  }

  /**
   * Track a request
   */
  track(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    requestType: string = 'chat',
    userId?: string,
    sessionId?: string
  ): CostRecord {
    const cost = this.calculateCost(provider, model, inputTokens, outputTokens);
    
    const record: CostRecord = {
      timestamp: Date.now(),
      provider,
      model,
      inputTokens,
      outputTokens,
      totalCost: cost,
      requestType,
      userId,
      sessionId
    };

    this.records.push(record);
    this.totalCost += cost;
    this.totalTokens += inputTokens + outputTokens;

    return record;
  }

  /**
   * Get cost summary
   */
  getSummary(): CostSummary {
    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    for (const record of this.records) {
      byProvider[record.provider] = (byProvider[record.provider] || 0) + record.totalCost;
      byModel[record.model] = (byModel[record.model] || 0) + record.totalCost;
    }

    // Project monthly based on current usage
    const now = Date.now();
    const firstRecord = this.records[0]?.timestamp || now;
    const hoursElapsed = (now - firstRecord) / (1000 * 60 * 60);
    const hoursInMonth = 24 * 30;
    const projectedMonthly = hoursElapsed > 0 
      ? (this.totalCost / hoursElapsed) * hoursInMonth 
      : 0;

    return {
      totalCost: this.totalCost,
      totalTokens: this.totalTokens,
      totalRequests: this.records.length,
      byProvider,
      byModel,
      projectedMonthly,
      averageCostPerRequest: this.records.length > 0 
        ? this.totalCost / this.records.length 
        : 0
    };
  }

  /**
   * Get cost for a specific time period
   */
  getCostByPeriod(startTime: number, endTime: number = Date.now()): CostSummary {
    const filtered = this.records.filter(
      r => r.timestamp >= startTime && r.timestamp <= endTime
    );

    const totalCost = filtered.reduce((sum, r) => sum + r.totalCost, 0);
    const totalTokens = filtered.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);

    return {
      totalCost,
      totalTokens,
      totalRequests: filtered.length,
      byProvider: {},
      byModel: {},
      projectedMonthly: 0,
      averageCostPerRequest: filtered.length > 0 ? totalCost / filtered.length : 0
    };
  }

  /**
   * Get daily cost
   */
  getDailyCost(): number {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return this.getCostByPeriod(startOfDay.getTime()).totalCost;
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): number {
    return Math.max(0, this.budget - this.totalCost);
  }

  /**
   * Check if under budget
   */
  isUnderBudget(): boolean {
    return this.totalCost < this.budget;
  }

  /**
   * Set budget
   */
  setBudget(budget: number): void {
    this.budget = budget;
  }

  /**
   * Get all records
   */
  getRecords(): CostRecord[] {
    return [...this.records];
  }

  /**
   * Reset tracking
   */
  reset(): void {
    this.records = [];
    this.totalCost = 0;
    this.totalTokens = 0;
  }

  /**
   * Export to JSON
   */
  toJSON(): string {
    return JSON.stringify({
      records: this.records,
      summary: this.getSummary(),
      budget: this.budget
    }, null, 2);
  }

  /**
   * Import from JSON
   */
  fromJSON(json: string): void {
    try {
      const data = JSON.parse(json);
      this.records = data.records || [];
      this.totalCost = this.records.reduce((sum, r) => sum + r.totalCost, 0);
      this.totalTokens = this.records.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);
      this.budget = data.budget || 10;
    } catch (e) {
      console.error('Failed to parse cost data:', e);
    }
  }
}

export default CostTracker;

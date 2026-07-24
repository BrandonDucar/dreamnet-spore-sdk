export interface BudgetPolicyConfig {
  dailyCapUsd: number;
  currency: string;
  actionOnExceed: 'PAUSE_NON_ESSENTIAL' | 'EMERGENCY_STOP' | 'WARN_ONLY';
}

export interface VelocityPolicyConfig {
  targetTokensPerSecond: number;
  throttleIntensity: number; // 0.0 to 1.0
  maxQueueDepth: number;
}

export class ConfigurableGovernor {
  private budgetConfig: BudgetPolicyConfig;
  private velocityConfig: VelocityPolicyConfig;
  private currentSpendUsd = 0;

  constructor(
    budget: Partial<BudgetPolicyConfig> = {},
    velocity: Partial<VelocityPolicyConfig> = {}
  ) {
    this.budgetConfig = {
      dailyCapUsd: budget.dailyCapUsd ?? 50.0,
      currency: budget.currency ?? 'USD',
      actionOnExceed: budget.actionOnExceed ?? 'PAUSE_NON_ESSENTIAL'
    };
    this.velocityConfig = {
      targetTokensPerSecond: velocity.targetTokensPerSecond ?? 1000,
      throttleIntensity: velocity.throttleIntensity ?? 0.0,
      maxQueueDepth: velocity.maxQueueDepth ?? 500
    };
  }

  public recordSpend(usdAmount: number): boolean {
    this.currentSpendUsd += usdAmount;
    if (this.currentSpendUsd >= this.budgetConfig.dailyCapUsd) {
      console.warn(`⚠️ [Governor Alert] Budget cap reached: $${this.currentSpendUsd.toFixed(2)} / $${this.budgetConfig.dailyCapUsd.toFixed(2)} ${this.budgetConfig.currency}`);
      return false; // Action blocked
    }
    return true; // Action allowed
  }

  public getStatus(): { spend: number; limit: number; allowed: boolean } {
    return {
      spend: this.currentSpendUsd,
      limit: this.budgetConfig.dailyCapUsd,
      allowed: this.currentSpendUsd < this.budgetConfig.dailyCapUsd
    };
  }
}

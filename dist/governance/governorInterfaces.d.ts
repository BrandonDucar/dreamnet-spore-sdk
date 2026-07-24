export interface BudgetPolicyConfig {
    dailyCapUsd: number;
    currency: string;
    actionOnExceed: 'PAUSE_NON_ESSENTIAL' | 'EMERGENCY_STOP' | 'WARN_ONLY';
}
export interface VelocityPolicyConfig {
    targetTokensPerSecond: number;
    burstAllowance: number;
    bucketCapacityTokens: number;
}
export interface BudgetReservation {
    reservationId: string;
    amountUsd: number;
    reservedAt: string;
    expiresAt: string;
    status: 'RESERVED' | 'SETTLED' | 'RELEASED';
}
export declare class ConfigurableGovernor {
    private budgetConfig;
    private velocityConfig;
    private currentSpendUsd;
    private reservedSpendUsd;
    private reservations;
    private tokensInBucket;
    private lastRefillTimestampMs;
    constructor(budget?: Partial<BudgetPolicyConfig>, velocity?: Partial<VelocityPolicyConfig>);
    /**
     * Atomic Budget Reservation (Prevents Concurrent Worker Race Conditions)
     */
    reserveSpend(requestedUsd: number): BudgetReservation | null;
    /**
     * Settle Budget Reservation with Actual Amount Spent
     */
    settleSpend(reservationId: string, actualUsdSpent: number): boolean;
    /**
     * Leaky-Bucket Token Rate Limiting
     */
    consumeTokens(tokens: number): boolean;
    getStatus(): {
        spend: number;
        reserved: number;
        limit: number;
        tokensAvailable: number;
    };
}

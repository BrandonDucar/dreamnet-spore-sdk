export class ConfigurableGovernor {
    budgetConfig;
    velocityConfig;
    currentSpendUsd = 0;
    reservedSpendUsd = 0;
    reservations = new Map();
    // Leaky Bucket State
    tokensInBucket;
    lastRefillTimestampMs;
    constructor(budget = {}, velocity = {}) {
        this.budgetConfig = {
            dailyCapUsd: budget.dailyCapUsd ?? 50.0,
            currency: budget.currency ?? 'USD',
            actionOnExceed: budget.actionOnExceed ?? 'PAUSE_NON_ESSENTIAL'
        };
        this.velocityConfig = {
            targetTokensPerSecond: velocity.targetTokensPerSecond ?? 1000,
            burstAllowance: velocity.burstAllowance ?? 500,
            bucketCapacityTokens: velocity.bucketCapacityTokens ?? 5000
        };
        this.tokensInBucket = this.velocityConfig.bucketCapacityTokens;
        this.lastRefillTimestampMs = Date.now();
    }
    /**
     * Atomic Budget Reservation (Prevents Concurrent Worker Race Conditions)
     */
    reserveSpend(requestedUsd) {
        const effectiveSpend = this.currentSpendUsd + this.reservedSpendUsd;
        if (effectiveSpend + requestedUsd > this.budgetConfig.dailyCapUsd) {
            console.warn(`⚠️ [Governor Race Shield] Reservation denied: Requested $${requestedUsd.toFixed(2)} exceeds cap $${this.budgetConfig.dailyCapUsd.toFixed(2)}`);
            return null;
        }
        const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const reservation = {
            reservationId,
            amountUsd: requestedUsd,
            reservedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60000).toISOString(), // 60s expiration
            status: 'RESERVED'
        };
        this.reservedSpendUsd += requestedUsd;
        this.reservations.set(reservationId, reservation);
        return reservation;
    }
    /**
     * Settle Budget Reservation with Actual Amount Spent
     */
    settleSpend(reservationId, actualUsdSpent) {
        const reservation = this.reservations.get(reservationId);
        if (!reservation || reservation.status !== 'RESERVED') {
            return false;
        }
        this.reservedSpendUsd -= reservation.amountUsd;
        this.currentSpendUsd += actualUsdSpent;
        reservation.status = 'SETTLED';
        return true;
    }
    /**
     * Leaky-Bucket Token Rate Limiting
     */
    consumeTokens(tokens) {
        const now = Date.now();
        const elapsedSeconds = (now - this.lastRefillTimestampMs) / 1000;
        this.tokensInBucket = Math.min(this.velocityConfig.bucketCapacityTokens, this.tokensInBucket + elapsedSeconds * this.velocityConfig.targetTokensPerSecond);
        this.lastRefillTimestampMs = now;
        if (this.tokensInBucket >= tokens) {
            this.tokensInBucket -= tokens;
            return true; // Allowed
        }
        return false; // Throttled
    }
    getStatus() {
        return {
            spend: this.currentSpendUsd,
            reserved: this.reservedSpendUsd,
            limit: this.budgetConfig.dailyCapUsd,
            tokensAvailable: Math.round(this.tokensInBucket)
        };
    }
}

export type BreakerState = 'closed' | 'open' | 'half-open';

/**
 * Consecutive-failure circuit breaker. While open, callers skip the protected dependency;
 * after `cooldownMs` a single trial request is let through (half-open) to probe recovery.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private trialInFlight = false;
  private stateValue: BreakerState = 'closed';

  constructor(
    private readonly failureThreshold: number,
    private readonly cooldownMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get state(): BreakerState {
    if (this.stateValue === 'open' && this.now() - this.openedAt >= this.cooldownMs) this.stateValue = 'half-open';
    return this.stateValue;
  }

  /** Whether the next call should go to the protected dependency. */
  allowRequest(): boolean {
    const state = this.state;
    if (state === 'closed') return true;
    if (state === 'half-open' && !this.trialInFlight) {
      this.trialInFlight = true;
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.trialInFlight = false;
    this.stateValue = 'closed';
  }

  recordFailure(): void {
    this.trialInFlight = false;
    this.failures += 1;
    if (this.stateValue === 'half-open' || this.failures >= this.failureThreshold) {
      this.stateValue = 'open';
      this.openedAt = this.now();
    }
  }
}

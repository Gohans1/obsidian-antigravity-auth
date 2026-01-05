import { AccountManager } from './AccountManager';
import { GoogleAccount } from '../types';

export interface RequestResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  statusCode?: number;
  retryAfter?: number;
}

export class ResilienceEngine {
  constructor(
    private accountManager: AccountManager,
    private maxRetries: number = 3
  ) {}

  async executeWithRetry<T>(
    requestFn: (account: GoogleAccount) => Promise<RequestResult<T>>
  ): Promise<RequestResult<T>> {
    let lastError: Error | undefined;
    let attemptCount = 0;

    while (attemptCount < this.maxRetries) {
      const account = this.accountManager.getActiveAccount();
      if (!account) {
        return {
          success: false,
          error: new Error('No active accounts available'),
          statusCode: 429
        };
      }

      attemptCount++;

      try {
        const result = await requestFn(account);

        if (result.success) {
          this.accountManager.markActive(account.email);
          return result;
        }

        // Handle rate limiting
        if (result.statusCode === 429) {
          const retryAfter = result.retryAfter || 60000; // Default 60s
          console.log(`Rate limited on ${account.email}, retrying after ${retryAfter}ms`);
          this.accountManager.markRateLimited(account.email, retryAfter);
          
          // Try to rotate to next account
          const nextAccount = this.accountManager.rotateToNextAccount();
          if (!nextAccount) {
            // All accounts rate limited
            return {
              success: false,
              error: new Error('All accounts are rate limited'),
              statusCode: 429,
              retryAfter
            };
          }
          continue;
        }

        // Non-retryable error
        if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) {
          return result;
        }

        lastError = result.error;
      } catch (error) {
        lastError = error as Error;
        console.error(`Request failed on attempt ${attemptCount}:`, error);
      }
    }

    return {
      success: false,
      error: lastError || new Error('Max retries exceeded'),
      statusCode: 500
    };
  }

  parseRetryAfter(errorMessage: string): number {
    // Parse "Your quota will reset after 3s" format
    const match = errorMessage.match(/reset after (\d+(?:\.\d+)?)(s|ms)/);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2];
      return unit === 'ms' ? value : value * 1000;
    }
    return 60000; // Default 60 seconds
  }
}

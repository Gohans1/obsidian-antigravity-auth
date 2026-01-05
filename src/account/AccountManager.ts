import { GoogleAccount, AccountStatus, OAUTH_CONFIG } from '../types';

export class AccountManager {
  private accounts: Map<string, GoogleAccount> = new Map();
  private currentAccountEmail: string | null = null;
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private clientId: string;
  private clientSecret: string;

  constructor(
    private saveCallback: (accounts: GoogleAccount[]) => Promise<void>,
    clientId: string,
    clientSecret: string
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async loadAccounts(accounts: GoogleAccount[]): Promise<void> {
    this.accounts.clear();
    for (const account of accounts) {
      this.accounts.set(account.email, account);
      this.scheduleTokenRefresh(account);
    }
    if (accounts.length > 0 && !this.currentAccountEmail) {
      this.currentAccountEmail = accounts[0].email;
    }
  }

  addAccount(account: GoogleAccount): void {
    this.accounts.set(account.email, account);
    if (!this.currentAccountEmail) {
      this.currentAccountEmail = account.email;
    }
    this.scheduleTokenRefresh(account);
    this.persistAccounts();
  }

  removeAccount(email: string): void {
    const timer = this.refreshTimers.get(email);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(email);
    }
    this.accounts.delete(email);
    if (this.currentAccountEmail === email) {
      const remaining = Array.from(this.accounts.keys());
      this.currentAccountEmail = remaining.length > 0 ? remaining[0] : null;
    }
    this.persistAccounts();
  }

  getAccounts(): GoogleAccount[] {
    return Array.from(this.accounts.values());
  }

  getCurrentAccount(): GoogleAccount | null {
    if (!this.currentAccountEmail) return null;
    return this.accounts.get(this.currentAccountEmail) || null;
  }

  getActiveAccount(): GoogleAccount | null {
    // First try current account if active
    const current = this.getCurrentAccount();
    if (current && current.status === 'active' && !this.isRateLimited(current)) {
      return current;
    }

    // Find any active account
    for (const account of this.accounts.values()) {
      if (account.status === 'active' && !this.isRateLimited(account)) {
        this.currentAccountEmail = account.email;
        return account;
      }
    }
    return null;
  }

  markRateLimited(email: string, durationMs: number): void {
    const account = this.accounts.get(email);
    if (account) {
      account.status = 'rate_limited';
      account.rateLimitExpiry = Date.now() + durationMs;
      this.persistAccounts();
    }
  }

  markActive(email: string): void {
    const account = this.accounts.get(email);
    if (account) {
      account.status = 'active';
      account.lastUsed = Date.now();
      delete account.rateLimitExpiry;
      this.persistAccounts();
    }
  }

  isRateLimited(account: GoogleAccount): boolean {
    if (account.rateLimitExpiry && account.rateLimitExpiry > Date.now()) {
      return true;
    }
    // Clear expired rate limit
    if (account.rateLimitExpiry && account.rateLimitExpiry <= Date.now()) {
      account.status = 'active';
      delete account.rateLimitExpiry;
    }
    return false;
  }

  rotateToNextAccount(): GoogleAccount | null {
    const accounts = Array.from(this.accounts.values());
    const currentIndex = accounts.findIndex(a => a.email === this.currentAccountEmail);
    
    // Try each account starting from next one
    for (let i = 1; i <= accounts.length; i++) {
      const nextIndex = (currentIndex + i) % accounts.length;
      const candidate = accounts[nextIndex];
      if (candidate.status === 'active' && !this.isRateLimited(candidate)) {
        this.currentAccountEmail = candidate.email;
        return candidate;
      }
    }
    return null;
  }

  private scheduleTokenRefresh(account: GoogleAccount): void {
    // Cancel existing timer
    const existingTimer = this.refreshTimers.get(account.email);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule refresh 5 minutes before expiry
    const refreshIn = Math.max(0, account.expiresAt - Date.now() - 5 * 60 * 1000);
    const timer = setTimeout(() => this.refreshToken(account.email), refreshIn);
    this.refreshTimers.set(account.email, timer);
  }

  async refreshToken(email: string): Promise<boolean> {
    const account = this.accounts.get(email);
    if (!account) return false;

    try {
      const response = await fetch(OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: account.refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        account.status = 'expired';
        this.persistAccounts();
        return false;
      }

      const data = await response.json();
      account.accessToken = data.access_token;
      account.expiresAt = Date.now() + (data.expires_in * 1000);
      account.status = 'active';
      
      this.scheduleTokenRefresh(account);
      this.persistAccounts();
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      account.status = 'error';
      this.persistAccounts();
      return false;
    }
  }

  private async persistAccounts(): Promise<void> {
    await this.saveCallback(this.getAccounts());
  }

  dispose(): void {
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();
  }
}

import { Plugin, Notice } from 'obsidian';
import { AccountManager } from './account/AccountManager';
import { OAuthManager } from './auth/OAuthManager';
import { ProxyServer } from './proxy/ProxyServer';
import { AntigravitySettingsTab, SettingsTabCallbacks } from './ui/SettingsTab';
import { PluginSettings, DEFAULT_SETTINGS, GoogleAccount } from './types';

interface PluginData {
  settings: PluginSettings;
  accounts: GoogleAccount[];
}

export default class AntigravityAuthPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  private accountManager!: AccountManager;
  private oauthManager!: OAuthManager;
  private proxyServer!: ProxyServer;
  private settingsTab!: AntigravitySettingsTab;
  private proxyRunning: boolean = false;

  async onload(): Promise<void> {
    console.log('Loading Antigravity Auth Plugin');

    // Load data
    const data = await this.loadPluginData();

    // Initialize managers with OAuth credentials (from settings or defaults)
    this.accountManager = new AccountManager(
      async (accounts) => {
        await this.savePluginData({ settings: this.settings, accounts });
      },
      this.settings.oauthClientId,
      this.settings.oauthClientSecret
    );

    this.oauthManager = new OAuthManager(
      this.settings.oauthClientId,
      this.settings.oauthClientSecret
    );
    this.proxyServer = new ProxyServer(this.accountManager, this.settings.proxyPort);

    // Load accounts
    if (data?.accounts) {
      await this.accountManager.loadAccounts(data.accounts);
    }

    // Add settings tab
    const callbacks: SettingsTabCallbacks = {
      onLogin: () => this.performLogin(),
      onRemoveAccount: (email) => this.removeAccount(email),
      onSettingsChange: (settings) => this.updateSettings(settings),
      getAccounts: () => this.accountManager.getAccounts(),
      getProxyStatus: () => ({ running: this.proxyRunning, port: this.settings.proxyPort })
    };

    this.settingsTab = new AntigravitySettingsTab(
      this.app,
      this,
      this.settings,
      callbacks
    );
    this.addSettingTab(this.settingsTab);

    // Add commands
    this.addCommand({
      id: 'start-proxy',
      name: 'Start Proxy Server',
      callback: () => this.startProxy()
    });

    this.addCommand({
      id: 'stop-proxy',
      name: 'Stop Proxy Server',
      callback: () => this.stopProxy()
    });

    this.addCommand({
      id: 'add-account',
      name: 'Add Google Account',
      callback: () => this.performLogin()
    });

    // Auto-start proxy if configured
    if (this.settings.autoStartProxy && this.accountManager.getAccounts().length > 0) {
      await this.startProxy();
    }
  }

  async onunload(): Promise<void> {
    console.log('Unloading Antigravity Auth Plugin');
    this.stopProxy();
    this.accountManager.dispose();
    this.oauthManager.stopCallbackServer();
  }

  private async loadPluginData(): Promise<PluginData | null> {
    const data = await this.loadData();
    if (data) {
      // Merge settings, but ensure OAuth credentials fall back to defaults if empty
      const mergedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
      
      // CRITICAL: Empty OAuth credentials must fall back to defaults
      if (!mergedSettings.oauthClientId || mergedSettings.oauthClientId.trim() === '') {
        mergedSettings.oauthClientId = DEFAULT_SETTINGS.oauthClientId;
      }
      if (!mergedSettings.oauthClientSecret || mergedSettings.oauthClientSecret.trim() === '') {
        mergedSettings.oauthClientSecret = DEFAULT_SETTINGS.oauthClientSecret;
      }
      
      this.settings = mergedSettings;
      return data as PluginData;
    }
    return null;
  }

  private async savePluginData(data: PluginData): Promise<void> {
    await this.saveData(data);
  }

  private async performLogin(): Promise<void> {
    try {
      new Notice('Opening Google login...');
      const account = await this.oauthManager.performFullLogin();
      console.log('OAuth login successful, adding account:', account.email);
      
      this.accountManager.addAccount(account);
      new Notice(`Successfully added account: ${account.email}`);
      
      // Refresh settings tab to show new account
      this.settingsTab.refresh();
      
      // Start proxy if not running and this is the first account
      if (!this.proxyRunning && this.settings.autoStartProxy) {
        await this.startProxy();
        // Refresh again to show proxy status
        this.settingsTab.refresh();
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      new Notice(`Login failed: ${error.message}`);
      // Don't re-throw - just log and notify user
    }
  }

  private removeAccount(email: string): void {
    this.accountManager.removeAccount(email);
    new Notice(`Removed account: ${email}`);
    
    // Stop proxy if no accounts left
    if (this.accountManager.getAccounts().length === 0) {
      this.stopProxy();
    }
  }

  private async updateSettings(settings: PluginSettings): Promise<void> {
    const portChanged = settings.proxyPort !== this.settings.proxyPort;
    const credentialsChanged = 
      settings.oauthClientId !== this.settings.oauthClientId ||
      settings.oauthClientSecret !== this.settings.oauthClientSecret;
    
    this.settings = settings;
    this.settingsTab.updateSettings(settings);
    
    await this.savePluginData({
      settings: this.settings,
      accounts: this.accountManager.getAccounts()
    });

    // Recreate OAuthManager if credentials changed
    if (credentialsChanged) {
      const clientId = settings.oauthClientId || DEFAULT_SETTINGS.oauthClientId;
      const clientSecret = settings.oauthClientSecret || DEFAULT_SETTINGS.oauthClientSecret;
      this.oauthManager = new OAuthManager(clientId, clientSecret);
    }

    // Restart proxy if port changed
    if (portChanged && this.proxyRunning) {
      await this.stopProxy();
      await this.startProxy();
    }
  }

  private async startProxy(): Promise<void> {
    if (this.proxyRunning) {
      new Notice('Proxy is already running');
      return;
    }

    if (this.accountManager.getAccounts().length === 0) {
      new Notice('Please add a Google account first');
      return;
    }

    try {
      this.proxyServer = new ProxyServer(this.accountManager, this.settings.proxyPort);
      await this.proxyServer.start();
      this.proxyRunning = true;
      new Notice(`Proxy started on http://localhost:${this.settings.proxyPort}/v1`);
    } catch (error: any) {
      console.error('Failed to start proxy:', error);
      new Notice(`Failed to start proxy: ${error.message}`);
    }
  }

  private stopProxy(): void {
    if (!this.proxyRunning) return;
    
    this.proxyServer.stop();
    this.proxyRunning = false;
    new Notice('Proxy server stopped');
  }
}

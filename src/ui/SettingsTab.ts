import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { PluginSettings, GoogleAccount, AVAILABLE_MODELS } from '../types';

export interface SettingsTabCallbacks {
  onLogin: () => Promise<void>;
  onRemoveAccount: (email: string) => void;
  onSettingsChange: (settings: PluginSettings) => Promise<void>;
  getAccounts: () => GoogleAccount[];
  getProxyStatus: () => { running: boolean; port: number };
}

export class AntigravitySettingsTab extends PluginSettingTab {
  private settings: PluginSettings;
  private callbacks: SettingsTabCallbacks;

  constructor(app: App, plugin: any, settings: PluginSettings, callbacks: SettingsTabCallbacks) {
    super(app, plugin);
    this.settings = settings;
    this.callbacks = callbacks;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Header
    containerEl.createEl('h1', { text: 'Antigravity Auth Settings' });

    // Proxy Status Section
    this.createProxyStatusSection(containerEl);

    // Accounts Section
    this.createAccountsSection(containerEl);

    // Settings Section
    this.createSettingsSection(containerEl);
  }

  private createProxyStatusSection(containerEl: HTMLElement): void {
    const status = this.callbacks.getProxyStatus();
    
    containerEl.createEl('h2', { text: 'Proxy Status' });
    
    const statusContainer = containerEl.createDiv({ cls: 'proxy-status-container' });
    
    const indicator = statusContainer.createSpan({ 
      cls: `status-indicator ${status.running ? 'status-active' : 'status-inactive'}` 
    });
    indicator.style.cssText = `
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: ${status.running ? '#4caf50' : '#f44336'};
      margin-right: 8px;
    `;
    
    statusContainer.createSpan({ 
      text: status.running 
        ? `Running on http://localhost:${status.port}/v1` 
        : 'Not running' 
    });

    if (status.running) {
      const copyBtn = containerEl.createEl('button', { text: 'Copy Endpoint URL' });
      copyBtn.style.marginLeft = '10px';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(`http://localhost:${status.port}/v1`);
        new Notice('Endpoint URL copied to clipboard!');
      };
    }
  }

  private createAccountsSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Google Accounts' });
    
    const accounts = this.callbacks.getAccounts();
    
    if (accounts.length === 0) {
      containerEl.createEl('p', { 
        text: 'No accounts configured. Add an account to start using Antigravity.' 
      });
    } else {
      const accountList = containerEl.createDiv({ cls: 'account-list' });
      
      for (const account of accounts) {
        const accountItem = accountList.createDiv({ cls: 'account-item' });
        accountItem.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px;
          margin: 5px 0;
          background: var(--background-secondary);
          border-radius: 5px;
        `;
        
        const leftSide = accountItem.createDiv();
        
        // Status indicator
        const statusColor = this.getStatusColor(account.status);
        const statusDot = leftSide.createSpan();
        statusDot.style.cssText = `
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: ${statusColor};
          margin-right: 8px;
        `;
        
        leftSide.createSpan({ text: account.email });
        
        const statusText = leftSide.createSpan({ 
          text: ` (${this.getStatusText(account)})`,
          cls: 'account-status'
        });
        statusText.style.cssText = 'color: var(--text-muted); font-size: 0.9em; margin-left: 8px;';
        
        // Remove button
        const removeBtn = accountItem.createEl('button', { text: 'Remove' });
        removeBtn.onclick = () => {
          this.callbacks.onRemoveAccount(account.email);
          this.display(); // Refresh
        };
      }
    }
    
    // Add account button
    const addBtn = containerEl.createEl('button', { 
      text: '+ Add Google Account',
      cls: 'mod-cta'
    });
    addBtn.style.marginTop = '10px';
    addBtn.onclick = async () => {
      try {
        await this.callbacks.onLogin();
        this.display(); // Refresh
        new Notice('Account added successfully!');
      } catch (error: any) {
        new Notice(`Login failed: ${error.message}`);
      }
    };
  }

  private createSettingsSection(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Configuration' });

    new Setting(containerEl)
      .setName('Proxy Port')
      .setDesc('Port for the local OpenAI-compatible proxy server')
      .addText(text => text
        .setPlaceholder('8787')
        .setValue(String(this.settings.proxyPort))
        .onChange(async (value) => {
          const port = parseInt(value) || 8787;
          this.settings.proxyPort = port;
          await this.callbacks.onSettingsChange(this.settings);
        }));

    new Setting(containerEl)
      .setName('Default Model')
      .setDesc('Model to use when none is specified')
      .addDropdown(dropdown => {
        for (const model of AVAILABLE_MODELS) {
          dropdown.addOption(model.id, model.name);
        }
        dropdown.setValue(this.settings.defaultModel);
        dropdown.onChange(async (value) => {
          this.settings.defaultModel = value;
          await this.callbacks.onSettingsChange(this.settings);
        });
      });

    new Setting(containerEl)
      .setName('Auto-start Proxy')
      .setDesc('Automatically start the proxy when Obsidian loads')
      .addToggle(toggle => toggle
        .setValue(this.settings.autoStartProxy)
        .onChange(async (value) => {
          this.settings.autoStartProxy = value;
          await this.callbacks.onSettingsChange(this.settings);
        }));

    new Setting(containerEl)
      .setName('Enable Logging')
      .setDesc('Log requests and responses for debugging')
      .addToggle(toggle => toggle
        .setValue(this.settings.enableLogging)
        .onChange(async (value) => {
          this.settings.enableLogging = value;
          await this.callbacks.onSettingsChange(this.settings);
        }));

    new Setting(containerEl)
      .setName('Max Retries')
      .setDesc('Maximum number of retry attempts on rate limit')
      .addSlider(slider => slider
        .setLimits(1, 10, 1)
        .setValue(this.settings.maxRetries)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.settings.maxRetries = value;
          await this.callbacks.onSettingsChange(this.settings);
        }));

    // Usage instructions
    containerEl.createEl('h2', { text: 'Usage with Obsidian Copilot' });
    const instructions = containerEl.createDiv({ cls: 'instructions' });
    instructions.innerHTML = `
      <ol>
        <li>Install and enable the Obsidian Copilot plugin</li>
        <li>Go to Copilot settings → Model section</li>
        <li>Set "API Base URL" to: <code>http://localhost:${this.settings.proxyPort}/v1</code></li>
        <li>Set "API Key" to any value (e.g., "unused")</li>
        <li>Select one of the Antigravity models</li>
      </ol>
    `;
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'active': return '#4caf50';
      case 'rate_limited': return '#ff9800';
      case 'expired': return '#f44336';
      case 'error': return '#f44336';
      default: return '#9e9e9e';
    }
  }

  private getStatusText(account: GoogleAccount): string {
    switch (account.status) {
      case 'active': return 'Active';
      case 'rate_limited': 
        if (account.rateLimitExpiry) {
          const remaining = Math.ceil((account.rateLimitExpiry - Date.now()) / 1000);
          return `Rate limited (${remaining}s)`;
        }
        return 'Rate limited';
      case 'expired': return 'Token expired';
      case 'error': return 'Error';
      default: return account.status;
    }
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }

  refresh(): void {
    this.display();
  }
}

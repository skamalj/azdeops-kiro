import { AuthCredentials, AuthResult } from '../types';

// Conditional import for VS Code API (for testing compatibility)
let vscode: any;
try {
  vscode = require('vscode');
} catch {
  // Mock for testing environment
  vscode = {
    workspace: {
      getConfiguration: () => ({
        get: () => undefined
      })
    }
  };
}

/**
 * Service for handling Azure DevOps authentication
 * Supports both Personal Access Token (PAT) and OAuth authentication
 */
export class AuthenticationService {
  private currentAuth: AuthResult | null = null;
  private readonly STORAGE_KEY = 'azure-devops-auth';

  /**
   * Authenticate with Azure DevOps using provided credentials
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      // Validate credentials format
      const validationResult = this.validateCredentials(credentials);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.error
        };
      }

      // Perform authentication based on type
      let authResult: AuthResult;
      if (credentials.authType === 'PAT') {
        authResult = await this.authenticateWithPAT(credentials);
      } else {
        authResult = await this.authenticateWithOAuth(credentials);
      }

      // Store successful authentication
      if (authResult.success) {
        this.currentAuth = authResult;
        await this.storeAuthSecurely(authResult, credentials);
      }

      return authResult;
    } catch (error) {
      return {
        success: false,
        error: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.currentAuth?.success === true && !this.isTokenExpired();
  }

  /**
   * Get current authentication result
   */
  getAuthResult(): AuthResult | null {
    return this.currentAuth;
  }

  /**
   * Clear authentication and stored tokens
   */
  async logout(): Promise<void> {
    this.currentAuth = null;
    await this.clearStoredAuth();
  }

  /**
   * Refresh authentication token if possible
   */
  async refreshToken(): Promise<AuthResult> {
    if (!this.currentAuth?.refreshToken) {
      return {
        success: false,
        error: 'No refresh token available'
      };
    }

    try {
      // Implement token refresh logic
      const refreshResult = await this.performTokenRefresh(this.currentAuth.refreshToken);
      
      if (refreshResult.success) {
        this.currentAuth = refreshResult;
        await this.updateStoredAuth(refreshResult);
      }

      return refreshResult;
    } catch (error) {
      return {
        success: false,
        error: `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get authentication header for API requests
   */
  getAuthHeader(): string | null {
    if (!this.isAuthenticated() || !this.currentAuth?.token) {
      return null;
    }

    return `Bearer ${this.currentAuth.token}`;
  }

  /**
   * Load stored authentication on service initialization
   */
  async loadStoredAuth(): Promise<void> {
    try {
      // First try to load from settings
      const settingsAuth = await this.loadFromSettings();
      if (settingsAuth) {
        this.currentAuth = settingsAuth;
        return;
      }

      // Fallback to stored auth
      const storedAuth = await this.retrieveStoredAuth();
      if (storedAuth && !this.isTokenExpired(storedAuth)) {
        this.currentAuth = storedAuth;
      } else if (storedAuth?.refreshToken) {
        // Try to refresh expired token
        await this.refreshToken();
      }
    } catch (error) {
      console.warn('Failed to load stored authentication:', error);
    }
  }

  /**
   * Load authentication from VS Code settings
   */
  async loadFromSettings(): Promise<AuthResult | null> {
    try {
      const config = vscode.workspace.getConfiguration('azureDevOps');
      const organizationUrl = config.get('organizationUrl') as string;
      const projectName = config.get('projectName') as string;
      const personalAccessToken = config.get('personalAccessToken') as string;

      if (organizationUrl && projectName && personalAccessToken) {
        const credentials: AuthCredentials = {
          organizationUrl,
          projectName,
          authType: 'PAT',
          token: personalAccessToken
        };

        // Validate credentials format first
        const validationResult = this.validateCredentials(credentials);
        if (!validationResult.isValid) {
          console.warn('Invalid credentials from settings:', validationResult.error);
          return null;
        }

        // Authenticate directly with PAT (avoid recursive call to authenticate)
        const authResult = await this.authenticateWithPAT(credentials);
        if (authResult.success) {
          this.currentAuth = authResult;
          return authResult;
        }
      }
    } catch (error) {
      console.warn('Failed to load authentication from settings:', error);
    }
    return null;
  }

  /**
   * Get organization URL from current credentials
   */
  getOrganizationUrl(): string {
    const credentials = this.getCurrentCredentials();
    return credentials?.organizationUrl || '';
  }

  /**
   * Get personal access token from current credentials
   */
  getPersonalAccessToken(): string {
    const credentials = this.getCurrentCredentials();
    return credentials?.token || '';
  }

  /**
   * Get current credentials from settings or stored auth
   */
  getCurrentCredentials(): AuthCredentials | null {
    try {
      const config = vscode.workspace.getConfiguration('azureDevOps');
      const organizationUrl = config.get('organizationUrl') as string;
      const projectName = config.get('projectName') as string;
      const personalAccessToken = config.get('personalAccessToken') as string;

      if (organizationUrl && projectName && personalAccessToken) {
        return {
          organizationUrl,
          projectName,
          authType: 'PAT',
          token: personalAccessToken
        };
      }
    } catch (error) {
      console.warn('Failed to get credentials from settings:', error);
    }
    return null;
  }

  /**
   * Validate credentials format and required fields
   */
  private validateCredentials(credentials: AuthCredentials): { isValid: boolean; error?: string } {
    if (!credentials.organizationUrl) {
      return { isValid: false, error: 'Organization URL is required' };
    }

    if (!credentials.projectName) {
      return { isValid: false, error: 'Project name is required' };
    }

    // Validate organization URL format
    const urlPattern = /^https:\/\/[a-zA-Z0-9-]+\.visualstudio\.com$|^https:\/\/dev\.azure\.com\/[a-zA-Z0-9-]+$/;
    if (!urlPattern.test(credentials.organizationUrl)) {
      return { isValid: false, error: 'Invalid Azure DevOps organization URL format' };
    }

    if (credentials.authType === 'PAT' && !credentials.token) {
      return { isValid: false, error: 'Personal Access Token is required for PAT authentication' };
    }

    return { isValid: true };
  }

  /**
   * Authenticate using Personal Access Token
   */
  private async authenticateWithPAT(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      // Test PAT by making a simple API call
      const testUrl = `${credentials.organizationUrl}/_apis/projects/${credentials.projectName}?api-version=7.0`;
      const response = await fetch(testUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${credentials.token}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return {
          success: true,
          token: credentials.token,
          // PAT tokens don't typically expire, but we set a long expiration
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        };
      } else {
        const errorText = await response.text();
        return {
          success: false,
          error: `PAT authentication failed: ${response.status} ${errorText}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `PAT authentication error: ${error instanceof Error ? error.message : 'Network error'}`
      };
    }
  }

  /**
   * Authenticate using OAuth (placeholder for OAuth implementation)
   */
  private async authenticateWithOAuth(_credentials: AuthCredentials): Promise<AuthResult> {
    // OAuth implementation would go here
    // For now, return not implemented
    return {
      success: false,
      error: 'OAuth authentication not yet implemented'
    };
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(auth?: AuthResult): boolean {
    const authToCheck = auth || this.currentAuth;
    if (!authToCheck?.expiresAt) {
      return false; // No expiration set
    }
    return new Date() >= authToCheck.expiresAt;
  }

  /**
   * Securely store authentication result
   */
  private async storeAuthSecurely(authResult: AuthResult, credentials: AuthCredentials): Promise<void> {
    // Use VS Code's secure storage (will be injected via dependency injection)
    const authData = {
      ...authResult,
      organizationUrl: credentials.organizationUrl,
      projectName: credentials.projectName,
      authType: credentials.authType
    };
    
    // For now, use a simple in-memory approach
    // In VS Code extension, this would use context.secrets
    this.storedAuthData = authData;
  }

  /**
   * Retrieve stored authentication
   */
  private async retrieveStoredAuth(): Promise<AuthResult | null> {
    try {
      if (!this.storedAuthData) return null;

      return {
        success: this.storedAuthData.success,
        token: this.storedAuthData.token,
        refreshToken: this.storedAuthData.refreshToken,
        expiresAt: this.storedAuthData.expiresAt ? new Date(this.storedAuthData.expiresAt) : undefined
      };
    } catch {
      return null;
    }
  }

  /**
   * Update stored authentication
   */
  private async updateStoredAuth(authResult: AuthResult): Promise<void> {
    if (this.storedAuthData) {
      this.storedAuthData = { ...this.storedAuthData, ...authResult };
    }
  }

  /**
   * Clear stored authentication
   */
  private async clearStoredAuth(): Promise<void> {
    this.storedAuthData = null;
  }

  private storedAuthData: any = null;

  /**
   * Perform token refresh (placeholder)
   */
  private async performTokenRefresh(_refreshToken: string): Promise<AuthResult> {
    // Token refresh implementation would go here
    return {
      success: false,
      error: 'Token refresh not yet implemented'
    };
  }
}
// Mathlib Manager Module - Handles mathlib integration, updates, and downloads
import { request } from 'obsidian';
import { SimpleEventEmitter } from '../utils/simple-event-emitter';

// GitHub release info for mathlib
const MATHLIB_REPO = 'leanprover-community/mathlib4';
const MATHLIB_RELEASES_URL = `https://api.github.com/repos/${MATHLIB_REPO}/releases`;
const MATHLIB_CDN_URL = 'https://cdn.jsdelivr.net/gh/leanprover-community/mathlib4@';

export interface MathlibVersion {
  version: string;
  releaseDate: string;
  downloadUrl: string;
  size: number;
  compatibleLean: string[];
}

export interface MathlibStats {
  version: string;
  installedDate: string;
  lastUpdated: string;
  size: number;
}

export interface MathlibManagerOptions {
  wasmMode: boolean;
  checkUpdatesInterval: number; // in days
  lastUpdateCheck: number; // timestamp
  currentVersion?: string;
}

/**
 * MathlibManager - Manages mathlib installations, updates, and integration
 * Works both in WASM and local modes with different implementation details
 */
export class MathlibManager extends SimpleEventEmitter {
  private wasmMode: boolean;
  private mathlibWasmUrl: string | null = null;
  private mathlibWasmData: ArrayBuffer | null = null;
  private mathlibStats: MathlibStats | null = null;
  private checkInterval: number;
  private lastCheck: number;
  private currentVersion: string | null;
  
  constructor(options: MathlibManagerOptions) {
    super();
    this.wasmMode = options.wasmMode || false;
    this.checkInterval = options.checkUpdatesInterval || 7;
    this.lastCheck = options.lastUpdateCheck || 0;
    this.currentVersion = options.currentVersion || null;
  }
  
  /**
   * Initialize mathlib - downloads or prepares it as needed
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.wasmMode) {
        return await this.initializeWasmMathlib();
      } else {
        return await this.checkLocalMathlib();
      }
    } catch (error) {
      console.error('Failed to initialize mathlib:', error);
      return false;
    }
  }
  
  /**
   * Initialize mathlib in WASM mode
   * Downloads and prepares mathlib WASM build
   */
  private async initializeWasmMathlib(): Promise<boolean> {
    // Check if we need to download mathlib
    const latestVersion = await this.getLatestMathlibVersion();
    
    if (!latestVersion) {
      console.error('Failed to get latest mathlib version');
      return false;
    }
    
    // If we already have this version loaded, we're done
    if (this.currentVersion === latestVersion.version && this.mathlibWasmData) {
      return true;
    }
    
    try {
      // Construct URL for the WASM-compatible mathlib build
      const mathlibUrl = `${MATHLIB_CDN_URL}${latestVersion.version}/lean4-wasm-bundle/mathlib.json`;
      
      // Download mathlib data
      const response = await request({ url: mathlibUrl });
      
      // Store mathlib data for use in the WASM environment
      this.mathlibWasmUrl = mathlibUrl;
      this.currentVersion = latestVersion.version;
      
      // Store stats
      this.mathlibStats = {
        version: latestVersion.version,
        installedDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        size: response.length
      };
      
      // Emit mathlib loaded event
      this.emit('mathlib-loaded', this.mathlibStats);
      
      return true;
    } catch (error) {
      console.error('Failed to download WASM mathlib:', error);
      return false;
    }
  }
  
  /**
   * Checks local mathlib installation
   * In local mode, we rely on the Lake package manager
   */
  private async checkLocalMathlib(): Promise<boolean> {
    // In local mode, mathlib is managed by Lake
    // We just return true and rely on Lake update checks
    return true;
  }
  
  /**
   * Get the latest version of mathlib from GitHub
   */
  async getLatestMathlibVersion(): Promise<MathlibVersion | null> {
    try {
      // Check GitHub for the latest release
      const response = await request({ url: MATHLIB_RELEASES_URL });
      const releases = JSON.parse(response);
      
      if (!releases || !releases.length) {
        return null;
      }
      
      // Get the latest release
      const latestRelease = releases[0];
      
      return {
        version: latestRelease.tag_name,
        releaseDate: latestRelease.published_at,
        downloadUrl: latestRelease.zipball_url,
        size: 0, // GitHub API doesn't provide direct size information
        compatibleLean: [] // Would need to parse release notes for this information
      };
    } catch (error) {
      console.error('Failed to get mathlib releases:', error);
      return null;
    }
  }
  
  /**
   * Check for mathlib updates
   */
  async checkUpdates(): Promise<{ hasUpdate: boolean, newVersion?: string }> {
    // Check if it's time to check for updates
    const now = Date.now();
    const daysSinceLastCheck = (now - this.lastCheck) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastCheck < this.checkInterval) {
      return { hasUpdate: false };
    }
    
    this.lastCheck = now;
    
    // Get the latest version from GitHub
    const latestVersion = await this.getLatestMathlibVersion();
    
    if (!latestVersion) {
      return { hasUpdate: false };
    }
    
    // Check if we have an update
    const hasUpdate = this.currentVersion !== latestVersion.version;
    
    return {
      hasUpdate,
      newVersion: latestVersion.version
    };
  }
  
  /**
   * Update mathlib to the latest version
   */
  async updateMathlib(): Promise<boolean> {
    if (this.wasmMode) {
      return await this.initializeWasmMathlib();
    } else {
      // In local mode, updating is handled by Lake
      // We just emit an event to trigger a Lake update
      this.emit('update-request');
      return true;
    }
  }
  
  /**
   * Get mathlib WASM data for embedding in Lean WASM environment
   */
  getMathlibWasmData(): { url: string | null, version: string | null } {
    return {
      url: this.mathlibWasmUrl,
      version: this.currentVersion
    };
  }
  
  /**
   * Get current mathlib stats
   */
  getMathlibStats(): MathlibStats | null {
    return this.mathlibStats;
  }
}
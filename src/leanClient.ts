import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { 
  LeanClientOptions, 
  LeanDiagnostic, 
  LeanGoal, 
  LeanHoverResult,
  LeanCompletionItem,
  TacticSuggestion,
  DebugSession,
  DebugVariable,
  DebugBreakpoint,
  MathlibStatus
} from './types/lean-types';
import { MathlibManager } from './modules/mathlib-manager';

export class LeanClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private worker: Worker | null = null;
  private useWasm: boolean;
  private leanPath: string | null;
  private messageId = 0;
  private pendingRequests: Map<number, (result: any) => void> = new Map();
  private activeDebugSession: string | null = null;
  private mathlibManager: MathlibManager | null = null;

  constructor(options: LeanClientOptions = {}) {
    super();
    this.useWasm = options.useWasm || false;
    this.leanPath = options.leanPath || null;
    
    // Initialize mathlib manager with the same options
    this.mathlibManager = new MathlibManager({
      wasmMode: this.useWasm,
      checkUpdatesInterval: options.checkUpdatesInterval || 7,
      lastUpdateCheck: options.lastUpdateCheck || 0,
      currentVersion: options.mathlibVersion
    });
    
    // Setup mathlib manager event handlers
    if (this.mathlibManager) {
      this.mathlibManager.on('mathlib-loaded', (stats) => {
        this.emit('mathlib-loaded', stats);
      });
      
      this.mathlibManager.on('update-request', () => {
        // Forward update request to the main plugin
        this.emit('mathlib-update-request');
      });
    }
  }

  async start(): Promise<boolean> {
    if (this.process || this.worker) {
      return true; // Already started
    }

    if (this.useWasm) {
      return this.startWasmClient();
    }
    
    return this.startNodeClient();
  }

  private async startNodeClient(): Promise<boolean> {
    let leanPath = this.leanPath;

    if (!leanPath) {
      // Try to find Lean in PATH
      leanPath = process.env.LEAN_PATH || 'lean';
    }

    try {
      this.process = spawn(leanPath, ['--server']);
      
      this.process.stdout?.on('data', (data) => {
        try {
          const messages = data.toString().split('\n').filter(Boolean);
          for (const message of messages) {
            const parsed = JSON.parse(message);
            this.handleServerMessage(parsed);
          }
        } catch (e) {
          console.error('Error parsing Lean server message:', e);
        }
      });

      this.process.stderr?.on('data', (data) => {
        console.error('Lean server error:', data.toString());
      });

      this.process.on('close', (code) => {
        console.log(`Lean server process exited with code ${code}`);
        this.process = null;
      });

      return true;
    } catch (e) {
      console.error('Failed to start Lean server:', e);
      return false;
    }
  }

  private async startWasmClient(): Promise<boolean> {
    try {
      // Create a Web Worker for the Lean Wasm client
      this.worker = new Worker(new URL('./lean-wasm-worker.js', import.meta.url), { type: 'module' });
      
      this.worker.onmessage = (event) => {
        this.handleServerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Lean Wasm worker error:', error);
      };

      // Initialize mathlib
      await this.mathlibManager?.initialize();
      const mathlibData = this.mathlibManager?.getMathlibWasmData() || { url: null, version: null };

      // Initialize the Wasm client with mathlib data
      this.sendToWorker({ 
        method: 'initialize',
        params: {
          mathlib: mathlibData
        }
      });
      
      return true;
    } catch (e) {
      console.error('Failed to start Lean Wasm client:', e);
      return false;
    }
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  async hover(uri: string, position: { line: number; character: number }): Promise<LeanHoverResult | null> {
    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'textDocument/hover',
      params: {
        textDocument: { uri },
        position,
      },
    };

    return this.sendRequest(request);
  }

  // Code completion support
  async getCompletions(uri: string, position: { line: number; character: number }): Promise<LeanCompletionItem[]> {
    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'textDocument/completion',
      params: {
        textDocument: { uri },
        position,
        context: {
          triggerKind: 1, // Invoked
        }
      },
    };

    const response = await this.sendRequest(request);
    return response?.items || [];
  }

  // Tactic search for advanced proof tools
  async searchTactics(uri: string, goal: string): Promise<TacticSuggestion[]> {
    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'lean/searchTactics',
      params: {
        textDocument: { uri },
        goal,
      },
    };

    return this.sendRequest(request) || [];
  }

  // Execute Lean code
  async evaluate(uri: string, code: string): Promise<string> {
    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'lean/eval',
      params: {
        textDocument: { uri },
        code,
      },
    };

    return this.sendRequest(request) || '';
  }

  // Debugging support
  async startDebugSession(uri: string): Promise<string> {
    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'lean/debug/start',
      params: {
        textDocument: { uri }
      },
    };

    const sessionId = await this.sendRequest(request);
    if (sessionId) {
      this.activeDebugSession = sessionId;
    }
    return sessionId;
  }

  async setBreakpoint(uri: string, line: number): Promise<DebugBreakpoint | null> {
    if (!this.activeDebugSession) return null;

    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'lean/debug/setBreakpoint',
      params: {
        sessionId: this.activeDebugSession,
        textDocument: { uri },
        line
      },
    };

    return this.sendRequest(request);
  }

  async continueExecution(): Promise<boolean> {
    if (!this.activeDebugSession) return false;

    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'lean/debug/continue',
      params: {
        sessionId: this.activeDebugSession
      },
    };

    return this.sendRequest(request);
  }

  async stepOver(): Promise<boolean> {
    if (!this.activeDebugSession) return false;

    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'lean/debug/stepOver',
      params: {
        sessionId: this.activeDebugSession
      },
    };

    return this.sendRequest(request);
  }

  async getVariables(): Promise<DebugVariable[]> {
    if (!this.activeDebugSession) return [];

    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'lean/debug/variables',
      params: {
        sessionId: this.activeDebugSession
      },
    };

    return this.sendRequest(request) || [];
  }

  async stopDebugSession(): Promise<boolean> {
    if (!this.activeDebugSession) return false;

    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'lean/debug/stop',
      params: {
        sessionId: this.activeDebugSession
      },
    };

    const result = await this.sendRequest(request);
    if (result) {
      this.activeDebugSession = null;
    }
    return result;
  }

  // Lake project management
  async checkLakeUpdates(projectPath: string): Promise<string[]> {
    if (this.useWasm) return []; // Not supported in WASM mode

    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'lean/lake/checkUpdates',
      params: {
        projectPath
      },
    };

    return this.sendRequest(request) || [];
  }

  async updateLakePackages(projectPath: string): Promise<boolean> {
    if (this.useWasm) return false; // Not supported in WASM mode

    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'lean/lake/update',
      params: {
        projectPath
      },
    };

    return this.sendRequest(request) || false;
  }

  private async sendRequest(request: any): Promise<any> {
    return new Promise((resolve) => {
      this.pendingRequests.set(request.id, resolve);
      
      if (this.process) {
        this.process.stdin?.write(JSON.stringify(request) + '\n');
      } else if (this.worker) {
        this.sendToWorker(request);
      } else {
        resolve(null);
      }
    });
  }

  private sendToWorker(message: any): void {
    if (this.worker) {
      this.worker.postMessage(message);
    }
  }

  // Mathlib-specific methods
  
  /**
   * Get the current mathlib status
   */
  async getMathlibStatus(): Promise<MathlibStatus | null> {
    if (!this.useWasm) {
      // For local mode, check if mathlib is in the lake-manifest.json
      return this.checkLocalMathlibStatus();
    }
    
    // For WASM mode, query the worker
    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'mathlib/status'
    };
    
    return this.sendRequest(request);
  }
  
  /**
   * Check if mathlib is available in local Lake setup
   */
  private async checkLocalMathlibStatus(): Promise<MathlibStatus | null> {
    // This is a simplified implementation - in practice you'd check
    // lake-manifest.json for mathlib entries and get version info
    return {
      loaded: false, // Placeholder - actual implementation would detect this
      version: null,
      url: null
    };
  }
  
  /**
   * Update mathlib to the latest version
   */
  async updateMathlib(): Promise<boolean> {
    if (!this.mathlibManager) {
      return false;
    }
    
    const updateResult = await this.mathlibManager.updateMathlib();
    
    // If in WASM mode, we need to update the worker as well
    if (updateResult && this.useWasm && this.worker) {
      const mathlibData = this.mathlibManager.getMathlibWasmData();
      
      const request = {
        jsonrpc: '2.0',
        id: this.messageId++,
        method: 'mathlib/update',
        params: mathlibData
      };
      
      const result = await this.sendRequest(request);
      return result?.success || false;
    }
    
    return updateResult;
  }
  
  /**
   * Check for mathlib updates
   */
  async checkMathlibUpdates(): Promise<{ hasUpdate: boolean, newVersion?: string }> {
    if (!this.mathlibManager) {
      return { hasUpdate: false };
    }
    
    return this.mathlibManager.checkUpdates();
  }
  
  /**
   * Add mathlib import to a file
   */
  async addMathlibImport(uri: string): Promise<boolean> {
    if (!this.useWasm || !this.worker) {
      // In local mode, this is a manual edit
      return false;
    }
    
    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'mathlib/importToFile',
      params: { uri }
    };
    
    const result = await this.sendRequest(request);
    return result?.success || false;
  }

  private handleServerMessage(message: any): void {
    // Handle response to a pending request
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const resolve = this.pendingRequests.get(message.id);
      if (resolve) {
        resolve(message.result);
        this.pendingRequests.delete(message.id);
      }
      return;
    }

    // Handle notifications
    if (message.method === 'textDocument/publishDiagnostics') {
      this.emit('diagnostics', message.params.diagnostics as LeanDiagnostic[]);
    } else if (message.method === 'lean/goals') {
      this.emit('goals', message.params.goals as LeanGoal[]);
    } else if (message.method === 'lean/debug/stopped') {
      this.emit('debug/stopped', message.params);
    } else if (message.method === 'lean/debug/continued') {
      this.emit('debug/continued', message.params);
    } else if (message.method === 'mathlib-loaded') {
      this.emit('mathlib-loaded', message.params);
    }
  }

  on(event: 'diagnostics', listener: (diagnostics: LeanDiagnostic[]) => void): this;
  on(event: 'goals', listener: (goals: LeanGoal[]) => void): this;
  on(event: 'debug/stopped', listener: (params: any) => void): this;
  on(event: 'debug/continued', listener: (params: any) => void): this;
  on(event: 'mathlib-loaded', listener: (params: any) => void): this;
  on(event: 'mathlib-update-request', listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}

export default LeanClient;
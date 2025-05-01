import {
  App,
  Editor,
  MarkdownView,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
  addIcon,
  TFile,
  EditorPosition,
  Notice,
  request,
  ItemView
} from 'obsidian';
import { render } from 'preact';
import { LeanClient } from './leanClient';
import { GoalPanel, useGoalStore } from './components/GoalPanel';
import { LeanInterpreter } from './components/LeanInterpreter';
import { LeanDebugger } from './components/LeanDebugger';
import { LeanDiagnostic, LeanGoal } from './types/lean-types';
import { MathlibManager } from './modules/mathlib-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

// Define view type identifiers
const LEAN_GOALS_VIEW = 'LEAN_GOALS_VIEW';
const LEAN_INTERPRETER_VIEW = 'LEAN_INTERPRETER_VIEW';
const LEAN_DEBUGGER_VIEW = 'LEAN_DEBUGGER_VIEW';

// Define plugin settings
interface LeanPluginSettings {
  leanPath: string;
  useWasm: boolean;
  defaultLeanToolchain: string;
  autoCheckUpdates: boolean;
  checkUpdatesInterval: number; // in days
  lastUpdateCheck: number; // timestamp
  codeCompletionEnabled: boolean;
  syntaxHighlightingEnabled: boolean;
  editorIntegration: 'basic' | 'advanced';
  // Mathlib settings
  enableMathlib: boolean;
  mathlibAutoUpdates: boolean;
  mathlibVersion: string;
  mathlibLastUpdateCheck: number;
}

// Default settings
const DEFAULT_SETTINGS: LeanPluginSettings = {
  leanPath: '',
  useWasm: false,
  defaultLeanToolchain: 'leanprover/lean4:stable',
  autoCheckUpdates: true,
  checkUpdatesInterval: 7, // check weekly
  lastUpdateCheck: 0,
  codeCompletionEnabled: true,
  syntaxHighlightingEnabled: true,
  editorIntegration: 'advanced',
  // Mathlib defaults
  enableMathlib: true,
  mathlibAutoUpdates: true,
  mathlibVersion: '',
  mathlibLastUpdateCheck: 0
};

// Icons
const LEAN_ICON = `<svg viewBox="0 0 100 100" width="100" height="100">
  <rect x="20" y="20" width="60" height="60" stroke="currentColor" fill="none" stroke-width="5" />
  <path d="M30 50 L70 50 M50 30 L50 70" stroke="currentColor" stroke-width="5" />
</svg>`;

const INTERPRETER_ICON = `<svg viewBox="0 0 100 100" width="100" height="100">
  <rect x="15" y="15" width="70" height="70" stroke="currentColor" fill="none" stroke-width="5" rx="10" ry="10" />
  <path d="M30 30 L70 30 M30 50 L60 50 M30 70 L50 70" stroke="currentColor" stroke-width="5" />
</svg>`;

const DEBUGGER_ICON = `<svg viewBox="0 0 100 100" width="100" height="100">
  <rect x="15" y="15" width="70" height="70" stroke="currentColor" fill="none" stroke-width="5" rx="5" ry="5" />
  <circle cx="35" cy="35" r="8" fill="currentColor" />
  <circle cx="65" cy="35" r="8" fill="currentColor" />
  <path d="M35 65 L65 65" stroke="currentColor" stroke-width="5" />
</svg>`;

// Goal View class for the side panel
class LeanGoalView extends ItemView {
  private root: any;
  private plugin: LeanPlugin;
  
  constructor(leaf: WorkspaceLeaf, plugin: LeanPlugin) {
    super(leaf);
    this.plugin = plugin;
  }
  
  getViewType(): string {
    return LEAN_GOALS_VIEW;
  }

  getDisplayText(): string {
    return 'Lean Goals';
  }

  getIcon(): string {
    return 'calculator';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('lean-goals-container');

    // Render the component with Preact
    render(
      GoalPanel({
        onGoalClick: (goal: LeanGoal) => {
          // Navigate to the goal in the editor
          this.navigateToGoal(goal);
        },
        leanClient: this.plugin.leanClient,
        onApplyTactic: (tactic: string, goal: LeanGoal) => {
          // Apply the tactic at the goal position
          this.applyTactic(tactic, goal);
        }
      }),
      container
    );
    
    // Store container for cleanup
    this.root = container;
  }

  async onClose(): Promise<void> {
    if (this.root) {
      render(null, this.root);
    }
  }
  
  private navigateToGoal(goal: LeanGoal): void {
    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
      const editor = activeLeaf.view.editor;
      
      // Convert from uri to file path
      const filePath = goal.uri.replace('file://', '');
      const file = this.app.vault.getAbstractFileByPath(filePath);
      
      if (file) {
        // Open the file and go to position
        this.app.workspace.openLinkText(file.path, '', true);
        
        // Set the cursor to the goal position
        editor.setCursor({
          line: goal.range.start.line,
          ch: goal.range.start.character,
        });
        
        // Focus the editor
        editor.focus();
      }
    }
  }
  
  private async applyTactic(tactic: string, goal: LeanGoal): Promise<void> {
    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
      const editor = activeLeaf.view.editor;
      
      // Convert from uri to file path
      const filePath = goal.uri.replace('file://', '');
      const file = this.app.vault.getAbstractFileByPath(filePath);
      
      if (file && file instanceof TFile) {
        // Open the file
        await this.app.workspace.openLinkText(file.path, '', true);
        
        // Get cursor position at the goal
        const pos: EditorPosition = {
          line: goal.range.start.line,
          ch: goal.range.start.character,
        };
        
        // Insert the tactic at the position
        editor.setCursor(pos);
        editor.replaceRange(
          tactic, 
          pos,
          pos
        );
        
        // Focus the editor
        editor.focus();
        
        // Show a notification
        new Notice(`Applied tactic: ${tactic}`);
      }
    }
  }
}

// Interpreter View class
class LeanInterpreterView extends ItemView {
  private root: any;
  private plugin: LeanPlugin;
  
  constructor(leaf: WorkspaceLeaf, plugin: LeanPlugin) {
    super(leaf);
    this.plugin = plugin;
  }
  
  getViewType(): string {
    return LEAN_INTERPRETER_VIEW;
  }

  getDisplayText(): string {
    return 'Lean Interpreter';
  }

  getIcon(): string {
    return 'terminal-square';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('lean-interpreter-container');
    
    // Get the active file path
    const activeFile = this.app.workspace.getActiveFile();
    const filePath = activeFile ? activeFile.path : '';
    
    // Render the component
    render(
      LeanInterpreter({
        leanClient: this.plugin.leanClient,
        currentFile: filePath
      }),
      container
    );
    
    // Store container for cleanup
    this.root = container;
  }

  async onClose(): Promise<void> {
    if (this.root) {
      render(null, this.root);
    }
  }
}

// Debugger View class
class LeanDebuggerView extends ItemView {
  private root: any;
  private plugin: LeanPlugin;
  
  constructor(leaf: WorkspaceLeaf, plugin: LeanPlugin) {
    super(leaf);
    this.plugin = plugin;
  }
  
  getViewType(): string {
    return LEAN_DEBUGGER_VIEW;
  }

  getDisplayText(): string {
    return 'Lean Debugger';
  }

  getIcon(): string {
    return 'bug';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('lean-debugger-container');
    
    // Get the active file path
    const activeFile = this.app.workspace.getActiveFile();
    const filePath = activeFile ? activeFile.path : '';
    
    // Render the component
    render(
      LeanDebugger({
        leanClient: this.plugin.leanClient,
        currentFile: filePath,
        onSetBreakpoint: (line: number) => {
          // Highlight the breakpoint in the editor
          this.highlightBreakpoint(filePath, line);
        }
      }),
      container
    );
    
    // Store container for cleanup
    this.root = container;
  }

  async onClose(): Promise<void> {
    if (this.root) {
      render(null, this.root);
    }
  }
  
  private highlightBreakpoint(filePath: string, line: number): void {
    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
      const editor = activeLeaf.view.editor;
      const file = this.app.vault.getAbstractFileByPath(filePath);
      
      if (file) {
        // Open the file if it's not already open
        this.app.workspace.openLinkText(file.path, '', true);
        
        // Add a visual marker for the breakpoint
        editor.addLineClass(line, 'background', 'lean-debug-breakpoint');
      }
    }
  }
}

export default class LeanPlugin extends Plugin {
  settings: LeanPluginSettings;
  leanClient: LeanClient | null = null;
  mathlibManager: MathlibManager | null = null;
  private lastLakeUpdate: number = 0;
  
  // Register views
  registerViews() {
    // Register goal view
    this.registerView(
      LEAN_GOALS_VIEW,
      (leaf) => new LeanGoalView(leaf, this)
    );
    
    // Register interpreter view
    this.registerView(
      LEAN_INTERPRETER_VIEW,
      (leaf) => new LeanInterpreterView(leaf, this)
    );
    
    // Register debugger view
    this.registerView(
      LEAN_DEBUGGER_VIEW,
      (leaf) => new LeanDebuggerView(leaf, this)
    );
    
    // Add icons
    addIcon('lean', LEAN_ICON);
    addIcon('lean-interpreter', INTERPRETER_ICON);
    addIcon('lean-debugger', DEBUGGER_ICON);
  }

  // Initialize Lean client
  async initLeanClient() {
    if (this.leanClient) {
      this.leanClient.stop();
    }
    
    this.leanClient = new LeanClient({
      leanPath: this.settings.leanPath || undefined,
      useWasm: this.settings.useWasm,
      checkUpdatesInterval: this.settings.checkUpdatesInterval,
      lastUpdateCheck: this.settings.mathlibLastUpdateCheck,
      mathlibVersion: this.settings.mathlibVersion,
    });
    
    // Set up event handlers
    this.leanClient.on('diagnostics', (diagnostics: LeanDiagnostic[]) => {
      this.handleDiagnostics(diagnostics);
    });
    
    this.leanClient.on('goals', (goals: LeanGoal[]) => {
      this.handleGoals(goals);
    });
    
    // Handle mathlib events
    this.leanClient.on('mathlib-loaded', (stats) => {
      new Notice(`Mathlib loaded: ${stats.version}`);
      this.settings.mathlibVersion = stats.version;
      this.saveSettings();
    });
    
    this.leanClient.on('mathlib-update-request', () => {
      this.checkMathlibUpdates();
    });
    
    // Mathlib event handlers
    this.leanClient.on('mathlib-loaded', (params) => {
      if (params && params.success) {
        new Notice(`Mathlib ${params.version} loaded successfully`);
        // Update the stored version
        this.settings.mathlibVersion = params.version;
        this.saveSettings();
      } else if (params) {
        console.error('Failed to load mathlib:', params.error);
        if (this.settings.useWasm) {
          new Notice('Failed to load mathlib. Some features may be limited.');
        }
      }
    });
    
    this.leanClient.on('mathlib-update-request', () => {
      // This is triggered when mathlib needs updating in local mode
      this.checkMathlibUpdates();
    });
    
    // Start the client
    const success = await this.leanClient.start();
    if (!success) {
      console.error('Failed to start Lean client');
      new Notice('Failed to start Lean client. Check settings and Lean installation.');
    }
  }

  // Handle diagnostics (errors/warnings) from Lean
  handleDiagnostics(diagnostics: LeanDiagnostic[]) {
    // Find the active editor
    const activeLeaf = this.app.workspace.activeLeaf;
    if (!activeLeaf || !(activeLeaf.view instanceof MarkdownView)) {
      return;
    }
    
    const editor = activeLeaf.view.editor;
    
    // Clear existing markers
    editor.getAllMarks().forEach((mark) => {
      if (mark.className.includes('lean-error')) {
        mark.clear();
      }
    });
    
    // Add new markers
    for (const diagnostic of diagnostics) {
      const { start, end } = diagnostic.range;
      
      editor.markText(
        { line: start.line, ch: start.character },
        { line: end.line, ch: end.character },
        {
          className: `lean-error lean-error-${diagnostic.severity}`,
          attributes: { title: diagnostic.message },
        }
      );
    }
  }

  // Handle goals from Lean
  handleGoals(goals: LeanGoal[]) {
    // Update the goal store
    useGoalStore.setState({ goals });
    
    // Open the goal view if there are goals and it's not already open
    if (goals.length > 0 && !this.app.workspace.getLeavesOfType(LEAN_GOALS_VIEW).length) {
      this.activateGoalView();
    }
  }

  // Open the goal view 
  activateGoalView() {
    this.app.workspace.getRightLeaf(false).setViewState({
      type: LEAN_GOALS_VIEW,
      active: true,
    });
  }
  
  // Open the interpreter view
  activateInterpreterView() {
    this.app.workspace.getRightLeaf(false).setViewState({
      type: LEAN_INTERPRETER_VIEW,
      active: true,
    });
  }
  
  // Open the debugger view
  activateDebuggerView() {
    this.app.workspace.getRightLeaf(false).setViewState({
      type: LEAN_DEBUGGER_VIEW,
      active: true,
    });
  }

  // Bootstrap a Lean project
  async bootstrapLeanProject() {
    // Get vault path
    const vaultPath = this.app.vault.adapter.basePath;
    
    try {
      // Create lean-toolchain file
      const toolchainContent = `${this.settings.defaultLeanToolchain}`;
      await this.app.vault.create('lean-toolchain', toolchainContent);
      
      // Create basic lakefile.lean
      const lakefileContent = `import Lake
open Lake DSL

package myProject where
  -- add package configuration options here

lean_lib MyProject where
  -- add library configuration options here
`;
      await this.app.vault.create('lakefile.lean', lakefileContent);
      
      // Create lake-manifest.json
      const manifestContent = `{
  "packagesDir": "lake-packages",
  "manifestFile": "lake-manifest.json",
  "packages": []
}`;
      await this.app.vault.create('lake-manifest.json', manifestContent);
      
      // Check if lake is available and run lake init (requires the child_process module)
      if (child_process) {
        try {
          child_process.execSync('lake --version', { cwd: vaultPath });
          
          // Ask user if they want to run lake init or lake new
          const lakeCommand = await this.promptLakeCommand();
          
          if (lakeCommand) {
            child_process.execSync(lakeCommand, { cwd: vaultPath });
          }
        } catch (e) {
          console.log('Lake command not available, skipping lake initialization');
        }
      }
      
      // Notify success
      new Notice('Lean project initialized successfully');
    } catch (error) {
      console.error('Error bootstrapping Lean project:', error);
      new Notice('Error initializing Lean project');
    }
  }

  // Prompt user for lake command
  async promptLakeCommand(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = this.app.modal;
      const div = document.createElement('div');
      div.innerHTML = `
        <h2>Lake Initialization</h2>
        <p>Choose a Lake command to run:</p>
        <button id="lake-init">lake init</button>
        <button id="lake-new">lake new</button>
        <button id="lake-skip">Skip</button>
      `;
      
      // Set up event handlers
      div.querySelector('#lake-init')?.addEventListener('click', () => {
        modal.close();
        resolve('lake init');
      });
      
      div.querySelector('#lake-new')?.addEventListener('click', () => {
        modal.close();
        resolve('lake new');
      });
      
      div.querySelector('#lake-skip')?.addEventListener('click', () => {
        modal.close();
        resolve(null);
      });
      
      // Show the modal
      modal.open({ contentEl: div });
    });
  }

  // Lake package management
  setupLakeWatcher() {
    // Check for updates on load if needed
    this.checkInitialUpdates();
    
    // Setup watchers based on mode
    if (this.settings.useWasm) {
      // In WASM mode, we only check for mathlib updates
      if (this.settings.enableMathlib && this.settings.mathlibAutoUpdates) {
        this.setupMathlibWatcher();
      }
    } else if (this.settings.autoCheckUpdates) {
      // In local mode, watch lake-manifest.json
      this.setupLocalWatcher();
    }
  }
  
  // Check for initial updates on plugin load
  private async checkInitialUpdates() {
    const now = Date.now();
    
    // Check Lake updates if needed
    if (!this.settings.useWasm && this.settings.autoCheckUpdates) {
      const daysSinceLastLakeCheck = (now - this.settings.lastUpdateCheck) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastLakeCheck >= this.settings.checkUpdatesInterval) {
        this.checkLakeUpdates();
        this.settings.lastUpdateCheck = now;
        this.saveSettings();
      }
    }
    
    // Check mathlib updates if needed
    if (this.settings.enableMathlib && this.settings.mathlibAutoUpdates) {
      const daysSinceLastMathlibCheck = (now - this.settings.mathlibLastUpdateCheck) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastMathlibCheck >= this.settings.checkUpdatesInterval) {
        this.checkMathlibUpdates();
        this.settings.mathlibLastUpdateCheck = now;
        this.saveSettings();
      }
    }
  }
  
  // Setup watcher for mathlib in WASM mode
  private setupMathlibWatcher() {
    // Schedule periodic mathlib update checks
    this.registerInterval(
      window.setInterval(() => {
        // Check if it's time for an update
        const now = Date.now();
        const daysSinceLastCheck = (now - this.settings.mathlibLastUpdateCheck) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastCheck >= this.settings.checkUpdatesInterval) {
          this.checkMathlibUpdates();
        }
      }, 24 * 60 * 60 * 1000) // Check daily
    );
  }
  
  // Setup watcher for local Lake setup
  private setupLocalWatcher() {
    // Schedule periodic checks for lake-manifest.json changes
    this.registerInterval(
      window.setInterval(() => {
        const vaultPath = this.app.vault.adapter.basePath;
        const lakePath = path.join(vaultPath, 'lake-manifest.json');
        
        if (fs.existsSync(lakePath)) {
          try {
            const stats = fs.statSync(lakePath);
            const lastModified = stats.mtime.getTime();
            
            if (this.lastLakeUpdate && lastModified > this.lastLakeUpdate) {
              // Lake manifest has changed, check for updates
              this.checkLakeUpdates();
            }
            
            this.lastLakeUpdate = lastModified;
          } catch (e) {
            console.error('Error checking lake manifest:', e);
          }
        }
      }, 60000) // Check every minute
    );
  }

  async checkLakeUpdates() {
    if (this.settings.useWasm) return; // Not supported in WASM mode
    
    const vaultPath = this.app.vault.adapter.basePath;
    
    try {
      if (this.leanClient) {
        // Check for available updates
        const updates = await this.leanClient.checkLakeUpdates(vaultPath);
        
        if (updates && updates.length > 0) {
          // Check if mathlib is among the updates
          const mathlibUpdate = updates.find(update => update.includes('mathlib'));
          
          // Show notification to user
          const shouldUpdate = await this.promptLakeUpdate(updates);
          
          if (shouldUpdate) {
            // Update packages
            const success = await this.leanClient.updateLakePackages(vaultPath);
            
            if (success) {
              new Notice('Lake packages updated successfully');
              
              // If mathlib was updated, update our tracking
              if (mathlibUpdate) {
                this.settings.mathlibLastUpdateCheck = Date.now();
                this.saveSettings();
              }
            } else {
              new Notice('Failed to update Lake packages');
            }
          }
        }
      }
    } catch (e) {
      console.error('Error checking for Lake updates:', e);
    }
  }
  
  // Method specifically for checking mathlib updates
  async checkMathlibUpdates() {
    if (!this.settings.enableMathlib) return;
    
    try {
      if (this.leanClient) {
        // Check for mathlib updates
        const updateInfo = await this.leanClient.checkMathlibUpdates();
        this.settings.mathlibLastUpdateCheck = Date.now();
        this.saveSettings();
        
        if (updateInfo && updateInfo.hasUpdate) {
          // Prompt user about the update
          const shouldUpdate = await this.promptMathlibUpdate(updateInfo.newVersion);
          
          if (shouldUpdate) {
            // Apply the update
            const success = await this.leanClient.updateMathlib();
            
            if (success) {
              new Notice(`Mathlib updated to ${updateInfo.newVersion}`);
              this.settings.mathlibVersion = updateInfo.newVersion || '';
              this.saveSettings();
            } else {
              new Notice('Failed to update mathlib');
            }
          }
        }
      }
    } catch (e) {
      console.error('Error checking for mathlib updates:', e);
    }
  }
  
  // Prompt user about mathlib update
  async promptMathlibUpdate(version?: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = this.app.modal;
      const div = document.createElement('div');
      div.innerHTML = `
        <h2>Mathlib Update Available</h2>
        ${version ? `<p>New version: ${version}</p>` : ''}
        <p>Do you want to update mathlib now?</p>
        <div class="lean-update-buttons">
          <button id="mathlib-update-yes" class="mod-cta">Yes</button>
          <button id="mathlib-update-no">No</button>
        </div>
      `;
      
      div.querySelector('#mathlib-update-yes')?.addEventListener('click', () => {
        modal.close();
        resolve(true);
      });
      
      div.querySelector('#mathlib-update-no')?.addEventListener('click', () => {
        modal.close();
        resolve(false);
      });
      
      modal.open({ contentEl: div });
    });
  }

  async promptLakeUpdate(updates: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = this.app.modal;
      const div = document.createElement('div');
      
      div.innerHTML = `
        <h2>Lake Updates Available</h2>
        <div class="lean-update-list">
          <ul>
            ${updates.map(update => `<li>${update}</li>`).join('')}
          </ul>
        </div>
        <p>Do you want to update now?</p>
        <div class="lean-update-buttons">
          <button id="lake-update-yes" class="mod-cta">Yes</button>
          <button id="lake-update-no">No</button>
        </div>
      `;
      
      div.querySelector('#lake-update-yes')?.addEventListener('click', () => {
        modal.close();
        resolve(true);
      });
      
      div.querySelector('#lake-update-no')?.addEventListener('click', () => {
        modal.close();
        resolve(false);
      });
      
      modal.open({ contentEl: div });
    });
  }

  // Install CodeMirror mode for Lean syntax highlighting
  setupCodeMirrorIntegration() {
    if (!this.settings.syntaxHighlightingEnabled) return;
    
    // Register CodeMirror mode for Lean syntax highlighting
    this.registerEditorExtension([
      this.setupSyntaxHighlighting(),
      this.setupCodeCompletion()
    ]);
  }
  
  // Setup syntax highlighting for CodeMirror
  private setupSyntaxHighlighting() {
    return (editor: any) => {
      // Define token patterns for Lean syntax
      const keywords = /theorem|lemma|def|structure|inductive|class|instance|mutual|where|namespace|section|open|import|syntax|macro|example|match|let|in|if|then|else|have|show|suffices|from|with|calc|by|begin|end/;
      
      const operators = /:\s|:=|\.\d*|-\/|\/\-|→|←|→\/|∀|≠|≤|≥|∧|∨|¬|×|⊕|⊗|⊢|⊥|⊤/;
      
      const identifiers = /[a-zA-Z_][a-zA-Z0-9_']*/;
      
      // Highlight Lean code blocks
      editor.on('renderLine', (cm: any, line: any, el: HTMLElement) => {
        // Check if we're in a Lean code block
        const lineText = line.text;
        if (!lineText.includes('```lean') && !lineText.includes('```')) return;
        
        // Tokenize the line
        let tokens = lineText.split(/(\s+|[.,(){}[\]:;]|:=|\.\d*|->|<-|=>|\/\-|-\/)/g);
        
        tokens.forEach((token) => {
          if (!token.trim()) return;
          
          let className = '';
          
          if (keywords.test(token)) {
            className = 'token lean-keyword';
          } else if (operators.test(token)) {
            className = 'token lean-operator';
          } else if (/^\d+(\.\d+)?$/.test(token)) {
            className = 'token lean-number';
          } else if (identifiers.test(token) && /^[A-Z]/.test(token)) {
            className = 'token lean-type';
          } else if (identifiers.test(token)) {
            className = 'token lean-identifier';
          }
          
          if (className) {
            const tokenEl = document.createElement('span');
            tokenEl.className = className;
            tokenEl.textContent = token;
            el.appendChild(tokenEl);
          }
        });
      });
    };
  }
  
  // Setup code completion for CodeMirror
  private setupCodeCompletion() {
    if (!this.settings.codeCompletionEnabled) return;
    
    return (editor: any) => {
      // Trigger completion on key events
      editor.on('keyup', async (cm: any, event: KeyboardEvent) => {
        // Trigger on specific keys
        if (event.key === '.' || 
            event.key === ' ' || 
            (event.ctrlKey && event.key === 'Space')) {
          
          const cursor = cm.getCursor();
          const activeFile = this.app.workspace.getActiveFile();
          
          if (activeFile && this.leanClient) {
            const uri = `file://${activeFile.path}`;
            
            // Get completions from Lean server
            const completions = await this.leanClient.getCompletions(uri, {
              line: cursor.line,
              character: cursor.ch
            });
            
            if (completions && completions.length > 0) {
              // Show completions popup
              cm.showHint({
                completeSingle: false,
                hint: () => {
                  return {
                    from: cursor,
                    to: cursor,
                    list: completions.map((item) => ({
                      text: item.insertText || item.label,
                      displayText: item.label,
                      className: 'lean-completion-item',
                      info: item.documentation || item.detail
                    }))
                  };
                }
              });
            }
          }
        }
      });
    };
  }

  async onload() {
    await this.loadSettings();
    
    // Register views
    this.registerViews();
    
    // Initialize Lean client
    await this.initLeanClient();
    
    // Initialize Mathlib manager
    this.mathlibManager = new MathlibManager({
      enabled: this.settings.enableMathlib,
      autoUpdate: this.settings.mathlibAutoUpdates,
      checkInterval: this.settings.checkUpdatesInterval,
      lastCheck: this.settings.mathlibLastUpdateCheck,
      preferredVersion: this.settings.mathlibVersion || 'latest',
      customPath: ''
    }, this.settings.useWasm, this.app.vault.adapter.basePath);
    
    await this.mathlibManager.initialize();
    
    // Register command to open goal view
    this.addCommand({
      id: 'open-lean-goals',
      name: 'Open Lean Goals View',
      callback: () => this.activateGoalView(),
    });
    
    // Register command to open interpreter view
    this.addCommand({
      id: 'open-lean-interpreter',
      name: 'Open Lean Interpreter',
      callback: () => this.activateInterpreterView(),
    });
    
    // Register command to open debugger view
    this.addCommand({
      id: 'open-lean-debugger',
      name: 'Open Lean Debugger',
      callback: () => this.activateDebuggerView(),
    });
    
    // Register command to bootstrap a Lean project
    this.addCommand({
      id: 'init-lean-project',
      name: 'Initialize Lean Project',
      callback: () => this.bootstrapLeanProject(),
    });
    
    // Register command to check for Lake updates
    this.addCommand({
      id: 'check-lean-updates',
      name: 'Check for Lean Package Updates',
      callback: () => this.checkLakeUpdates(),
    });
    
    // Register command to check for mathlib updates
    this.addCommand({
      id: 'check-mathlib-updates',
      name: 'Check for Mathlib Updates',
      callback: () => this.checkMathlibUpdates(),
    });
    
    // Register command to add mathlib import to current file
    this.addCommand({
      id: 'add-mathlib-import',
      name: 'Add Mathlib Import to Current File',
      callback: () => this.addMathlibImportToCurrentFile(),
    });
    
    // Register command to initialize a Lean project with mathlib
    this.addCommand({
      id: 'init-mathlib-project',
      name: 'Initialize Lean Project with Mathlib',
      callback: () => this.bootstrapMathlibProject(),
    });
    
    // Register mathlib-specific commands
    this.addCommand({
      id: 'check-mathlib-updates',
      name: 'Check for Mathlib Updates',
      callback: () => this.checkMathlibUpdates(),
    });
    
    // Command to add mathlib import to current file
    this.addCommand({
      id: 'add-mathlib-import',
      name: 'Add Mathlib Import to Current File',
      editorCallback: async (editor) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && this.leanClient) {
          const uri = `file://${activeFile.path}`;
          await this.leanClient.addMathlibImport(uri);
          new Notice('Mathlib import added');
        }
      }
    });
    
    // Set up code editor integration
    this.setupCodeMirrorIntegration();
    
    // Set up Lake watcher
    this.setupLakeWatcher();
    
    // Add settings tab
    this.addSettingTab(new LeanSettingTab(this.app, this));
    
    // Add ribbon icons
    this.addRibbonIcon('calculator', 'Lean Goals', () => {
      this.activateGoalView();
    });
  }

  onunload() {
    // Stop the Lean client
    if (this.leanClient) {
      this.leanClient.stop();
      this.leanClient = null;
    }
    
    // Clear any UI elements
    this.app.workspace.detachLeavesOfType(LEAN_GOALS_VIEW);
    this.app.workspace.detachLeavesOfType(LEAN_INTERPRETER_VIEW);
    this.app.workspace.detachLeavesOfType(LEAN_DEBUGGER_VIEW);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
  
  
  /**
   * Add mathlib import to current file
   */
  async addMathlibImportToCurrentFile() {
    if (!this.mathlibManager) return;
    
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file');
      return;
    }
    
    const filePath = activeFile.path;
    if (!filePath.endsWith('.lean')) {
      new Notice('Not a Lean file');
      return;
    }
    
    const absolutePath = path.join(this.app.vault.adapter.basePath, filePath);
    
    try {
      const success = this.mathlibManager.addMathlibImport(absolutePath);
      if (success) {
        new Notice('Mathlib import added successfully');
        
        // Reload the file in the editor
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
          const editor = activeLeaf.view.editor;
          const content = fs.readFileSync(absolutePath, 'utf8');
          editor.setValue(content);
        }
      } else {
        new Notice('Mathlib import already exists or file not found');
      }
    } catch (e) {
      console.error('Error adding mathlib import:', e);
      new Notice('Error adding mathlib import');
    }
  }
  
  /**
   * Bootstrap a Lean project with mathlib
   */
  async bootstrapMathlibProject() {
    // First create a regular Lean project
    await this.bootstrapLeanProject();
    
    // Then add mathlib support
    const vaultPath = this.app.vault.adapter.basePath;
    
    try {
      // Check if lake is available
      if (child_process) {
        try {
          child_process.execSync('lake --version', { cwd: vaultPath });
          
          // Add mathlib as a dependency
          new Notice('Adding mathlib as a dependency...');
          child_process.execSync('lake add mathlib', { cwd: vaultPath });
          
          // Update Lake packages to download mathlib
          child_process.execSync('lake update', { cwd: vaultPath });
          
          new Notice('Mathlib added successfully');
        } catch (e) {
          console.error('Error adding mathlib:', e);
          new Notice('Error adding mathlib. Is Lake installed?');
        }
      }
    } catch (error) {
      console.error('Error bootstrapping mathlib project:', error);
      new Notice('Error initializing mathlib project');
    }
  }
}

// Settings tab for the plugin
class LeanSettingTab extends PluginSettingTab {
  plugin: LeanPlugin;

  constructor(app: App, plugin: LeanPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Lean Integration Settings' });

    // Lean Path
    new Setting(containerEl)
      .setName('Lean Path')
      .setDesc('Path to the Lean executable. Leave empty to use from PATH or environment variables.')
      .addText((text) =>
        text
          .setPlaceholder('e.g., /usr/local/bin/lean')
          .setValue(this.plugin.settings.leanPath)
          .onChange(async (value) => {
            this.plugin.settings.leanPath = value;
            await this.plugin.saveSettings();
            // Restart Lean client with new settings
            await this.plugin.initLeanClient();
          })
      );

    // WebAssembly Mode
    new Setting(containerEl)
      .setName('Use WebAssembly Fallback')
      .setDesc('Use WebAssembly version of Lean when native binary is not available. Provides reduced functionality.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useWasm)
          .onChange(async (value) => {
            this.plugin.settings.useWasm = value;
            await this.plugin.saveSettings();
            // Restart Lean client with new settings
            await this.plugin.initLeanClient();
          })
      );

    // Default Toolchain
    new Setting(containerEl)
      .setName('Default Lean Toolchain')
      .setDesc('Default toolchain to use when initializing a new Lean project.')
      .addText((text) =>
        text
          .setPlaceholder('leanprover/lean4:stable')
          .setValue(this.plugin.settings.defaultLeanToolchain)
          .onChange(async (value) => {
            this.plugin.settings.defaultLeanToolchain = value;
            await this.plugin.saveSettings();
          })
      );

    // Editor Features Heading
    containerEl.createEl('h3', { text: 'Editor Features' });
    
    // Syntax Highlighting
    new Setting(containerEl)
      .setName('Syntax Highlighting')
      .setDesc('Enable syntax highlighting for Lean code blocks.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syntaxHighlightingEnabled)
          .onChange(async (value) => {
            this.plugin.settings.syntaxHighlightingEnabled = value;
            await this.plugin.saveSettings();
            // Reload is required for this to take effect
            new Notice('Please reload Obsidian for this change to take effect.');
          })
      );
    
    // Code Completion
    new Setting(containerEl)
      .setName('Code Completion')
      .setDesc('Enable code completion for Lean code blocks.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.codeCompletionEnabled)
          .onChange(async (value) => {
            this.plugin.settings.codeCompletionEnabled = value;
            await this.plugin.saveSettings();
            // Reload is required for this to take effect
            new Notice('Please reload Obsidian for this change to take effect.');
          })
      );
      
    // Editor Integration Level
    new Setting(containerEl)
      .setName('Editor Integration')
      .setDesc('Level of integration with the Obsidian editor.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('basic', 'Basic')
          .addOption('advanced', 'Advanced')
          .setValue(this.plugin.settings.editorIntegration)
          .onChange(async (value: 'basic' | 'advanced') => {
            this.plugin.settings.editorIntegration = value;
            await this.plugin.saveSettings();
            // Reload is required for this to take effect
            new Notice('Please reload Obsidian for this change to take effect.');
          })
      );
    
    // Package Management Heading
    containerEl.createEl('h3', { text: 'Package Management' });
    
    // Auto-Check Updates
    new Setting(containerEl)
      .setName('Auto-Check Updates')
      .setDesc('Automatically check for updates to Lean packages.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoCheckUpdates)
          .onChange(async (value) => {
            this.plugin.settings.autoCheckUpdates = value;
            await this.plugin.saveSettings();
          })
      );
    
    // Check Interval
    new Setting(containerEl)
      .setName('Update Check Interval')
      .setDesc('Days between automatic update checks (1-30).')
      .addSlider((slider) =>
        slider
          .setLimits(1, 30, 1)
          .setValue(this.plugin.settings.checkUpdatesInterval)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.checkUpdatesInterval = value;
            await this.plugin.saveSettings();
          })
      );
      
    // Mathlib Heading
    containerEl.createEl('h3', { text: 'Mathlib Integration' });
    
    // Enable Mathlib
    new Setting(containerEl)
      .setName('Enable Mathlib')
      .setDesc('Enable mathlib integration for Lean projects.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableMathlib)
          .onChange(async (value) => {
            this.plugin.settings.enableMathlib = value;
            await this.plugin.saveSettings();
            
            // Update mathlib manager
            if (this.plugin.mathlibManager) {
              this.plugin.mathlibManager.updateSettings({
                enabled: value
              });
            }
          })
      );
    
    // Auto-Update Mathlib
    new Setting(containerEl)
      .setName('Auto-Update Mathlib')
      .setDesc('Automatically check for updates to mathlib.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.mathlibAutoUpdates)
          .onChange(async (value) => {
            this.plugin.settings.mathlibAutoUpdates = value;
            await this.plugin.saveSettings();
            
            // Update mathlib manager
            if (this.plugin.mathlibManager) {
              this.plugin.mathlibManager.updateSettings({
                autoUpdate: value
              });
            }
          })
      );
    
    // Mathlib Version Info
    if (this.plugin.mathlibManager && this.plugin.mathlibManager.getCurrentVersion()) {
      const version = this.plugin.mathlibManager.getCurrentVersion();
      new Setting(containerEl)
        .setName('Current Mathlib Version')
        .setDesc(version ? `v${version.version} (${new Date(version.releaseDate).toLocaleDateString()})` : 'Not installed')
        .addButton((button) =>
          button
            .setButtonText('Check for Updates')
            .onClick(() => {
              this.plugin.checkMathlibUpdates();
            })
        );
    }
      
    // Mathlib Integration Heading
    containerEl.createEl('h3', { text: 'Mathlib Integration' });
    
    // Enable Mathlib support
    new Setting(containerEl)
      .setName('Enable Mathlib')
      .setDesc('Enable Mathlib integration for enhanced theorem proving capabilities.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableMathlib)
          .onChange(async (value) => {
            this.plugin.settings.enableMathlib = value;
            await this.plugin.saveSettings();
            // Restart Lean client to apply changes
            await this.plugin.initLeanClient();
          })
      );
    
    // Auto-Check Mathlib Updates
    new Setting(containerEl)
      .setName('Auto-Check Mathlib Updates')
      .setDesc('Automatically check for updates to Mathlib.')
      .setDisabled(!this.plugin.settings.enableMathlib)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.mathlibAutoUpdates)
          .onChange(async (value) => {
            this.plugin.settings.mathlibAutoUpdates = value;
            await this.plugin.saveSettings();
          })
      );
    
    // Current Mathlib Version
    if (this.plugin.settings.mathlibVersion) {
      new Setting(containerEl)
        .setName('Current Mathlib Version')
        .setDesc('The currently installed version of Mathlib.')
        .addText((text) =>
          text
            .setValue(this.plugin.settings.mathlibVersion)
            .setDisabled(true)
        );
    }
    
    // Check for Mathlib Updates Button
    new Setting(containerEl)
      .setName('Check for Mathlib Updates')
      .setDesc('Manually check for updates to Mathlib.')
      .setDisabled(!this.plugin.settings.enableMathlib)
      .addButton((button) =>
        button
          .setButtonText('Check Now')
          .onClick(() => {
            this.plugin.checkMathlibUpdates();
          })
      );
    
    // Advanced Options Heading
    containerEl.createEl('h3', { text: 'Advanced Options' });
    
    // Check for Updates Now button
    new Setting(containerEl)
      .setName('Check for Updates Now')
      .setDesc('Manually check for updates to Lean packages.')
      .addButton((button) =>
        button
          .setButtonText('Check Now')
          .onClick(() => {
            this.plugin.checkLakeUpdates();
          })
      );
    
    // Reset Settings button
    new Setting(containerEl)
      .setName('Reset Settings')
      .setDesc('Reset all settings to default values.')
      .addButton((button) =>
        button
          .setButtonText('Reset')
          .setWarning()
          .onClick(async () => {
            this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
            await this.plugin.saveSettings();
            this.display();
            new Notice('Settings reset to defaults.');
          })
      );
  }
}
// Types for Lean 4 Language Server Protocol interactions

export interface LeanDiagnostic {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: number; // 1 = Error, 2 = Warning, 3 = Info, 4 = Hint
  message: string;
}

export interface LeanHoverResult {
  contents: string | { kind: string; value: string }[];
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface LeanGoal {
  id: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  uri: string;
  goal: string;
  tacticState: string;
}

export interface LeanClientOptions {
  leanPath?: string;
  useWasm?: boolean;
  checkUpdatesInterval?: number;
  lastUpdateCheck?: number;
  mathlibVersion?: string;
}

// Types for mathlib support
export interface MathlibStatus {
  loaded: boolean;
  version: string | null;
  url: string | null;
}

export type LeanDiagnosticsHandler = (diagnostics: LeanDiagnostic[]) => void;
export type LeanGoalsHandler = (goals: LeanGoal[]) => void;

// Types for code completion
export interface LeanCompletionItem {
  label: string;
  kind: number;
  detail?: string;
  documentation?: string | { kind: string; value: string };
  sortText?: string;
  insertText?: string;
}

// Types for advanced proof tools
export interface TacticSuggestion {
  name: string;
  description: string;
  success: 'high' | 'medium' | 'low';
}

// Types for debugging
export interface DebugSession {
  id: string;
  uri: string;
  status: 'starting' | 'running' | 'paused' | 'stopped';
}

export interface DebugVariable {
  name: string;
  value: string;
  type: string;
}

export interface DebugBreakpoint {
  id: string;
  verified: boolean;
  line: number;
  uri: string;
}
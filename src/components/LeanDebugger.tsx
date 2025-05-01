import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { LeanClient } from '../leanClient';
import { DebugVariable, DebugBreakpoint } from '../types/lean-types';

interface LeanDebuggerProps {
  leanClient: LeanClient;
  currentFile: string;
  onSetBreakpoint?: (line: number) => void;
}

export const LeanDebugger = ({ 
  leanClient, 
  currentFile,
  onSetBreakpoint 
}: LeanDebuggerProps) => {
  const [sessionActive, setSessionActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'starting' | 'paused' | 'running' | 'error'>('idle');
  const [variables, setVariables] = useState<DebugVariable[]>([]);
  const [breakpoints, setBreakpoints] = useState<DebugBreakpoint[]>([]);
  const [newBreakpointLine, setNewBreakpointLine] = useState('');
  const [output, setOutput] = useState<string[]>([]);

  // Start a new debug session
  const startDebugging = async () => {
    try {
      setStatus('starting');
      const sessionId = await leanClient.startDebugSession(`file://${currentFile}`);
      
      if (sessionId) {
        setSessionActive(true);
        setStatus('paused');
        addOutput(`Debug session started for ${currentFile}`);
      } else {
        setStatus('error');
        addOutput('Failed to start debug session');
      }
    } catch (error) {
      console.error('Error starting debug session:', error);
      setStatus('error');
      addOutput(`Error: ${error.message || 'Unknown error'}`);
    }
  };

  // Stop the current debug session
  const stopDebugging = async () => {
    try {
      const result = await leanClient.stopDebugSession();
      if (result) {
        setSessionActive(false);
        setStatus('idle');
        setVariables([]);
        addOutput('Debug session stopped');
      }
    } catch (error) {
      console.error('Error stopping debug session:', error);
      addOutput(`Error: ${error.message || 'Unknown error'}`);
    }
  };

  // Continue execution
  const continueExecution = async () => {
    if (status !== 'paused') return;
    
    try {
      setStatus('running');
      const result = await leanClient.continueExecution();
      if (!result) {
        setStatus('error');
        addOutput('Failed to continue execution');
      }
    } catch (error) {
      console.error('Error continuing execution:', error);
      setStatus('error');
      addOutput(`Error: ${error.message || 'Unknown error'}`);
    }
  };

  // Step over the current line
  const stepOver = async () => {
    if (status !== 'paused') return;
    
    try {
      const result = await leanClient.stepOver();
      if (result) {
        updateVariables();
        addOutput('Stepped over');
      } else {
        addOutput('Failed to step over');
      }
    } catch (error) {
      console.error('Error stepping over:', error);
      addOutput(`Error: ${error.message || 'Unknown error'}`);
    }
  };

  // Add a new breakpoint
  const addBreakpoint = async () => {
    const line = parseInt(newBreakpointLine);
    if (isNaN(line) || line < 0) {
      addOutput('Invalid line number');
      return;
    }
    
    try {
      const bp = await leanClient.setBreakpoint(`file://${currentFile}`, line);
      if (bp) {
        setBreakpoints([...breakpoints, bp]);
        setNewBreakpointLine('');
        addOutput(`Breakpoint set at line ${line}`);
        
        if (onSetBreakpoint) {
          onSetBreakpoint(line);
        }
      } else {
        addOutput(`Failed to set breakpoint at line ${line}`);
      }
    } catch (error) {
      console.error('Error setting breakpoint:', error);
      addOutput(`Error: ${error.message || 'Unknown error'}`);
    }
  };

  // Update variable list
  const updateVariables = async () => {
    try {
      const vars = await leanClient.getVariables();
      setVariables(vars);
    } catch (error) {
      console.error('Error getting variables:', error);
    }
  };

  // Add a message to the output console
  const addOutput = (message: string) => {
    setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Listen for debug events
  useEffect(() => {
    const handleDebugStopped = (params: any) => {
      setStatus('paused');
      updateVariables();
      addOutput(`Execution paused at line ${params.line}`);
    };

    const handleDebugContinued = () => {
      setStatus('running');
      addOutput('Execution continued');
    };

    leanClient.on('debug/stopped', handleDebugStopped);
    leanClient.on('debug/continued', handleDebugContinued);

    return () => {
      // TypeScript doesn't have direct removal methods, so we need to cast
      (leanClient as any).off?.('debug/stopped', handleDebugStopped);
      (leanClient as any).off?.('debug/continued', handleDebugContinued);
    };
  }, [leanClient]);

  return (
    <div className="lean-debugger">
      <div className="lean-debugger-header">
        <h4>Lean Debugger</h4>
        <div className="lean-debugger-status">
          Status: <span className={`lean-status-${status}`}>{status}</span>
        </div>
      </div>
      
      <div className="lean-debugger-controls">
        {!sessionActive ? (
          <button 
            className="lean-debug-button lean-debug-start"
            onClick={startDebugging}
            disabled={status === 'starting'}
          >
            Start Debugging
          </button>
        ) : (
          <>
            <button 
              className="lean-debug-button lean-debug-stop"
              onClick={stopDebugging}
            >
              Stop
            </button>
            <button 
              className="lean-debug-button lean-debug-continue"
              onClick={continueExecution}
              disabled={status !== 'paused'}
            >
              Continue
            </button>
            <button 
              className="lean-debug-button lean-debug-step"
              onClick={stepOver}
              disabled={status !== 'paused'}
            >
              Step Over
            </button>
          </>
        )}
      </div>
      
      <div className="lean-debugger-sections">
        <div className="lean-debugger-section">
          <h5>Breakpoints</h5>
          {breakpoints.length > 0 ? (
            <ul className="lean-breakpoint-list">
              {breakpoints.map((bp, index) => (
                <li key={index} className="lean-breakpoint-item">
                  Line {bp.line} {!bp.verified && <span className="lean-unverified">(unverified)</span>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="lean-no-breakpoints">No breakpoints set</div>
          )}
          
          <div className="lean-add-breakpoint">
            <input 
              type="number" 
              value={newBreakpointLine}
              min="0"
              onChange={(e) => setNewBreakpointLine(e.target.value)}
              placeholder="Line number"
              className="lean-breakpoint-input"
            />
            <button 
              onClick={addBreakpoint}
              disabled={!newBreakpointLine || !sessionActive}
              className="lean-breakpoint-button"
            >
              Add
            </button>
          </div>
        </div>
        
        <div className="lean-debugger-section">
          <h5>Variables</h5>
          {variables.length > 0 ? (
            <div className="lean-variables">
              <table className="lean-variables-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Value</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {variables.map((v, index) => (
                    <tr key={index} className="lean-variable-row">
                      <td className="lean-variable-name">{v.name}</td>
                      <td className="lean-variable-value">{v.value}</td>
                      <td className="lean-variable-type">{v.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="lean-no-variables">No variables to display</div>
          )}
        </div>
      </div>
      
      <div className="lean-debugger-output">
        <h5>Debug Console</h5>
        <div className="lean-output-console">
          {output.map((line, index) => (
            <div key={index} className="lean-output-line">{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeanDebugger;
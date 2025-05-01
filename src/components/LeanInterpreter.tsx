import { h } from 'preact';
import { useState } from 'preact/hooks';
import { LeanClient } from '../leanClient';

interface LeanInterpreterProps {
  leanClient: LeanClient;
  currentFile: string;
}

export const LeanInterpreter = ({ leanClient, currentFile }: LeanInterpreterProps) => {
  const [code, setCode] = useState('');
  const [result, setResult] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [history, setHistory] = useState<Array<{code: string, result: string}>>([]);

  const handleEvaluate = async () => {
    if (!code.trim()) return;
    
    setIsEvaluating(true);
    try {
      const evalResult = await leanClient.evaluate(`file://${currentFile}`, code);
      setResult(evalResult);
      
      // Add to history
      setHistory(prev => [...prev, { code, result: evalResult }]);
      
      // Clear input if successful
      setCode('');
    } catch (error) {
      console.error('Evaluation error:', error);
      setResult(`Error: ${error.message || 'Unknown error'}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleEvaluate();
    }
  };

  const insertCodeExample = (example: string) => {
    setCode(example);
  };

  return (
    <div className="lean-interpreter">
      <div className="lean-interpreter-header">
        <h4>Lean Interpreter</h4>
        <div className="lean-interpreter-examples">
          <button 
            onClick={() => insertCodeExample('#eval "Hello, Lean!"')}
            className="lean-example-button"
          >
            String
          </button>
          <button 
            onClick={() => insertCodeExample('#eval 42 + 7')}
            className="lean-example-button"
          >
            Math
          </button>
          <button 
            onClick={() => insertCodeExample('#check Nat → Nat')}
            className="lean-example-button"
          >
            Type
          </button>
        </div>
      </div>
      
      <div className="lean-interpreter-input-container">
        <textarea
          className="lean-interpreter-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter Lean code to evaluate... (Ctrl+Enter to run)"
          rows={5}
        />
        <button 
          onClick={handleEvaluate}
          disabled={isEvaluating || !code.trim()}
          className="lean-interpreter-button"
        >
          {isEvaluating ? 'Evaluating...' : 'Evaluate'}
        </button>
      </div>
      
      {result && (
        <div className="lean-interpreter-output">
          <h5>Result:</h5>
          <pre className="lean-interpreter-result">{result}</pre>
        </div>
      )}
      
      {history.length > 0 && (
        <div className="lean-interpreter-history">
          <h5>History:</h5>
          <div className="lean-history-entries">
            {history.map((entry, index) => (
              <div key={index} className="lean-history-entry">
                <div className="lean-history-code" onClick={() => setCode(entry.code)}>
                  <span className="lean-history-prompt">λ&gt;</span> {entry.code}
                </div>
                <pre className="lean-history-result">{entry.result}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="lean-interpreter-help">
        <details>
          <summary>Help & Commands</summary>
          <ul className="lean-help-list">
            <li><code>#eval &lt;expr&gt;</code> - Evaluate an expression</li>
            <li><code>#check &lt;expr&gt;</code> - Check the type of an expression</li>
            <li><code>#print &lt;def&gt;</code> - Print a definition</li>
            <li><code>#exit</code> - Exit the interpreter</li>
          </ul>
          <p className="lean-help-note">
            Pro tip: Use Ctrl+Enter to quickly evaluate code.
          </p>
        </details>
      </div>
    </div>
  );
};

export default LeanInterpreter;
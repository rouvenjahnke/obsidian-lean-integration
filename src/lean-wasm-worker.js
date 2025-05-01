// Web Worker for Lean WASM Implementation
// This provides an enhanced version of the Lean server
// using the Lean web assembly port with mathlib support

let leanWasm = null;
let leanFS = null;
const fileContents = new Map();
let mathlibLoaded = false;
let mathlibUrl = null;
let mathlibVersion = null;

// Initialize the Lean WebAssembly environment
async function initializeWasm(options = {}) {
  try {
    // Check if we have mathlib options
    if (options.mathlib) {
      mathlibUrl = options.mathlib.url;
      mathlibVersion = options.mathlib.version;
    }

    // Import improved Lean WASM module
    // Using a recent version that supports mathlib
    const leanModule = await import('https://cdn.jsdelivr.net/npm/lean4-web@latest/lean4-web.js');
    
    // Initialize virtual file system
    leanFS = new leanModule.FileSystem();
    
    // Initialize Lean with the virtual filesystem
    leanWasm = await leanModule.init({
      filesystem: leanFS,
      print: (msg) => {
        console.log('Lean output:', msg);
        // Forward output to main thread
        postMessage({
          jsonrpc: '2.0',
          method: 'output',
          params: { message: msg }
        });
      },
      // Add mathlib configuration if available
      mathlib: mathlibUrl ? {
        url: mathlibUrl,
        version: mathlibVersion
      } : undefined
    });
    
    // Try to load mathlib if URL is provided
    if (mathlibUrl) {
      try {
        await loadMathlib(mathlibUrl);
        mathlibLoaded = true;
        
        // Notify main thread that mathlib was loaded
        postMessage({
          jsonrpc: '2.0',
          method: 'mathlib-loaded',
          params: { 
            success: true,
            version: mathlibVersion
          }
        });
      } catch (mathlibError) {
        console.error('Failed to load mathlib:', mathlibError);
        postMessage({
          jsonrpc: '2.0',
          method: 'mathlib-loaded',
          params: { 
            success: false, 
            error: mathlibError.message,
            version: mathlibVersion
          }
        });
      }
    }
    
    postMessage({
      jsonrpc: '2.0',
      method: 'initialized',
      params: { 
        success: true,
        mathlibLoaded
      }
    });
  } catch (error) {
    console.error('Failed to initialize Lean WASM:', error);
    postMessage({
      jsonrpc: '2.0',
      method: 'initialized',
      params: { success: false, error: error.message }
    });
  }
}

// Load mathlib from URL
async function loadMathlib(url) {
  if (!leanWasm || !leanWasm.loadMathlib) {
    throw new Error('Lean WASM not initialized or does not support mathlib');
  }
  
  // Load mathlib into the WASM environment
  await leanWasm.loadMathlib(url);
  
  // Setup mathlib imports in the virtual file system
  if (leanFS) {
    // Create a basic import file that imports mathlib
    const basicMathlibImport = `import Mathlib\n\n-- Your code starts here\n`;
    leanFS.writeFile('/mathlib_prelude.lean', basicMathlibImport);
  }
}

// Handle hover requests using the WASM API
async function handleHover(id, uri, position) {
  if (!leanWasm) {
    return {
      jsonrpc: '2.0',
      id,
      result: null
    };
  }

  try {
    // Extract file path from URI
    const filePath = uri.replace('file://', '');
    const content = fileContents.get(filePath) || '';
    
    // Make sure the file is in the virtual filesystem
    if (leanFS && !leanFS.exists(filePath)) {
      leanFS.writeFile(filePath, content);
    }
    
    // Get hover info at position 
    const info = leanWasm.hover(filePath, position.line, position.character);
    
    return {
      jsonrpc: '2.0',
      id,
      result: {
        contents: {
          kind: 'markdown',
          value: info.text || ''
        },
        range: info.range
      }
    };
  } catch (error) {
    console.error('Error in WASM hover:', error);
    return {
      jsonrpc: '2.0',
      id,
      result: null
    };
  }
}

// Handle completion requests
async function handleCompletion(id, uri, position) {
  if (!leanWasm) {
    return { jsonrpc: '2.0', id, result: { items: [] } };
  }

  try {
    // Extract file path from URI
    const filePath = uri.replace('file://', '');
    const content = fileContents.get(filePath) || '';
    
    // Make sure the file is in the virtual filesystem
    if (leanFS && !leanFS.exists(filePath)) {
      leanFS.writeFile(filePath, content);
    }
    
    // Get completions at position
    const completions = leanWasm.getCompletions(filePath, position.line, position.character);
    
    return {
      jsonrpc: '2.0',
      id,
      result: {
        items: completions.map(c => ({
          label: c.text || '',
          kind: c.kind || 3, // Default to Method if not provided
          detail: c.detail || '',
          documentation: c.documentation || ''
        }))
      }
    };
  } catch (error) {
    console.error('Error in WASM completion:', error);
    return { jsonrpc: '2.0', id, result: { items: [] } };
  }
}

// Handle evaluation requests
async function handleEvaluation(id, uri, code) {
  if (!leanWasm) {
    return { jsonrpc: '2.0', id, result: '' };
  }

  try {
    // Extract file path from URI
    const filePath = uri.replace('file://', '');
    
    // Evaluate the code
    const result = leanWasm.eval(code, { fileName: filePath });
    
    return {
      jsonrpc: '2.0',
      id,
      result: result?.output || ''
    };
  } catch (error) {
    console.error('Error in WASM evaluation:', error);
    return { 
      jsonrpc: '2.0', 
      id, 
      result: `Error: ${error.message}` 
    };
  }
}

// Handle tactic search
async function handleTacticSearch(id, uri, goal) {
  if (!leanWasm) {
    return { jsonrpc: '2.0', id, result: [] };
  }

  try {
    // This is a simplified implementation, as full tactic search requires
    // more sophisticated Lean integration
    // In a real implementation, this would integrate with Lean's tactic library
    
    // Basic set of general tactics that might work in many goals
    const basicTactics = [
      { name: 'intro', description: 'Introduce assumptions', success: 'high' },
      { name: 'apply', description: 'Apply a theorem', success: 'medium' },
      { name: 'exact', description: 'Provide exact proof term', success: 'high' },
      { name: 'rw', description: 'Rewrite expressions', success: 'medium' },
      { name: 'simp', description: 'Simplify the goal', success: 'medium' },
      { name: 'cases', description: 'Case analysis', success: 'medium' },
      { name: 'induction', description: 'Induction on a variable', success: 'low' }
    ];
    
    // In a real implementation, we would analyze the goal and return targeted suggestions
    return {
      jsonrpc: '2.0',
      id,
      result: basicTactics
    };
  } catch (error) {
    console.error('Error in WASM tactic search:', error);
    return { jsonrpc: '2.0', id, result: [] };
  }
}

// Handle file operations
async function handleFileOperations(id, method, params) {
  try {
    if (!leanFS) {
      return { 
        jsonrpc: '2.0', 
        id, 
        result: { success: false, error: 'File system not initialized' } 
      };
    }
    
    let result;
    
    switch (method) {
      case 'writeFile':
        leanFS.writeFile(params.path, params.content);
        fileContents.set(params.path, params.content);
        result = { success: true };
        break;
        
      case 'readFile':
        try {
          const content = leanFS.readFile(params.path);
          result = { success: true, content };
        } catch (e) {
          result = { success: false, error: e.message };
        }
        break;
        
      case 'exists':
        result = { success: true, exists: leanFS.exists(params.path) };
        break;
        
      default:
        result = { success: false, error: 'Unknown file operation' };
    }
    
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  } catch (error) {
    console.error('Error in file operation:', error);
    return { 
      jsonrpc: '2.0', 
      id, 
      result: { success: false, error: error.message } 
    };
  }
}

// Process diagnostics for a file
function processFileDiagnostics(uri) {
  if (!leanWasm) return;
  
  try {
    const filePath = uri.replace('file://', '');
    const diagnostics = leanWasm.getDiagnostics(filePath);
    
    if (diagnostics && Array.isArray(diagnostics)) {
      // Send diagnostics notification to main thread
      postMessage({
        jsonrpc: '2.0',
        method: 'textDocument/publishDiagnostics',
        params: {
          uri,
          diagnostics: diagnostics.map(d => ({
            range: {
              start: { line: d.range.start.line, character: d.range.start.character },
              end: { line: d.range.end.line, character: d.range.end.character }
            },
            severity: d.severity,
            message: d.message,
            uri
          }))
        }
      });
    }
  } catch (error) {
    console.error('Error processing diagnostics:', error);
  }
}

// Process goals for a file
function processFileGoals(uri) {
  if (!leanWasm) return;
  
  try {
    const filePath = uri.replace('file://', '');
    const goals = leanWasm.getGoals(filePath);
    
    if (goals && Array.isArray(goals)) {
      // Send goals notification to main thread
      postMessage({
        jsonrpc: '2.0',
        method: 'lean/goals',
        params: {
          goals: goals.map((g, index) => ({
            id: `goal-${index}`,
            range: {
              start: { line: g.range.start.line, character: g.range.start.character },
              end: { line: g.range.end.line, character: g.range.end.character }
            },
            uri,
            goal: g.goal || '',
            tacticState: g.tacticState || ''
          }))
        }
      });
    }
  } catch (error) {
    console.error('Error processing goals:', error);
  }
}

// Handle mathlib updates
async function updateMathlib(id, mathlibOptions) {
  try {
    if (!mathlibOptions.url) {
      return {
        jsonrpc: '2.0',
        id,
        result: { 
          success: false, 
          error: 'No mathlib URL provided' 
        }
      };
    }
    
    // Load the new mathlib version
    await loadMathlib(mathlibOptions.url);
    
    // Update tracking variables
    mathlibUrl = mathlibOptions.url;
    mathlibVersion = mathlibOptions.version;
    mathlibLoaded = true;
    
    return {
      jsonrpc: '2.0',
      id,
      result: { 
        success: true,
        version: mathlibOptions.version 
      }
    };
  } catch (error) {
    console.error('Failed to update mathlib:', error);
    return {
      jsonrpc: '2.0',
      id,
      result: { 
        success: false, 
        error: error.message 
      }
    };
  }
}

// Get mathlib status
function getMathlibStatus(id) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      loaded: mathlibLoaded,
      version: mathlibVersion,
      url: mathlibUrl
    }
  };
}

// Handle messages from the main thread
self.onmessage = async (event) => {
  const message = event.data;

  // Route the message based on its method
  switch (message.method) {
    case 'initialize':
      await initializeWasm(message.params);
      break;
      
    case 'setFileContent':
      fileContents.set(message.params.uri, message.params.content);
      if (leanFS) {
        const filePath = message.params.uri.replace('file://', '');
        leanFS.writeFile(filePath, message.params.content);
        
        // Process diagnostics and goals after file content change
        processFileDiagnostics(message.params.uri);
        processFileGoals(message.params.uri);
      }
      break;
      
    case 'textDocument/hover':
      const hoverResponse = await handleHover(
        message.id,
        message.params.textDocument.uri,
        message.params.position
      );
      postMessage(hoverResponse);
      break;
      
    case 'textDocument/completion':
      const completionResponse = await handleCompletion(
        message.id,
        message.params.textDocument.uri,
        message.params.position
      );
      postMessage(completionResponse);
      break;
      
    case 'lean/eval':
      const evalResponse = await handleEvaluation(
        message.id,
        message.params.textDocument.uri,
        message.params.code
      );
      postMessage(evalResponse);
      break;
      
    case 'lean/searchTactics':
      const tacticsResponse = await handleTacticSearch(
        message.id,
        message.params.textDocument.uri,
        message.params.goal
      );
      postMessage(tacticsResponse);
      break;
      
    case 'fs/operation':
      const fsResponse = await handleFileOperations(
        message.id,
        message.params.fsMethod,
        message.params.fsParams
      );
      postMessage(fsResponse);
      break;
      
    // New mathlib-related methods
    case 'mathlib/update':
      const updateResponse = await updateMathlib(
        message.id,
        message.params
      );
      postMessage(updateResponse);
      break;
      
    case 'mathlib/status':
      const statusResponse = getMathlibStatus(message.id);
      postMessage(statusResponse);
      break;
      
    case 'mathlib/importToFile':
      // Add mathlib import to a file
      if (leanFS) {
        const filePath = message.params.uri.replace('file://', '');
        const content = fileContents.get(message.params.uri) || '';
        
        // Add import if it doesn't exist
        if (!content.includes('import Mathlib')) {
          const newContent = `import Mathlib\n\n${content}`;
          fileContents.set(message.params.uri, newContent);
          leanFS.writeFile(filePath, newContent);
          
          // Re-process the file
          processFileDiagnostics(message.params.uri);
          processFileGoals(message.params.uri);
        }
      }
      
      // Always return success, even if the import already exists
      postMessage({
        jsonrpc: '2.0',
        id: message.id,
        result: { success: true }
      });
      break;
  }
};

// Signal that the worker is ready
postMessage({ method: 'ready' });
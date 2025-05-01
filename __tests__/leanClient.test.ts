import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LeanClient } from '../src/leanClient';
import { EventEmitter } from 'events';

// Mock child_process.spawn
vi.mock('child_process', () => {
  const EventEmitter = require('events');
  return {
    spawn: vi.fn(() => {
      const process = new EventEmitter();
      process.stdout = new EventEmitter();
      process.stderr = new EventEmitter();
      process.stdin = {
        write: vi.fn(),
      };
      process.kill = vi.fn();
      return process;
    }),
  };
});

describe('LeanClient', () => {
  let client: LeanClient;
  
  beforeEach(() => {
    client = new LeanClient();
  });
  
  afterEach(() => {
    client.stop();
    vi.clearAllMocks();
  });

  it('should initialize with default options', () => {
    expect(client).toBeInstanceOf(EventEmitter);
  });

  it('should start the Lean server process', async () => {
    const result = await client.start();
    expect(result).toBe(true);
  });

  it('should stop the Lean server process', async () => {
    await client.start();
    client.stop();
    
    // Check if process.kill was called
    const spawn = require('child_process').spawn;
    const mockProcess = spawn();
    expect(mockProcess.kill).toHaveBeenCalled();
  });

  it('should handle diagnostics notifications', async () => {
    const onDiagnostics = vi.fn();
    client.on('diagnostics', onDiagnostics);
    
    await client.start();
    
    // Simulate receiving a diagnostics notification
    const spawn = require('child_process').spawn;
    const mockProcess = spawn();
    
    const diagnostics = [
      {
        uri: 'file:///test.lean',
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 5 },
        },
        severity: 1,
        message: 'Test error',
      },
    ];
    
    const message = JSON.stringify({
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params: {
        uri: 'file:///test.lean',
        diagnostics,
      },
    });
    
    mockProcess.stdout.emit('data', Buffer.from(message + '\n'));
    
    expect(onDiagnostics).toHaveBeenCalledWith(diagnostics);
  });

  it('should send hover requests and receive responses', async () => {
    await client.start();
    
    // Prepare for the hover request
    const hoverResult = {
      contents: {
        kind: 'markdown',
        value: 'Test hover content',
      },
    };
    
    // Create a promise that will resolve when the response is received
    const hoverPromise = client.hover('file:///test.lean', { line: 1, character: 5 });
    
    // Get the mock process
    const spawn = require('child_process').spawn;
    const mockProcess = spawn();
    
    // Send the response
    setTimeout(() => {
      // Find the request ID from the mocked stdin.write call
      const writeCalls = mockProcess.stdin.write.mock.calls;
      const lastCall = writeCalls[writeCalls.length - 1];
      const requestStr = lastCall[0];
      const request = JSON.parse(requestStr);
      
      // Send a response with the same ID
      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        result: hoverResult,
      });
      
      mockProcess.stdout.emit('data', Buffer.from(response + '\n'));
    }, 10);
    
    // Wait for the response
    const result = await hoverPromise;
    expect(result).toEqual(hoverResult);
  });
});
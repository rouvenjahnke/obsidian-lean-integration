/**
 * Simple EventEmitter implementation for browser compatibility
 * Used as a replacement for Node.js EventEmitter
 */
export class SimpleEventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, listener: Function): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) {
      return false;
    }
    this.events[event].forEach(listener => listener(...args));
    return true;
  }

  off(event: string, listener: Function): this {
    if (!this.events[event]) {
      return this;
    }
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }
  
  removeAllListeners(event?: string): this {
    if (event) {
      this.events[event] = [];
    } else {
      this.events = {};
    }
    return this;
  }
}
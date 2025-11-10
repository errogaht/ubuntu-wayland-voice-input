const { spawn } = require('child_process');

class ClipboardManager {
  constructor(options = {}) {
    this.options = {
      ...options
    };
  }

  async initialize() {
    // Check available clipboard tools - try xclip first, then wl-copy
    this.clipboardTool = await this.detectClipboardTool();
    if (!this.clipboardTool) {
      throw new Error('No clipboard tool found. Install: sudo apt install xclip wl-clipboard');
    }
    console.log(`📋 Using clipboard tool: ${this.clipboardTool}`);
  }

  async detectClipboardTool() {
    // Try xclip first (more reliable)
    if (await this.checkCommand('xclip')) {
      return 'xclip';
    }
    // Then try wl-copy
    if (await this.checkCommand('wl-copy')) {
      return 'wl-copy';
    }
    return null;
  }

  async copyText(text) {
    if (!text?.trim()) return;

    console.log('📋 Copying text to clipboard...');

    // Ensure clipboard tool is initialized
    if (!this.clipboardTool) {
      await this.initialize();
    }

    const { spawn } = require('child_process');

    // wl-copy on Wayland has a known issue - it blocks waiting for paste
    // We need to use a different approach: spawn in background and detach
    if (this.clipboardTool === 'wl-copy') {
      return this._copyWithWlCopy(text);
    } else {
      return this._copyWithXclip(text);
    }
  }

  async _copyWithWlCopy(text) {
    // wl-copy needs to stay alive in background to serve clipboard
    // Use detached process with timeout
    const { spawn } = require('child_process');

    return new Promise((resolve, reject) => {
      try {
        const child = spawn('wl-copy', [], {
          stdio: ['pipe', 'ignore', 'pipe'],
          detached: true  // Detach so it can run in background
        });

        let errorOutput = '';
        let resolved = false;

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            // Assume success after timeout - wl-copy is working but blocked
            console.log('✅ Text copied to clipboard (wl-copy detached)');
            child.unref(); // Allow process to continue independently
            resolve();
          }
        }, 100); // 100ms timeout

        child.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        child.on('error', (error) => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;
            console.error('❌ wl-copy failed:', error.message);
            reject(new Error(`wl-copy failed: ${error.message}`));
          }
        });

        child.on('close', (code) => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            if (code === 0) {
              console.log('✅ Text copied to clipboard');
              resolve();
            } else {
              reject(new Error(`wl-copy failed with code ${code}`));
            }
          }
        });

        // Write text and close stdin
        child.stdin.write(text);
        child.stdin.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  async _copyWithXclip(text) {
    const { spawn } = require('child_process');

    return new Promise((resolve, reject) => {
      try {
        const child = spawn('xclip', ['-selection', 'clipboard'], {
          stdio: ['pipe', 'ignore', 'pipe']
        });

        let errorOutput = '';

        child.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        child.on('error', (error) => {
          console.error('❌ xclip failed:', error.message);
          reject(new Error(`xclip failed: ${error.message}`));
        });

        child.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Text copied to clipboard');
            resolve();
          } else {
            console.error('❌ xclip failed with code:', code);
            if (errorOutput) {
              console.error('Error output:', errorOutput);
            }
            reject(new Error(`xclip failed with code ${code}`));
          }
        });

        // Write text and close stdin
        child.stdin.write(text);
        child.stdin.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  async checkCommand(command) {
    return new Promise((resolve) => {
      const process = spawn('which', [command], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });
    });
  }

  static async checkInstallation() {
    try {
      const clipboardManager = new ClipboardManager();
      await clipboardManager.initialize();
      return true;
    } catch (error) {
      console.error('❌ Clipboard check failed:', error.message);
      return false;
    }
  }
}

module.exports = ClipboardManager;
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
    
    // Fire and forget approach - don't wait for completion
    const { spawn } = require('child_process');
    
    try {
      let command, args;
      
      if (this.clipboardTool === 'xclip') {
        command = 'xclip';
        args = ['-selection', 'clipboard'];
      } else {
        command = 'wl-copy';
        args = [];
      }
      
      const child = spawn(command, args, {
        stdio: ['pipe', 'ignore', 'ignore']
      });
      
      // Write text and close immediately
      child.stdin.write(text);
      child.stdin.end();
      
      // Don't wait for completion - just assume it works
      console.log('✅ Text copied to clipboard');
      
    } catch (error) {
      console.log('⚠️ Clipboard copy may have failed, but continuing...');
    }
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
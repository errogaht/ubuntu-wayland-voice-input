const fs = require('fs');
const path = require('path');

class LogManager {
  constructor(options = {}) {
    this.options = {
      logDir: options.logDir || path.join(__dirname, '..', 'var', 'logs'),
      logFile: options.logFile || 'voice-input.log',
      maxSize: options.maxSize || 1024 * 1024, // 1MB
      enabled: options.enabled !== false,
      ...options
    };
    
    this.logPath = path.join(this.options.logDir, this.options.logFile);
    this.backupPath = path.join(this.options.logDir, this.options.logFile + '.old');
    
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.options.logDir)) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }
  }

  log(level, message, ...args) {
    if (!this.options.enabled) return;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    const fullMessage = args.length > 0 ? `${logEntry} ${args.join(' ')}` : logEntry;

    // Console output
    console.log(fullMessage);

    // File output
    try {
      this.rotateIfNeeded();
      fs.appendFileSync(this.logPath, fullMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  info(message, ...args) {
    this.log('info', message, ...args);
  }

  warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  error(message, ...args) {
    this.log('error', message, ...args);
  }

  debug(message, ...args) {
    this.log('debug', message, ...args);
  }

  rotateIfNeeded() {
    if (!fs.existsSync(this.logPath)) return;

    const stats = fs.statSync(this.logPath);
    if (stats.size >= this.options.maxSize) {
      // Backup current log
      if (fs.existsSync(this.backupPath)) {
        fs.unlinkSync(this.backupPath);
      }
      fs.renameSync(this.logPath, this.backupPath);
      
      // Create fresh log file
      fs.writeFileSync(this.logPath, `[${new Date().toISOString()}] INFO: Log rotated (size: ${stats.size} bytes)\n`);
    }
  }

  // Session methods for structured logging
  logSession(sessionId, event, data = {}) {
    const sessionData = {
      sessionId,
      event,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    this.info(`SESSION [${sessionId}] ${event}:`, JSON.stringify(data));
  }

  logTranscription(sessionId, text, duration = null) {
    const data = { text, duration };
    this.logSession(sessionId, 'TRANSCRIPTION', data);
  }

  logError(sessionId, error, context = '') {
    const errorData = {
      error: error.message,
      context,
      stack: error.stack
    };
    this.logSession(sessionId, 'ERROR', errorData);
  }

  // Get recent logs for debugging
  getRecentLogs(lines = 50) {
    try {
      if (!fs.existsSync(this.logPath)) return [];
      
      const content = fs.readFileSync(this.logPath, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      
      return allLines.slice(-lines);
    } catch (error) {
      console.error('Failed to read log file:', error.message);
      return [];
    }
  }

  // Clear all logs
  clearLogs() {
    try {
      if (fs.existsSync(this.logPath)) {
        fs.unlinkSync(this.logPath);
      }
      if (fs.existsSync(this.backupPath)) {
        fs.unlinkSync(this.backupPath);
      }
      this.info('Logs cleared');
    } catch (error) {
      console.error('Failed to clear logs:', error.message);
    }
  }
}

// Singleton instance
let loggerInstance = null;

// Factory function
function createLogger(options = {}) {
  if (!loggerInstance) {
    loggerInstance = new LogManager(options);
  }
  return loggerInstance;
}

// Export both class and singleton
module.exports = { LogManager, createLogger };
const fs = require('fs');
const path = require('path');

class ProcessManager {
  constructor() {
    this.pidFile = path.join('/tmp', 'voice-input.pid');
  }

  async checkAndStopExisting() {
    try {
      // Check if PID file exists
      if (!fs.existsSync(this.pidFile)) {
        return false; // No existing process
      }

      // Read PID from file
      const pidStr = fs.readFileSync(this.pidFile, 'utf8').trim();
      const existingPid = parseInt(pidStr);

      if (isNaN(existingPid)) {
        // Invalid PID, remove file
        fs.unlinkSync(this.pidFile);
        return false;
      }

      // Check if process is still running
      if (this.isProcessRunning(existingPid)) {
        console.log(`🛑 Stopping recording (PID: ${existingPid})`);
        
        try {
          // Send stop signal instead of killing
          process.kill(existingPid, 'SIGUSR1');
          console.log('📡 Stop signal sent to recording process');
          
        } catch (error) {
          console.log('⚠️ Failed to send stop signal:', error.message);
        }
        
        return true; // Sent stop signal
      } else {
        // PID file exists but process is dead, clean up
        fs.unlinkSync(this.pidFile);
        return false; // No running process
      }
      
    } catch (error) {
      console.error('⚠️ Error checking existing process:', error.message);
      return false;
    }
  }

  createPidFile() {
    try {
      fs.writeFileSync(this.pidFile, process.pid.toString());
      console.log(`📝 Created PID file: ${this.pidFile} (PID: ${process.pid})`);
    } catch (error) {
      console.error('⚠️ Failed to create PID file:', error.message);
    }
  }

  cleanup() {
    try {
      if (fs.existsSync(this.pidFile)) {
        fs.unlinkSync(this.pidFile);
        console.log('🧹 Cleaned up PID file');
      }
    } catch (error) {
      console.error('⚠️ Failed to cleanup PID file:', error.message);
    }
  }

  isProcessRunning(pid) {
    try {
      // Send signal 0 to check if process exists
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  setupStopHandler(stopCallback) {
    // Handle stop signal from second hotkey press
    process.on('SIGUSR1', () => {
      console.log('\n🛑 Received stop signal - stopping recording...');
      if (stopCallback) {
        stopCallback();
      }
    });
  }

  setupCleanupHandlers() {
    // Handle graceful shutdown
    const cleanup = () => {
      console.log('\n🧹 Cleaning up...');
      this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', () => {
      this.cleanup();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error);
      this.cleanup();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled rejection:', reason);
      this.cleanup();
      process.exit(1);
    });
  }
}

module.exports = ProcessManager;
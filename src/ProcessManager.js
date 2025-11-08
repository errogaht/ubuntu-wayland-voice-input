const fs = require('fs');
const path = require('path');

class ProcessManager {
  constructor() {
    this.pidFile = path.join('/tmp', 'voice-input.pid');
  }

  async checkAndStopExisting() {
    try {
      // Check if PID file exists FIRST (fast check)
      if (!fs.existsSync(this.pidFile)) {
        // No PID file = first start, skip heavy orphan cleanup
        return false; // No existing process
      }

      // Only kill orphaned processes if we have a PID file
      // (meaning we're stopping a recording, not starting fresh)
      await this.killOrphanedRecordingProcesses();

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

  /**
   * Kill any orphaned arecord processes from previous crashed sessions
   */
  async killOrphanedRecordingProcesses() {
    try {
      const { execSync } = require('child_process');

      // Find all arecord processes that match our pattern
      const psOutput = execSync('ps aux | grep "arecord.*voice-input" | grep -v grep || true', {
        encoding: 'utf8'
      });

      if (!psOutput || psOutput.trim().length === 0) {
        return; // No orphaned processes
      }

      // Parse PIDs from ps output
      const lines = psOutput.trim().split('\n');
      const orphanedPids = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const pid = parseInt(parts[1]);
          if (!isNaN(pid)) {
            orphanedPids.push(pid);
          }
        }
      }

      // Kill each orphaned process
      for (const pid of orphanedPids) {
        try {
          process.kill(pid, 'SIGTERM');
          console.log(`🧹 Killed orphaned arecord process (PID: ${pid})`);
        } catch (error) {
          // Process might already be dead
        }
      }

    } catch (error) {
      // Ignore errors - this is best-effort cleanup
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
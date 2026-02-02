#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const VoiceInputApp = require('./src/VoiceInputApp');
const ProcessManager = require('./src/ProcessManager');

async function main() {
  console.log('🎤 Voice Input - Starting...');
  console.log('=====================================');

  // Create process manager
  const processManager = new ProcessManager();

  // Check if already running and send stop signal if so
  const sentStopSignal = await processManager.checkAndStopExisting();
  if (sentStopSignal) {
    console.log('🛑 Hotkey pressed while recording - stop signal sent');
    console.log('=====================================');
    process.exit(0);
  }

  // Create PID file for new process
  processManager.createPidFile();

  // Setup cleanup handlers
  processManager.setupCleanupHandlers();

  let app = null;

  try {
    // Create and initialize the application
    // Provider will be auto-detected from environment variables
    app = new VoiceInputApp();

    await app.initialize();

    // Setup stop handler for SIGUSR1 signal and run the voice input session
    let stopRecordingCallback = null;

    processManager.setupStopHandler(() => {
      if (stopRecordingCallback) {
        stopRecordingCallback();
      }
    });

    // Run the voice input session with stop callback
    await app.run((stopHandler) => {
      stopRecordingCallback = stopHandler;
    });

    console.log('✅ Voice input session completed successfully!');
    console.log('=====================================');

    // Daemon mode for Parakeet V3 - keep model in RAM
    const isDaemonMode = process.env.PARAKEET_DAEMON_MODE === 'true' ||
                         process.env.TRANSCRIPTION_PROVIDER === 'parakeetv3';

    if (isDaemonMode) {
      console.log('🔄 Daemon mode: waiting for next hotkey... (Ctrl+C to exit)');
      console.log('   Model stays in RAM for instant transcription!');
      console.log('=====================================');

      // Wait for SIGUSR1 to start next recording
      const waitForNextHotkey = () => {
        return new Promise((resolve) => {
          const handler = () => {
            process.removeListener('SIGUSR1', handler);
            resolve();
          };
          process.on('SIGUSR1', handler);
        });
      };

      // Keep process alive and run sessions in loop
      const daemonLoop = async () => {
        while (true) {
          try {
            // Wait for hotkey to start new recording
            await waitForNextHotkey();

            console.log('\n🎤 New recording session...');
            stopRecordingCallback = null;

            await app.run((stopHandler) => {
              stopRecordingCallback = stopHandler;
            });

            console.log('✅ Session completed!');
            console.log('🔄 Waiting for next hotkey...');

          } catch (error) {
            console.error('❌ Session error:', error.message);
            console.log('🔄 Waiting for next hotkey...');
          }
        }
      };

      daemonLoop();
      return; // Don't exit
    }

    // Normal mode: cleanup and exit
    processManager.cleanup();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Voice input failed:', error.message);
    console.log('=====================================');
    
    // Provide helpful error messages based on common issues
    if (error.message.includes('microphone')) {
      console.log('\n🔧 Troubleshooting microphone issues:');
      console.log('1. Check microphone permissions: pavucontrol');
      console.log('2. List audio devices: arecord -l');
      console.log('3. Test microphone: arecord -d 3 test.wav && aplay test.wav');
    }
    
    if (error.message.includes('clipboard')) {
      console.log('\n🔧 Troubleshooting clipboard issues:');
      console.log('1. Install clipboard tools: sudo apt install xclip wl-clipboard');
      console.log('2. Test clipboard: echo "test" | xclip -selection clipboard');
    }
    
    if (error.message.includes('API') || error.message.includes('provider') || error.message.includes('transcription')) {
      console.log('\n🔧 Troubleshooting transcription provider issues:');
      console.log('1. Check API key in .env file (PALATINE_API_KEY or NEXARA_API_KEY)');
      console.log('2. Set TRANSCRIPTION_PROVIDER in .env (palatine or nexara)');
      console.log('3. Run: node list-providers.js');
      console.log('4. Verify internet connection');
      console.log('5. Check provider API status');
    }
    
    processManager.cleanup();
    process.exit(1);
    
  } finally {
    // Cleanup
    if (app) {
      app.cleanup();
    }
  }
}

// Signal handlers are managed by ProcessManager

// Run the application
if (require.main === module) {
  main();
}
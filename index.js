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
    // Check for required environment variables
    if (!process.env.NEXARA_API_KEY) {
      console.error('❌ Error: NEXARA_API_KEY is required');
      console.log('\nPlease create a .env file with your Nexara API key:');
      console.log('NEXARA_API_KEY=your_api_key_here');
      processManager.cleanup();
      process.exit(1);
    }

    // Create and initialize the application
    app = new VoiceInputApp({
      nexaraApiKey: process.env.NEXARA_API_KEY
    });

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
    
    // Cleanup and exit
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
    
    if (error.message.includes('Nexara') || error.message.includes('API')) {
      console.log('\n🔧 Troubleshooting API issues:');
      console.log('1. Check API key in .env file');
      console.log('2. Verify internet connection');
      console.log('3. Check Nexara API status');
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
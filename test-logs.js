#!/usr/bin/env node

// Test logging functionality
const { createLogger } = require('./src/LogManager');

async function testLogging() {
  console.log('🧪 Testing Log Manager...');
  
  const logger = createLogger();
  
  // Test session logging
  const sessionId = 'test-session-' + Date.now();
  
  logger.logSession(sessionId, 'TEST_START');
  logger.info('Starting log test');
  
  logger.logSession(sessionId, 'RECORDING_START');
  logger.logSession(sessionId, 'RECORDING_SUCCESS', { 
    duration: 5000, 
    audioSize: 123456 
  });
  
  logger.logTranscription(sessionId, 'This is a test transcription', 5000);
  
  logger.logSession(sessionId, 'CLIPBOARD_SUCCESS', { textLength: 30 });
  logger.logSession(sessionId, 'SESSION_COMPLETE');
  
  // Test error logging
  try {
    throw new Error('Test error for logging');
  } catch (error) {
    logger.logError(sessionId, error, 'testing');
  }
  
  logger.warn('This is a warning message');
  logger.debug('This is a debug message');
  
  console.log('\n📋 Recent logs:');
  const recentLogs = logger.getRecentLogs(10);
  recentLogs.forEach(log => console.log('  ' + log));
  
  console.log('\n✅ Logging test completed!');
  console.log('📁 Check var/logs/voice-input.log for full logs');
}

testLogging().catch(console.error);
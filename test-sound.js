#!/usr/bin/env node

// Test simple sound notification
const SimpleSoundNotifier = require('./src/SimpleSoundNotifier');

async function testSound() {
  console.log('🔊 Testing Voice Input Sounds...');
  console.log('===============================\n');
  
  const notifier = new SimpleSoundNotifier();
  await notifier.initialize();
  
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  console.log('🎬 START RECORDING sound...');
  await notifier.playStartRecording();
  await delay(2000);
  
  console.log('🛑 END RECORDING sound...');
  await notifier.playEndRecording();
  await delay(2000);
  
  console.log('📋 TEXT READY sound...');
  await notifier.playTextReady();
  
  console.log('\n✅ Sound test completed!');
  console.log('🎵 You should have heard:');
  console.log('   1. Short pop (start recording)');
  console.log('   2. Long pop (end recording)'); 
  console.log('   3. Short pop again (text ready)');
}

testSound().catch(console.error);
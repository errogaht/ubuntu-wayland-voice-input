#!/usr/bin/env node

/**
 * Test transcription provider with audio file
 * Usage:
 *   node test-provider.js <provider-name> <audio-file>
 *   node test-provider.js nexara ./var/recordings/test.wav
 *   node test-provider.js  # Auto-detect provider and use latest recording
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const ProviderFactory = require('./src/providers/ProviderFactory');

function getLatestRecording() {
  const recordingsDir = path.join(__dirname, 'var', 'recordings');

  if (!fs.existsSync(recordingsDir)) {
    return null;
  }

  const files = fs.readdirSync(recordingsDir)
    .filter(file => file.endsWith('.wav'))
    .map(file => ({
      name: file,
      path: path.join(recordingsDir, file),
      time: fs.statSync(path.join(recordingsDir, file)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  return files.length > 0 ? files[0].path : null;
}

async function testProvider() {
  const providerName = process.argv[2];
  const audioFile = process.argv[3] || getLatestRecording();

  if (!audioFile) {
    console.error('❌ No audio file specified and no recordings found');
    console.error('Usage: node test-provider.js [provider] [audio-file]');
    process.exit(1);
  }

  if (!fs.existsSync(audioFile)) {
    console.error(`❌ Audio file not found: ${audioFile}`);
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           Voice Input - Provider Test                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`📁 Audio file: ${audioFile}`);
  console.log(`📊 File size: ${(fs.statSync(audioFile).size / 1024 / 1024).toFixed(2)} MB`);

  console.log('\n─────────────────────────────────────────────────────────────────\n');

  let provider;

  try {
    if (providerName) {
      console.log(`🔧 Creating provider: ${providerName}`);
      const config = ProviderFactory._buildConfigFromEnv(providerName, process.env);
      provider = ProviderFactory.create(providerName, config);
    } else {
      console.log('🔍 Auto-detecting provider from environment...');
      provider = ProviderFactory.autoDetect(process.env);
    }

    console.log(`✓ Provider initialized: ${provider.constructor.getProviderName()}`);

  } catch (error) {
    console.error('\n❌ Provider initialization failed:', error.message);
    console.error('\nAvailable providers:', ProviderFactory.getAvailableProviders().join(', '));
    console.error('\nProvider requirements:');
    ProviderFactory.getAllRequirements().forEach(req => {
      console.error(`\n${req.name}:`);
      console.error(`  Required: ${req.configKeys.join(', ')}`);
      if (req.optionalKeys) {
        console.error(`  Optional: ${req.optionalKeys.join(', ')}`);
      }
    });
    process.exit(1);
  }

  console.log('\n─────────────────────────────────────────────────────────────────\n');

  const startTime = Date.now();

  console.log('🎤 Starting transcription...\n');

  try {
    const audioBuffer = fs.readFileSync(audioFile);
    const text = await provider.transcribe(audioBuffer);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n─────────────────────────────────────────────────────────────────\n');
    console.log('✅ SUCCESS!');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📝 Text length: ${text.length} characters`);
    console.log(`\n📄 Transcription:\n${text}`);
    console.log('\n─────────────────────────────────────────────────────────────────\n');

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n─────────────────────────────────────────────────────────────────\n');
    console.error('❌ FAILED!');
    console.error(`⏱️  Duration: ${duration}s`);
    console.error(`🚫 Error: ${error.message}`);

    if (error.code) {
      console.error(`📟 Code: ${error.code}`);
    }

    if (error.response) {
      console.error(`🌐 HTTP Status: ${error.response.status}`);
      console.error(`📡 Response: ${JSON.stringify(error.response.data)}`);
    }

    console.log('\n─────────────────────────────────────────────────────────────────\n');
    process.exit(1);
  }
}

// Run test
testProvider();

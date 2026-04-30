#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const VoiceInputApp = require('./src/VoiceInputApp');
const AudioFileProcessor = require('./src/AudioFileProcessor');

function printUsage() {
  console.error('Usage: node transcribe-files.js <audio-file...>');
  console.error(`Supported extensions: ${AudioFileProcessor.getSupportedExtensions().join(', ')}`);
}

/**
 * File transcription CLI for Nautilus and direct shell use.
 * Validation lives here before app startup so bad selections fail quickly and
 * with clear errors, while successful runs reuse the same VoiceInputApp flow as
 * microphone transcription after audio bytes are prepared.
 */
async function main() {
  const args = process.argv.slice(2);
  const validateOnly = args[0] === '--validate-only';
  const filePaths = validateOnly ? args.slice(1) : args;

  if (filePaths.length === 0) {
    printUsage();
    process.exit(1);
  }

  const sortedFiles = AudioFileProcessor.validateAndSortFiles(filePaths);

  if (validateOnly) {
    console.log('✅ Audio file selection is valid:');
    sortedFiles.forEach((filePath, index) => {
      console.log(`  ${index + 1}. ${filePath}`);
    });
    return;
  }

  console.log('🎧 Voice Input - Transcribe Audio Files');
  console.log('=======================================');

  let app = null;
  try {
    app = new VoiceInputApp();
    await app.runFromAudioFiles(sortedFiles);
    console.log('=======================================');
    console.log('✅ Audio file transcription completed successfully!');
  } catch (error) {
    console.error('❌ Audio file transcription failed:', error.message);
    console.log('=======================================');
    process.exit(1);
  } finally {
    if (app) {
      app.cleanup();
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

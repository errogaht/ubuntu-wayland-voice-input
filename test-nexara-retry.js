#!/usr/bin/env node

const fs = require('fs');
require('dotenv').config();
const NexaraTranscriber = require('./src/NexaraTranscriber');

async function testTranscription() {
  const audioFile = process.argv[2] || '/home/errogaht/aiprojects/voice-input/var/recordings/mgzhobkbbj3jg.wav';

  console.log(`Testing transcription with file: ${audioFile}`);
  console.log(`File size: ${(fs.statSync(audioFile).size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`API Key: ${process.env.NEXARA_API_KEY ? '✓ Found' : '✗ Missing'}`);
  console.log('Starting transcription...\n');

  const startTime = Date.now();

  try {
    const audioBuffer = fs.readFileSync(audioFile);
    const transcriber = new NexaraTranscriber(process.env.NEXARA_API_KEY);

    const text = await transcriber.transcribe(audioBuffer);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n✓ SUCCESS!');
    console.log(`Duration: ${duration}s`);
    console.log(`Text (${text.length} chars):\n${text}`);

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.error('\n✗ FAILED!');
    console.error(`Duration: ${duration}s`);
    console.error(`Error: ${error.message}`);

    if (error.code) {
      console.error(`Code: ${error.code}`);
    }

    process.exit(1);
  }
}

testTranscription();

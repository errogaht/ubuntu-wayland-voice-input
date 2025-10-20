/**
 * Transcription Providers Index
 * Export all providers and factory for easy importing
 */

const TranscriptionProvider = require('./TranscriptionProvider');
const NexaraProvider = require('./NexaraProvider');
const PalatineProvider = require('./PalatineProvider');
const ProviderFactory = require('./ProviderFactory');

module.exports = {
  TranscriptionProvider,
  NexaraProvider,
  PalatineProvider,
  ProviderFactory
};

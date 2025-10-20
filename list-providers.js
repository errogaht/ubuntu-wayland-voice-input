#!/usr/bin/env node

/**
 * List available transcription providers and their requirements
 */

const ProviderFactory = require('./src/providers/ProviderFactory');

console.log('╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║         Voice Input - Available Transcription Providers              ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

const providers = ProviderFactory.getAvailableProviders();

console.log(`📦 Total providers: ${providers.length}\n`);

providers.forEach((providerName, index) => {
  const requirements = ProviderFactory.getProviderRequirements(providerName);

  console.log(`${index + 1}. ${requirements.name}`);
  console.log('   ─────────────────────────────────────────────────────────────────');
  console.log(`   Provider ID: ${providerName}`);
  console.log(`   Required env variables: ${requirements.configKeys.join(', ')}`);

  if (requirements.optionalKeys && requirements.optionalKeys.length > 0) {
    console.log(`   Optional env variables: ${requirements.optionalKeys.join(', ')}`);
  }

  console.log(`\n   ${requirements.documentation.replace(/\n/g, '\n   ')}`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════════════\n');
console.log('Usage:');
console.log('  1. Set required environment variables in .env file');
console.log('  2. Optionally set TRANSCRIPTION_PROVIDER=<provider_id>');
console.log('  3. If not set, the system will auto-detect from available API keys\n');

console.log('Example .env configuration:');
console.log('  TRANSCRIPTION_PROVIDER=nexara');
console.log('  NEXARA_API_KEY=your_api_key_here\n');

console.log('For more information, see: docs/ADDING_PROVIDERS.md\n');

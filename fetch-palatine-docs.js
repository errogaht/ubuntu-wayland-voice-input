#!/usr/bin/env node

const https = require('https');

const urls = [
  'https://docs.speech.palatine.ru/documentation/quick_start/quick_start',
  'https://docs.speech.palatine.ru/documentation/technical_information/polling_principles'
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function extractDocs() {
  for (const url of urls) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Fetching: ${url}`);
    console.log('='.repeat(70));

    try {
      const html = await fetchUrl(url);

      // Extract code blocks
      const codeRegex = /<code[^>]*>(.*?)<\/code>/gs;
      const matches = [...html.matchAll(codeRegex)];

      console.log(`\nFound ${matches.length} code blocks:\n`);

      matches.slice(0, 15).forEach((match, i) => {
        let code = match[1]
          .replace(/&quot;/g, '"')
          .replace(/&gt;/g, '>')
          .replace(/&lt;/g, '<')
          .replace(/&#x27;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/<[^>]+>/g, '')
          .trim();

        if (code.length > 10 && code.length < 500) {
          console.log(`[${i + 1}] ${code}`);
          console.log('-'.repeat(70));
        }
      });

      // Extract text that mentions API or curl
      const apiMatches = html.match(/[^<>]{0,100}(curl|POST|api\.speech|v1\/audio)[^<>]{0,100}/gi);
      if (apiMatches) {
        console.log('\n\nAPI-related text:');
        apiMatches.slice(0, 10).forEach((m, i) => {
          console.log(`[${i + 1}] ${m.trim()}`);
        });
      }

    } catch (error) {
      console.error(`Error fetching ${url}:`, error.message);
    }
  }
}

extractDocs();

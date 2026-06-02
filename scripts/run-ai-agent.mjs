#!/usr/bin/env node
/**
   * scripts/run-ai-agent.mjs
   * GDN AI (Gideon) Organism - Agent Runner
   *
   * Called by GitHub Actions. Runs the improvement agent, which applies
   * SEO/copy patches to the live homepage and writes a run summary.
   */

import { writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { runImprovementAgent, formatSummary } = require('../lib/ai-agent.js');

async function main() {
    console.log('[runner] GDN AI Organism starting...');
    console.log('[runner] Time:', new Date().toISOString());

  let improvements = [];
    try {
          improvements = await runImprovementAgent();
          console.log('[runner] Generated', improvements.length, 'improvements');
    } catch (err) {
          console.error('[runner] AI agent failed:', err.message);
          process.exit(1);
    }

  const output = {
        runDate: new Date().toISOString(),
        siteUrl: 'https://gdn-ai.com',
        improvements,
  };
    writeFileSync('ai-improvements.json', JSON.stringify(output, null, 2));
    writeFileSync('agent-output.txt', formatSummary(improvements));
    console.log('[runner] Results written.');

  console.log('\n=== GDN AI ORGANISM SUMMARY ===');
    improvements.forEach((imp, i) => {
          console.log((i + 1) + '. ' + imp.areaName + ' [' + imp.urgencyLevel + ']');
    });
    console.log('\n[runner] Done.');
}

main().catch(err => {
    console.error('[runner] Fatal error:', err);
    process.exit(1);
});

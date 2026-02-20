// ============================================================
// tests/run-tests.js — Test runner (no external deps)
// ============================================================

import { runParserTests }   from './parser.test.js';
import { runRendererTests } from './renderer.test.js';
import { runStorageTests }  from './storage.test.js';
import { runSortingTests }  from './sorting.test.js';

const suites = [
  { name: 'Parser',   fn: runParserTests },
  { name: 'Renderer', fn: runRendererTests },
  { name: 'Storage',  fn: runStorageTests },
  { name: 'Sorting',  fn: runSortingTests },
];

let totalPass = 0, totalFail = 0;

for (const { name, fn } of suites) {
  console.log(`\n${'━'.repeat(38)}`);
  console.log(`  Suite: ${name}`);
  console.log('━'.repeat(38));
  const { pass, fail } = await fn();
  totalPass += pass; totalFail += fail;
}

console.log(`\n${'═'.repeat(38)}`);
console.log(`  TOTAL: ${totalPass} passed, ${totalFail} failed`);
console.log('═'.repeat(38));
if (totalFail > 0) process.exit(1);

#!/usr/bin/env node
import { runSporeConformanceSuite } from '../src/federation/conformance.js';

runSporeConformanceSuite().catch(err => {
  console.error('\n❌ Conformance Suite Failed:', err);
  process.exit(1);
});

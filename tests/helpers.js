// ============================================================
// tests/helpers.js — Shared assertion helpers
// ============================================================

export function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

export function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}\n  Expected: ${e}\n  Actual:   ${a}`);
}

export function assertNull(val, msg) {
  if (val != null) throw new Error(`${msg} — expected null, got: ${JSON.stringify(val)}`);
}

export function assertNotNull(val, msg) {
  if (val == null) throw new Error(`${msg} — expected a value, got null/undefined`);
}

export async function runSuite(name, cases) {
  let pass = 0, fail = 0;
  for (const { name: n, fn } of cases) {
    try {
      await fn();
      console.log(`  ✅ ${n}`);
      pass++;
    } catch (err) {
      console.error(`  ❌ ${n}`);
      console.error(`     ${err.message.split('\n').join('\n     ')}`);
      fail++;
    }
  }
  console.log(`\n  ${name}: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

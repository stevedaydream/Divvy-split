import { spawnSync } from 'node:child_process'

const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/tripLifecycle.test.ts', '--testTimeout=30000'], {
  stdio: 'inherit',
  env: { ...process.env, DIVVY_EMULATOR_TEST: '1' },
})
process.exit(result.status ?? 1)

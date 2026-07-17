import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    env: {
      TEXT_LLM_API_KEY: '',
      XAI_API_KEY: '',
      MULTIMODAL_API_KEY: '',
      ASR_API_KEY: '',
    },
    setupFiles: ['./src/test-setup.ts'],
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/**', 'ios/**', 'android/**', '.expo/**'],
  },
  {
    // Deterministic guards against common LLM failure modes:
    // sprawling functions, deep nesting, and unstructured complexity.
    rules: {
      // New compiler-powered rule; too aggressive about Date.now()-during-render
      // patterns this codebase uses deliberately. Warn, don't block.
      'react-hooks/purity': 'warn',
      // The four rules below are temporarily 'warn' instead of 'error':
      // the app is in App Store review (2026-07) and existing source must not
      // be modified until approval. Tracked in #5 — ratchet back to 'error'
      // (and fix the code) after approval.
      complexity: ['warn', 15], // #5
      'max-depth': ['error', 5],
      'max-lines-per-function': [
        'warn', // #5
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      'max-lines': ['error', { max: 1000, skipBlankLines: true, skipComments: true }],
      'react-hooks/set-state-in-effect': 'warn', // #5
      'react/no-unescaped-entities': 'warn', // #5
    },
  },
]);

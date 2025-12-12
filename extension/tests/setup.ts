// Test setup file for Jest
// Configure fast-check for property-based testing

import fc from 'fast-check';

// Configure fast-check to run minimum 100 iterations per test
fc.configureGlobal({
  numRuns: 100,
  verbose: false,
  seed: 42, // For reproducible tests
  endOnFailure: true
});

// Global test timeout
jest.setTimeout(30000);
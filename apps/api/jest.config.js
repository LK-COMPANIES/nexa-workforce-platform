/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  // Unit tests only — mocked dependencies, no live database required.
  // DB-backed integration specs live in test/*.integration.spec.ts and run
  // via `npm run test:integration` (see test/integration.jest.config.js).
  testMatch: ["<rootDir>/src/**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
};

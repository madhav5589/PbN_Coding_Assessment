import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          // Jest runs in CommonJS; override the "bundler" moduleResolution that
          // Next.js uses since ts-jest needs standard Node module resolution.
          module: "commonjs",
          moduleResolution: "node",
        },
      },
    ],
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
};

export default config;

/** @type {import('jest').Config} */
const config = {
    // Don't use jest-expo preset - it includes problematic react-native setup.js with Flow types
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    },
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
    testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    collectCoverageFrom: [
        'services/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'utils/**/*.{ts,tsx}',
        '!**/*.d.ts',
        '!**/node_modules/**',
    ],
    coverageThreshold: {
        global: {
            branches: 60,
            functions: 60,
            lines: 60,
            statements: 60,
        },
    },
};

module.exports = config;

export default {
  globals: { __CLASSIFICATION_PREVIEW__: true },
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  testEnvironment: 'jest-fixed-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  testPathIgnorePatterns: ['/node_modules/', '/cypress/'],
  moduleNameMapper: {
    '^(app|pages|widgets|features|entities|shared)/(.*)$': '<rootDir>/src/$1/$2',
    '.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  modulePaths: ['<rootDir>/src/'],
};

export default {
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
    '.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  modulePaths: ['<rootDir>/src/'],
};

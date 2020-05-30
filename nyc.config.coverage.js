const defaultConfig = require('./nyc.config');

module.exports = Object.assign({}, defaultConfig, {
  'check-coverage': true,
  'skip-full': true,
  all: true,
  branches: 100,
  functions: 100,
  lines: 100,
  reporter: ['html'],
  statements: 100,
});

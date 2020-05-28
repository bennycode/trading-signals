const defaultConfig = require('./nyc.config');

module.exports = Object.assign({}, defaultConfig, {
  all: true,
  branches: 100,
  'check-coverage': true,
  functions: 100,
  lines: 100,
  reporter: ['html'],
  statements: 100,
});

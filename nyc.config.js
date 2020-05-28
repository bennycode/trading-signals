module.exports = {
  all: false,
  'check-coverage': false,
  exclude: ['**/*.d.ts', '**/*.test*.ts', '**/index.ts', '**/start.ts'],
  extension: ['.ts'],
  include: ['src/**/*.ts'],
  'per-file': false,
  reporter: ['text-summary'],
  require: ['ts-node/register'],
};

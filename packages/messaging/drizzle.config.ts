import {defineConfig} from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
});

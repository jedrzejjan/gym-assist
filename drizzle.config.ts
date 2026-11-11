import type { Config } from 'drizzle-kit';

export default {
  dialect: 'sqlite',
  driver: 'expo',
  schema: './data/schema.ts',
  out: './data/migrations',
} satisfies Config;

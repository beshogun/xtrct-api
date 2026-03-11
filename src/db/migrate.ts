import { sql } from './index.ts';
import { readFileSync } from 'fs';
import { join } from 'path';

const schema = readFileSync(join(import.meta.dir, 'schema.sql'), 'utf-8');

// Split on semicolons but keep transaction-safe
const statements = schema
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

for (const stmt of statements) {
  await sql.unsafe(stmt);
  process.stdout.write('.');
}

console.log('\nMigration complete.');
await sql.end();

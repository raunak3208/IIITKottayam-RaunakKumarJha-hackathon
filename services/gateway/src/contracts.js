import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

export function loadValidator(dir, name) {
  const schema = JSON.parse(readFileSync(join(dir, `${name}.v1.schema.json`), 'utf8'));
  return ajv.compile(schema);
}

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'contracts');
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const validators = new Map();
const validatorFor = (name) => {
  if (!validators.has(name)) {
    validators.set(name, ajv.compile(read(join(root, `${name}.v1.schema.json`))));
  }
  return validators.get(name);
};
let failed = 0;

for (const file of readdirSync(join(root, 'examples')).sort()) {
  const [name, kind] = file.split('.');
  const validate = validatorFor(name);
  const passed = validate(read(join(root, 'examples', file)));
  const expected = kind === 'valid';
  const ok = passed === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${file}`);
  if (!ok && expected) console.log(validate.errors);
}

process.exit(failed ? 1 : 0);

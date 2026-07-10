// validate.mjs — compact JSON Schema (draft-07 subset) validator. Zero deps.
// Supports: type, required, properties, additionalProperties(false), enum, pattern,
// minLength, minItems, minimum, maximum, items, $ref (local, ignored/loaded by caller).

function typeOf(v) {
  if (Array.isArray(v)) return 'array';
  if (v === null) return 'null';
  if (Number.isInteger(v)) return 'integer';
  return typeof v; // string, number, boolean, object
}

function typeMatches(v, t) {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  if (t === 'integer') return actual === 'integer';
  return actual === t;
}

export function validate(data, schema, pathStr = '') {
  const errors = [];
  const at = pathStr || '(root)';

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(t => typeMatches(data, t))) {
      errors.push(`${at}: expected type ${types.join('|')}, got ${typeOf(data)}`);
      return errors; // no point checking further
    }
  }

  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${at}: value ${JSON.stringify(data)} not in enum [${schema.enum.join(', ')}]`);
  }

  if (typeof data === 'string') {
    if (schema.minLength != null && data.length < schema.minLength)
      errors.push(`${at}: string shorter than minLength ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(data))
      errors.push(`${at}: string does not match pattern ${schema.pattern}`);
  }

  if (typeof data === 'number') {
    if (schema.minimum != null && data < schema.minimum)
      errors.push(`${at}: ${data} < minimum ${schema.minimum}`);
    if (schema.maximum != null && data > schema.maximum)
      errors.push(`${at}: ${data} > maximum ${schema.maximum}`);
  }

  if (typeOf(data) === 'array') {
    if (schema.minItems != null && data.length < schema.minItems)
      errors.push(`${at}: array shorter than minItems ${schema.minItems}`);
    if (schema.items)
      data.forEach((item, i) => errors.push(...validate(item, schema.items, `${at}[${i}]`)));
  }

  if (typeOf(data) === 'object') {
    if (schema.required)
      for (const key of schema.required)
        if (!(key in data)) errors.push(`${at}: missing required property '${key}'`);

    if (schema.properties)
      for (const [key, sub] of Object.entries(schema.properties))
        if (key in data) errors.push(...validate(data[key], sub, `${at}.${key}`));

    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(data))
        if (!allowed.has(key)) errors.push(`${at}: unexpected property '${key}'`);
    }
  }

  return errors;
}

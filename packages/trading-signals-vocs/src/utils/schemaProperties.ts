import {z} from 'zod';

export interface SchemaProperty {
  name: string;
  type: string;
  required: boolean;
  enum?: string[];
  pattern?: string;
}

type JsonSchemaNode = z.core.JSONSchema.JSONSchema;

function collectProperties(node: JsonSchemaNode, requiredSet: Set<string>, result: Map<string, SchemaProperty>): void {
  if (node.properties) {
    for (const [name, prop] of Object.entries(node.properties)) {
      // `true`/`false` are valid JSON Schema sub-schemas but carry no property metadata.
      if (typeof prop === 'boolean' || prop.not) {
        continue;
      }
      if (result.has(name)) {
        continue;
      }
      result.set(name, {
        name,
        required: requiredSet.has(name) && prop.default === undefined,
        type: formatType(prop),
        ...(prop.enum && {enum: prop.enum.map(String)}),
        ...(prop.pattern && {pattern: prop.pattern}),
      });
    }
  }

  if (node.allOf) {
    for (const child of node.allOf) {
      const childRequired = new Set(child.required ?? []);
      collectProperties(child, childRequired, result);
    }
  }

  if (node.anyOf) {
    for (const child of node.anyOf) {
      collectProperties(child, new Set(), result);
    }
  }
}

function formatType(prop: JsonSchemaNode) {
  if (prop.enum) {
    return prop.enum.map(v => `"${String(v)}"`).join(' | ');
  }
  if (prop.type === 'object') {
    return 'object';
  }
  if (prop.pattern) {
    return 'string (numeric)';
  }
  if (Array.isArray(prop.type)) {
    return prop.type.join(' | ');
  }
  return prop.type ?? 'unknown';
}

export function extractProperties(schema: z.ZodType): SchemaProperty[] {
  const jsonSchema = z.toJSONSchema(schema);
  const result = new Map<string, SchemaProperty>();
  const topRequired = new Set(jsonSchema.required ?? []);
  collectProperties(jsonSchema, topRequired, result);
  return Array.from(result.values());
}

export function extractNestedProperties(schema: z.ZodType, key: string): SchemaProperty[] {
  const jsonSchema = z.toJSONSchema(schema);

  function findNested(node: JsonSchemaNode): JsonSchemaNode | undefined {
    const property = node.properties?.[key];
    if (property !== undefined && typeof property !== 'boolean') {
      return property;
    }
    // Intersections (`.and()`) serialize to `allOf`, unions to `anyOf`; the key can sit in either.
    for (const child of [...(node.allOf ?? []), ...(node.anyOf ?? [])]) {
      const found = findNested(child);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  const nested = findNested(jsonSchema);
  if (!nested) {
    return [];
  }
  const result = new Map<string, SchemaProperty>();
  const nestedRequired = new Set(nested.required ?? []);
  collectProperties(nested, nestedRequired, result);
  return Array.from(result.values());
}

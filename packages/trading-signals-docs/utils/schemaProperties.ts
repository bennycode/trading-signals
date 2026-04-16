import {z} from 'zod';

export interface SchemaProperty {
  name: string;
  type: string;
  required: boolean;
  enum?: string[];
  pattern?: string;
}

interface JsonSchemaNode {
  type?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  default?: unknown;
  enum?: string[];
  pattern?: string;
  allOf?: JsonSchemaNode[];
  anyOf?: JsonSchemaNode[];
  not?: Record<string, unknown>;
  additionalProperties?: boolean;
}

function collectProperties(
  node: JsonSchemaNode,
  requiredSet: Set<string>,
  result: Map<string, SchemaProperty>
): void {
  if (node.properties) {
    for (const [name, prop] of Object.entries(node.properties)) {
      if (prop.not) continue;
      if (result.has(name)) continue;
      result.set(name, {
        name,
        type: formatType(prop),
        required: requiredSet.has(name) && prop.default === undefined,
        ...(prop.enum && {enum: prop.enum}),
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

function formatType(prop: JsonSchemaNode): string {
  if (prop.enum) return prop.enum.map(v => `"${v}"`).join(' | ');
  if (prop.type === 'object') return 'object';
  if (prop.pattern) return 'string (numeric)';
  return prop.type ?? 'unknown';
}

export function extractProperties(schema: z.ZodType): SchemaProperty[] {
  const jsonSchema = z.toJSONSchema(schema) as JsonSchemaNode;
  const result = new Map<string, SchemaProperty>();
  const topRequired = new Set(jsonSchema.required ?? []);
  collectProperties(jsonSchema, topRequired, result);
  return Array.from(result.values());
}

export function extractNestedProperties(schema: z.ZodType, key: string): SchemaProperty[] {
  const jsonSchema = z.toJSONSchema(schema) as JsonSchemaNode;

  function findNested(node: JsonSchemaNode): JsonSchemaNode | undefined {
    if (node.properties?.[key]) return node.properties[key];
    for (const child of node.allOf ?? []) {
      const found = findNested(child);
      if (found) return found;
    }
    return undefined;
  }

  const nested = findNested(jsonSchema);
  if (!nested) return [];
  const result = new Map<string, SchemaProperty>();
  const nestedRequired = new Set(nested.required ?? []);
  collectProperties(nested, nestedRequired, result);
  return Array.from(result.values());
}

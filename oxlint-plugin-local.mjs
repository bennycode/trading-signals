/*
 * House rules that Oxlint has no built-in equivalent for. Previously expressed as
 * `no-restricted-syntax` esquery selectors in `eslint.config.base.ts`; Oxlint has no esquery
 * support, so they are re-implemented here as plain AST visitors.
 */

const PRIMITIVE_KEYWORDS = new Set(['TSBigIntKeyword', 'TSBooleanKeyword', 'TSNumberKeyword', 'TSStringKeyword']);

function isPromiseOfPrimitive(typeNode) {
  return (
    typeNode.type === 'TSTypeReference' &&
    typeNode.typeName?.type === 'Identifier' &&
    typeNode.typeName.name === 'Promise' &&
    typeNode.typeArguments?.params?.length === 1 &&
    PRIMITIVE_KEYWORDS.has(typeNode.typeArguments.params[0].type)
  );
}

/**
 * Explicit primitive return types restate what TypeScript already infers, so they add maintenance
 * cost without adding safety. `void`/`Promise<void>` are deliberately allowed: they document that a
 * function is called for its side effect, which inference alone does not convey.
 */
const noPrimitiveReturnType = {
  create(context) {
    function check(node) {
      // Body-less signatures (abstract methods, interface members, overloads) genuinely need the annotation.
      if (!node.body || !node.returnType) {
        return;
      }

      const typeNode = node.returnType.typeAnnotation;

      if (PRIMITIVE_KEYWORDS.has(typeNode.type)) {
        context.report({
          message: 'Drop the explicit primitive return type and rely on inference.',
          node: node.returnType,
        });
      } else if (isPromiseOfPrimitive(typeNode)) {
        context.report({
          message: 'Drop the explicit Promise<primitive> return type and rely on inference.',
          node: node.returnType,
        });
      }
    }

    return {
      ArrowFunctionExpression: check,
      FunctionDeclaration: check,
      FunctionExpression: check,
    };
  },
};

export default {
  meta: {name: 'local'},
  rules: {'no-primitive-return-type': noPrimitiveReturnType},
};

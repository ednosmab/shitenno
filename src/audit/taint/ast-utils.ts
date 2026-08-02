import * as ts from "typescript";
import type { TaintNode } from "./types.js";
import type { TaintSourceDef } from "./types.js";

export interface VariableInfo {
  name: string;
  tainted: boolean;
  source?: TaintSourceDef;
  declarations: ts.Node[];
}

/** Extract the full name of a property access expression (e.g., "req.body.user") */
export function getPropertyAccessName(node: ts.PropertyAccessExpression): string {
  const parts: string[] = [];
  let current: ts.Node = node;
  while (ts.isPropertyAccessExpression(current)) {
    parts.unshift(current.name.getText());
    current = current.expression;
  }
  if (ts.isIdentifier(current)) {
    parts.unshift(current.getText());
  }
  return parts.join(".");
}

/** Get the name of a function being called */
export function getCallName(node: ts.CallExpression): string {
  if (ts.isPropertyAccessExpression(node.expression)) {
    return getPropertyAccessName(node.expression);
  }
  if (ts.isIdentifier(node.expression)) {
    return node.expression.getText();
  }
  return "";
}

export function resolveSymbolFromWrapper(node: ts.Node, getSymbolName: (n: ts.Node) => string | undefined): string | undefined {
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) {
    return getSymbolName(node.expression);
  }
  return undefined;
}

export function resolveSymbolFromBinary(node: ts.Node, variableTaint: Map<string, VariableInfo>, getSymbolName: (n: ts.Node) => string | undefined): string | undefined {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.PlusToken) {
    return undefined;
  }
  const left = getSymbolName(node.left);
  const right = getSymbolName(node.right);
  if (left && variableTaint.get(left)?.tainted) return left;
  if (right && variableTaint.get(right)?.tainted) return right;
  return undefined;
}

export function resolveSymbolFromTemplate(node: ts.Node, variableTaint: Map<string, VariableInfo>, getSymbolName: (n: ts.Node) => string | undefined): string | undefined {
  if (!ts.isTemplateExpression(node)) return undefined;
  for (const span of node.templateSpans) {
    const name = getSymbolName(span.expression);
    if (name && variableTaint.get(name)?.tainted) return name;
  }
  return undefined;
}

export function resolveSymbolFromNode(node: ts.Node, checker: ts.TypeChecker, getPropertyAccessNameFn: (n: ts.PropertyAccessExpression) => string): string | undefined {
  if (ts.isPropertyAccessExpression(node)) return getPropertyAccessNameFn(node);
  if (ts.isElementAccessExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    return getPropertyAccessNameFn(node.expression);
  }
  const symbol = checker.getSymbolAtLocation(node);
  if (symbol) return symbol.getName();
  if (ts.isIdentifier(node)) return node.getText();
  return undefined;
}

/** Get the symbol name for a variable reference */
export function getSymbolName(
  node: ts.Node,
  checker: ts.TypeChecker,
  variableTaint: Map<string, VariableInfo>
): string | undefined {
  const getPropertyAccessNameBound = (n: ts.PropertyAccessExpression) => getPropertyAccessName(n);
  const getSymbolNameBound = (n: ts.Node) => getSymbolName(n, checker, variableTaint);

  return resolveSymbolFromWrapper(node, getSymbolNameBound)
    ?? resolveSymbolFromBinary(node, variableTaint, getSymbolNameBound)
    ?? resolveSymbolFromTemplate(node, variableTaint, getSymbolNameBound)
    ?? resolveSymbolFromNode(node, checker, getPropertyAccessNameBound);
}

export interface TaintNodeParams {
  variableName: string;
  kind: "source" | "sink" | "assignment";
  text: string;
  tsNode: ts.Node;
  nextNodeId: () => string;
}

export function createTaintNodeAt(params: TaintNodeParams): TaintNode {
  const { variableName, kind, text, tsNode, nextNodeId } = params;
  const sourceFile = tsNode.getSourceFile();
  const nodeId = nextNodeId();
  const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, tsNode.getStart());
  return {
    id: nodeId,
    kind,
    variableName,
    sourceFile: sourceFile.fileName,
    line: line + 1,
    column: character + 1,
    text,
  };
}

export function findExistingSourceNode(
  variableName: string,
  graph: { getNodes(): TaintNode[] }
): TaintNode | undefined {
  return graph.getNodes().find(
    (n) => (n.kind === "source" || n.kind === "assignment") && n.variableName === variableName,
  );
}

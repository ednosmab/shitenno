/**
 * ast-visitor.ts — AST Visitor for Taint Analysis
 *
 * Handles symbol resolution, source/sink visiting, taint propagation,
 * and variable tracking across the TypeScript AST.
 */

import * as ts from "typescript";
import type { TaintNode } from "./types.js";
import { isTaintSource } from "./sources.js";
import { findTaintSink } from "./sinks.js";
import type { TaintSourceDef } from "./types.js";
import { DataFlowGraph } from "./graph.js";

export interface VariableInfo {
  name: string;
  tainted: boolean;
  source?: TaintSourceDef;
  declarations: ts.Node[];
}

export interface AstVisitorContext {
  graph: DataFlowGraph;
  variableTaint: Map<string, VariableInfo>;
  nodeCounter?: number;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
  nextNodeId: () => string;
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

function resolveSymbolFromWrapper(node: ts.Node, getSymbolName: (n: ts.Node) => string | undefined): string | undefined {
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) {
    return getSymbolName(node.expression);
  }
  return undefined;
}

function resolveSymbolFromBinary(node: ts.Node, variableTaint: Map<string, VariableInfo>, getSymbolName: (n: ts.Node) => string | undefined): string | undefined {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.PlusToken) {
    return undefined;
  }
  const left = getSymbolName(node.left);
  const right = getSymbolName(node.right);
  if (left && variableTaint.get(left)?.tainted) return left;
  if (right && variableTaint.get(right)?.tainted) return right;
  return undefined;
}

function resolveSymbolFromTemplate(node: ts.Node, variableTaint: Map<string, VariableInfo>, getSymbolName: (n: ts.Node) => string | undefined): string | undefined {
  if (!ts.isTemplateExpression(node)) return undefined;
  for (const span of node.templateSpans) {
    const name = getSymbolName(span.expression);
    if (name && variableTaint.get(name)?.tainted) return name;
  }
  return undefined;
}

function resolveSymbolFromNode(node: ts.Node, checker: ts.TypeChecker, getPropertyAccessNameFn: (n: ts.PropertyAccessExpression) => string): string | undefined {
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
  graph: DataFlowGraph
): TaintNode | undefined {
  return graph.getNodes().find(
    (n) => (n.kind === "source" || n.kind === "assignment") && n.variableName === variableName,
  );
}

export function visitSource(
  node: ts.Node,
  ctx: Pick<AstVisitorContext, "graph" | "variableTaint" | "nextNodeId">
): void {
  let sourceNode: ts.PropertyAccessExpression | undefined;

  if (ts.isPropertyAccessExpression(node)) {
    sourceNode = node;
  } else if (ts.isElementAccessExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    sourceNode = node.expression;
  }

  if (!sourceNode) return;

  const fullName = getPropertyAccessName(sourceNode);
  const sourceDef = isTaintSource(fullName);
  if (!sourceDef) return;

  const taintNode = createTaintNodeAt({ variableName: fullName, kind: "source", text: fullName, tsNode: node, nextNodeId: ctx.nextNodeId });
  ctx.graph.addNode(taintNode);

  ctx.variableTaint.set(fullName, {
    name: fullName,
    tainted: true,
    source: sourceDef,
    declarations: [],
  });
}

export function findTaintedArgument(
  node: ts.CallExpression,
  variableTaint: Map<string, VariableInfo>,
  checker: ts.TypeChecker
): string | undefined {
  for (const arg of node.arguments) {
    const argName = getSymbolName(arg, checker, variableTaint);
    if (argName && variableTaint.get(argName)?.tainted) {
      return argName;
    }
  }
  return undefined;
}

export function visitSink(
  node: ts.CallExpression,
  ctx: Pick<AstVisitorContext, "graph" | "variableTaint" | "checker" | "nextNodeId">
): void {
  const funcName = getCallName(node);
  const sinkDef = findTaintSink(funcName);
  if (!sinkDef) return;

  const sourceVar = findTaintedArgument(node, ctx.variableTaint, ctx.checker);
  const taintNode = createTaintNodeAt({ variableName: funcName, kind: "sink", text: funcName, tsNode: node, nextNodeId: ctx.nextNodeId });
  ctx.graph.addNode(taintNode);

  if (!sourceVar) return;
  const sourceNode = findExistingSourceNode(sourceVar, ctx.graph);
  if (sourceNode) {
    ctx.graph.addEdge({ from: sourceNode.id, to: taintNode.id, kind: "parameter" });
  }
}

function isFunctionLikeDeclaration(declaration: ts.Node): boolean {
  return ts.isFunctionDeclaration(declaration)
    || ts.isArrowFunction(declaration)
    || ts.isMethodDeclaration(declaration)
    || ts.isFunctionExpression(declaration);
}

export function propagateTaintAtCall(
  node: ts.CallExpression,
  variableTaint: Map<string, VariableInfo>,
  checker: ts.TypeChecker
): void {
  const signature = checker.getResolvedSignature(node);
  const declaration = signature?.getDeclaration();
  if (!declaration || !isFunctionLikeDeclaration(declaration)) return;

  node.arguments.forEach((arg, index) => {
    const argName = getSymbolName(arg, checker, variableTaint);
    const argInfo = argName ? variableTaint.get(argName) : undefined;
    if (!argInfo?.tainted) return;
    const param = declaration.parameters[index];
    if (!param) return;
    const paramName = param.name.getText();
    variableTaint.set(paramName, {
      name: paramName,
      tainted: true,
      source: argInfo.source,
      declarations: [param],
    });
  });
}

export function handleCommanderAction(
  node: ts.CallExpression,
  variableTaint: Map<string, VariableInfo>
): void {
  if (!ts.isPropertyAccessExpression(node.expression)) return;
  if (node.expression.name.text !== "action") return;
  const callback = node.arguments[0];
  if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) return;
  const param = callback.parameters[0];
  if (!param) return;
  const paramName = param.name.getText();
  variableTaint.set(paramName, {
    name: paramName,
    tainted: true,
    source: { pattern: /^opts$/, kind: "parameter", description: "Commander .action() callback parameter" },
    declarations: [param],
  });
}

export function visitAssignment(
  node: ts.BinaryExpression,
  ctx: Pick<AstVisitorContext, "graph" | "variableTaint" | "checker" | "sourceFile" | "nextNodeId">
): void {
  const leftName = getSymbolName(node.left, ctx.checker, ctx.variableTaint);
  const rightName = getSymbolName(node.right, ctx.checker, ctx.variableTaint);
  if (!leftName || !rightName) return;
  const rightInfo = ctx.variableTaint.get(rightName);
  if (!rightInfo?.tainted) return;

  const leftSymbol = ctx.checker.getSymbolAtLocation(node.left);
  const actualLeftName = leftSymbol?.getName() ?? leftName;

  ctx.variableTaint.set(actualLeftName, {
    name: actualLeftName,
    tainted: true,
    source: rightInfo.source,
    declarations: [],
  });

  const nodeId = ctx.nextNodeId();
  const { line, character } = ts.getLineAndCharacterOfPosition(ctx.sourceFile, node.left.getStart());
  ctx.graph.addNode({
    id: nodeId,
    kind: "assignment",
    variableName: actualLeftName,
    sourceFile: ctx.sourceFile.fileName,
    line: line + 1,
    column: character + 1,
    text: node.getText(),
  });

  const rightNode = findExistingSourceNode(rightName, ctx.graph);
  if (rightNode) {
    ctx.graph.addEdge({ from: rightNode.id, to: nodeId, kind: "assignment" });
  }
}

export function visitVarDeclaration(
  node: ts.VariableDeclaration,
  ctx: Pick<AstVisitorContext, "graph" | "variableTaint" | "checker" | "sourceFile" | "nextNodeId">
): void {
  if (!node.initializer) return;
  const varName = getSymbolName(node.name, ctx.checker, ctx.variableTaint);
  const initName = getSymbolName(node.initializer, ctx.checker, ctx.variableTaint);
  if (!varName || !initName) return;
  const initInfo = ctx.variableTaint.get(initName);
  if (!initInfo?.tainted) return;

  ctx.variableTaint.set(varName, {
    name: varName,
    tainted: true,
    source: initInfo.source,
    declarations: [node],
  });

  const nodeId = ctx.nextNodeId();
  const { line, character } = ts.getLineAndCharacterOfPosition(ctx.sourceFile, node.getStart());
  const taintNode: TaintNode = {
    id: nodeId,
    kind: "assignment",
    variableName: varName,
    sourceFile: ctx.sourceFile.fileName,
    line: line + 1,
    column: character + 1,
    text: `const ${varName} = ${initName}`,
  };
  ctx.graph.addNode(taintNode);

  const initNode = findExistingSourceNode(initName, ctx.graph);
  if (initNode) {
    ctx.graph.addEdge({ from: initNode.id, to: nodeId, kind: "assignment" });
  }
}

/** Visit a node and perform taint analysis */
export function visit(
  node: ts.Node,
  ctx: AstVisitorContext
): void {
  ts.forEachChild(node, (child) => visit(child, ctx));
  visitSource(node, ctx);
  if (ts.isCallExpression(node)) {
    visitSink(node, ctx);
    propagateTaintAtCall(node, ctx.variableTaint, ctx.checker);
    handleCommanderAction(node, ctx.variableTaint);
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    visitAssignment(node, ctx);
  }
  if (ts.isVariableDeclaration(node) && node.initializer) {
    visitVarDeclaration(node, ctx);
  }
}

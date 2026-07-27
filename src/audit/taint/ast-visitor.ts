import * as ts from "typescript";
import type { TaintNode } from "./types.js";
import { isTaintSource } from "./sources.js";
import { findTaintSink } from "./sinks.js";
import { DataFlowGraph } from "./graph.js";
import {
  getPropertyAccessName,
  getCallName,
  getSymbolName,
  createTaintNodeAt,
  findExistingSourceNode,
} from "./ast-utils.js";
import type { VariableInfo } from "./ast-utils.js";

export type { VariableInfo } from "./ast-utils.js";

export interface AstVisitorContext {
  graph: DataFlowGraph;
  variableTaint: Map<string, VariableInfo>;
  nodeCounter?: number;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
  nextNodeId: () => string;
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

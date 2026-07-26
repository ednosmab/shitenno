import type { HealthIssue, SourceFileInfo } from "../types.js";

export function detectMagicNumbers(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/, /constants\.ts$/];

  let magicCount = 0;
  const magicFiles: string[] = [];

  const magicRegex = /(?<!=\s*)(?<!\w)\b(\d{2,})\b(?!\s*[;:,}\]])/g;
  const allowedNumbers = new Set([0, 1, 2, 10, 100, 1000]);

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const lines = file.content.split("\n");
    let fileMagic = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;

      let match;
      magicRegex.lastIndex = 0;
      while ((match = magicRegex.exec(line)) !== null) {
        const num = parseInt(match[1]!, 10);
        if (num > 10 && !allowedNumbers.has(num)) {
          fileMagic++;
        }
      }
    }

    if (fileMagic > 3) {
      magicCount += fileMagic;
      if (magicFiles.length < 5) {
        magicFiles.push(`${file.relPath} (${fileMagic})`);
      }
    }
  }

  if (magicCount > 0) {
    issues.push({
      type: "magic_numbers",
      severity: 1,
      description: `${magicCount} número(s) mágico(s) detectado(s) em ${magicFiles.join(", ")}`,
      location: magicFiles.join(", "),
      recommendation: "Extrair números para constantes nomeadas para melhorar legibilidade e manutenibilidade.",
      confidence: 0.6,
    });
  }

  return issues;
}

export function detectLongParams(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const longParamRegex = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:function|\())\s*\(([^)]{80,})\)/g;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    let match;
    longParamRegex.lastIndex = 0;
    while ((match = longParamRegex.exec(file.content)) !== null) {
      const lineNum = file.content.substring(0, match.index).split("\n").length;
      const paramCount = (match[1]!.match(/,/g) || []).length + 1;

      if (paramCount > 4) {
        issues.push({
          type: "long_params",
          severity: 1,
          description: `Função com ${paramCount} parâmetros em "${file.relPath}:${lineNum}" — Interface Segregation violada`,
          location: `${file.relPath}:${lineNum}`,
          recommendation: "Reduzir parâmetros para ≤4. Usar objeto de opções ou interface para parâmetros relacionados.",
          confidence: 0.75,
        });
      }
    }
  }

  return issues;
}

export function detectDeepNesting(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];
  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;
    let maxDepth = 0;
    let deepLine = 0;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const indent = line.search(/\S/);
      if (indent >= 0) {
        const depth = Math.floor(indent / 2);
        if (depth > maxDepth) {
          maxDepth = depth;
          deepLine = i + 1;
        }
      }
    }
    if (maxDepth > 6) {
      issues.push({ type: "deep_nesting", severity: maxDepth > 8 ? 2 : 1,
        description: `Aninhamento profundo em "${file.relPath}" — profundidade máxima ${maxDepth} (linha ${deepLine})`,
        location: `${file.relPath}:${deepLine}`, recommendation: "Extrair lógica aninhada para funções auxiliares. Usar early return para reduzir aninhamento.", confidence: 0.85 });
    }
  }
  return issues;
}

const FUNC_START_REGEX = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/;

function findFunctionEnd(lines: string[], startIndex: number): { endIndex: number; name: string } {
  let braceDepth = 0, inFunction = false;
  const match = lines[startIndex]!.match(FUNC_START_REGEX);
  const funcName = match?.[1] ?? match?.[2] ?? "anonymous";
  for (let i = startIndex; i < lines.length; i++) {
    for (const ch of lines[i]!) {
      if (ch === "{") { braceDepth++; inFunction = true; }
      if (ch === "}") braceDepth--;
    }
    if (inFunction && braceDepth <= 0) return { endIndex: i, name: funcName };
  }
  return { endIndex: lines.length - 1, name: funcName };
}

function detectGodFunctionsInFile(file: SourceFileInfo): Array<{ name: string; start: number; lines: number }> {
  const results: Array<{ name: string; start: number; lines: number }> = [];
  const lines = file.content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;
    if (!FUNC_START_REGEX.test(lines[i]!)) continue;
    const { endIndex, name } = findFunctionEnd(lines, i);
    const funcLines = endIndex - i + 1;
    if (funcLines > 80) results.push({ name, start: i, lines: funcLines });
    i = endIndex;
  }
  return results;
}

export function detectGodFunctions(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];
  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;
    for (const func of detectGodFunctionsInFile(file)) {
      issues.push({ type: "god_function", severity: func.lines > 150 ? 2 : 1,
        description: `Função "${func.name}" em "${file.relPath}:${func.start + 1}" tem ${func.lines} linhas — considerar dividir`,
        location: `${file.relPath}:${func.start + 1}`, recommendation: `Dividir "${func.name}" em funções menores (<80 linhas cada).`, confidence: 0.7 });
    }
  }
  return issues;
}

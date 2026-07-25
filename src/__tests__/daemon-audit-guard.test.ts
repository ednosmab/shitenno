import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("daemon never triggers the heavy verify:all path", () => {
  it("runPeriodicAudit does not call runAutoVerification, checkBuild, checkTests or checkLint directly", () => {
    // After fragmentation, runPeriodicAudit lives in daemon/timers.ts
    const timersSource = readFileSync(join(process.cwd(), "src", "daemon", "timers.ts"), "utf-8");

    // Localizar só o corpo de runPeriodicAudit, não o arquivo inteiro — o
    // daemon pode legitimamente importar essas funções em outro contexto
    // (ex.: se algum dia expuser um comando remoto "daemon verify"); o que
    // não pode é o TIMER PERIÓDICO chamar isso sozinho.
    const fnStart = timersSource.indexOf("export async function runPeriodicAudit");
    const fnEnd = timersSource.indexOf("\n}", fnStart);
    const fnBody = timersSource.slice(fnStart, fnEnd);

    expect(fnBody).not.toMatch(/runAutoVerification|checkBuild\(|checkTests\(|checkLint\(/);
    expect(fnBody).not.toMatch(/--full-sweep|fullSweep/);
  });

  it("auditHealth is called with fullSweep-equivalent behavior disabled inside the daemon", () => {
    // After fragmentation, auditHealth call lives in daemon/timers.ts
    const timersSource = readFileSync(join(process.cwd(), "src", "daemon", "timers.ts"), "utf-8");
    // auditHealth() em si nunca recebeu esse conceito (é síncrona, sem opção
    // de rodar verify) — esse teste é uma trava de regressão para o dia em
    // que alguém decidir "acoplar" os dois: se a assinatura de auditHealth()
    // ganhar um 5º parâmetro relacionado a sweep, este teste força revisão
    // explícita de por que o daemon está ou não passando ele.
    // auditHealth(projectRoot, shitennoDir, level) — must audit the PROJECT, not .shitenno
    expect(timersSource).toMatch(/auditHealth\(ctx\.projectRoot, ctx\.shitennoDir, level\)/);
  });
});

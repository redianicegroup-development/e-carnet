// Charge un module src/**/*.ts tel quel (transpilé par TypeScript, imports relatifs fournis par `deps`) pour l'exécuter sous Node
// avec de faux globals (window, indexedDB, navigator). Évite d'ajouter une dépendance de test.
import { readFileSync } from "node:fs";
import ts from "typescript";

export function loadTs(relativePath, deps = {}) {
  const source = readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: relativePath });
  const module = { exports: {} };
  const require = (specifier) => {
    if (!(specifier in deps)) throw new Error(`${relativePath} : dépendance non fournie « ${specifier} »`);
    return deps[specifier];
  };
  new Function("exports", "require", "module", outputText)(module.exports, require, module);
  return module.exports;
}

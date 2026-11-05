// Crochet de résolution pour les tests : permet à un module de src/ d'importer un autre module TypeScript sans extension
// (`import { X } from "./data-policy"`), comme le fait le build Next.js. N'intervient que si la résolution normale échoue.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND" && /^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const extension of [".ts", ".tsx"]) {
        try { return await nextResolve(`${specifier}${extension}`, context); } catch { /* essai suivant */ }
      }
    }
    throw error;
  }
}

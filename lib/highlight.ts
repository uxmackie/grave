import type PrismType from "prismjs";

type Prism = typeof PrismType;

let prism: Prism | null = null;
let loading: Promise<Prism> | null = null;

/** Prism is only needed once a page contains a code block. Keep it out of the
 *  reader's initial bundle and load the five languages we render together. */
export function loadPrism(): Promise<Prism> {
  if (prism) return Promise.resolve(prism);
  if (loading) return loading;
  loading = (async () => {
    const prismModule = await import("prismjs");
    const loaded = prismModule.default;
    // Language components register themselves on Prism as a side effect.
    await Promise.all([
      import("prismjs/components/prism-javascript"),
      import("prismjs/components/prism-typescript"),
      import("prismjs/components/prism-python"),
      import("prismjs/components/prism-bash"),
      import("prismjs/components/prism-json"),
    ]);
    prism = loaded;
    return loaded;
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** Return the already-loaded highlighter so repeated code-line renders can
 *  resolve synchronously after the first chunk has arrived. */
export function loadedPrism(): Prism | null {
  return prism;
}

export function highlightWith(prism: Prism, text: string, language: string) {
  const grammar = prism.languages[language] || prism.languages.markup;
  try {
    return prism.highlight(text, grammar, language);
  } catch {
    return text;
  }
}

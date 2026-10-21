import { headings, parse, textOf } from "./mdx.ts";
import { visiblePages, type Product, type Page } from "./model.ts";

export type SearchDocument = {
  product: Product;
  page: Page;
  headings: ReturnType<typeof headings>;
  text: string;
};

const indexes = new WeakMap<Product, SearchDocument[]>();

export function searchDocuments(products: Product[]) {
  return products.flatMap((product) => {
    let index = indexes.get(product);
    if (!index) {
      index = visiblePages(product).map((page) => {
        const tree = parse(page.source).tree;
        return {
          product,
          page,
          headings: headings(page.source, tree),
          text: textOf(tree),
        };
      });
      indexes.set(product, index);
    }
    return index;
  });
}

export function searchResults(documents: SearchDocument[], query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const excerpt = (text: string) => {
    const pos = Math.max(0, text.toLowerCase().indexOf(terms[0] || ""));
    const start = Math.max(0, pos - 45);
    return (
      (start ? "…" : "") + text.slice(start, start + 180)
    );
  };
  return documents
    .flatMap((document) => {
      if (!terms.length)
        return [
          {
            ...document,
            heading: "",
            hash: "",
            excerpt: document.page.description,
            score: 0,
          },
        ];
      const title = document.page.title.toLowerCase();
      const body = (
        document.page.description +
        " " +
        document.text
      ).toLowerCase();
      const titleHit = terms.every((term) => title.includes(term));
      const result =
        titleHit ||
        terms.every((term) => (title + " " + body).includes(term))
          ? [
              {
                ...document,
                heading: "",
                hash: "",
                excerpt: excerpt(document.page.description + " " + document.text),
                score: titleHit ? 100 : 20,
              },
            ]
          : [];
      return [
        ...result,
        ...document.headings
          .filter((heading) =>
            terms.every((term) => heading.text.toLowerCase().includes(term)),
          )
          .map((heading) => ({
            ...document,
            heading: heading.text,
            hash: heading.id,
            excerpt: excerpt(document.text),
            score: 80,
          })),
      ];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 60);
}

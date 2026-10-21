import { headingId } from "./heading-id.ts";
import { visiblePages, type Product, type Page } from "./model.ts";

export type VersionInfo = {
  id: string;
  label: string;
  slug: string;
  created: string;
};

export type Heading = {
  id: string;
  text: string;
  depth: number;
  offset: number;
};

export function readerPath(product: Product, page?: Page, version = "") {
  return (
    "/" +
    product.slug +
    (version ? "/v/" + encodeURIComponent(version) : "") +
    (page ? "/" + page.slug : "")
  );
}

export function resolveRedirect(product: Product, slug: string) {
  if (product.pages.some((page) => page.slug === slug)) return undefined;
  const redirect = product.redirects?.find((r) => r.from === slug);
  return redirect
    ? visiblePages(product).find((page) => page.id === redirect.pageId)
    : undefined;
}

/** Count readable prose without booting the full MDX parser. */
export function readingMinutes(source: string) {
  const text = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text ? text.split(" ").length : 0;
  return Math.max(1, Math.ceil(words / 220));
}

/** Fast ATX heading scan for the table of contents and reader chrome. */
export function sourceHeadings(source: string): Heading[] {
  const result: Heading[] = [];
  const counts: Record<string, number> = {};
  let offset = 0;
  let fence = false;
  for (const line of source.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
    } else if (!fence) {
      const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (match) {
        const text = match[2]
          .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
          .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
          .replace(/[*_~`]/g, "")
          .trim();
        const base = headingId(text);
        const count = counts[base] || 0;
        counts[base] = count + 1;
        result.push({
          id: base + (count ? "-" + count : ""),
          text,
          depth: match[1].length,
          offset,
        });
      }
    }
    offset += line.length + 1;
  }
  return result;
}

export function needsReview(page: Page, now = Date.now(), days = 90) {
  const date = Date.parse(page.reviewedAt || page.updatedAt || "");
  return !Number.isFinite(date) || now - date > days * 86400000;
}

export function publishedSnapshot(
  draft: Product,
  previous: Product | null,
  now = new Date().toISOString(),
): Product {
  return {
    ...draft,
    aliases: Array.from(
      new Set([
        ...(previous?.aliases || []),
        ...(previous && previous.slug !== draft.slug ? [previous.slug] : []),
      ]),
    ).filter((slug) => slug !== draft.slug),
    pages: draft.pages.map((page) => {
      const old = previous?.pages.find((p) => p.id === page.id);
      const unchanged =
        old &&
        old.source === page.source &&
        old.title === page.title &&
        old.description === page.description;
      return {
        ...page,
        updatedAt: unchanged ? old.updatedAt || now : now,
      };
    }),
  };
}

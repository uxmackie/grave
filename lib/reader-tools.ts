// Compatibility surface for server-side callers and unit tests. Browser
// reader modules import `reader-paths` or `search` directly so the full MDX
// parser stays out of the initial bundle.
export {
  type Heading,
  type VersionInfo,
  needsReview,
  publishedSnapshot,
  readerPath,
  readingMinutes,
  resolveRedirect,
  sourceHeadings,
} from "./reader-paths.ts";
export {
  type SearchDocument,
  searchDocuments,
  searchResults,
} from "./search.ts";

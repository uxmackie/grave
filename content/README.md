# Grave content

Grave writes this folder automatically when using `npm run dev`.

```text
workspace.json
products/
  product-grave/
    draft/
      product.json
      pages/page-page-0.mdx
      snippets/
      templates/
      templates.json
    published/
      product.json
      pages/page-page-0.mdx
```

Page files preserve the exact MDX source, including frontmatter, comments, and components. `product.json` maps each page's title, slug, identity, and visibility to its file and stores navigation and product settings. Stable identity-based filenames keep title and slug changes from moving files. Snippets and templates also have MDX files.

Draft saves update `draft`; publishing updates `published`. Deleted pages/products are removed from the managed files. `.grave-files.json` tracks files managed by Grave. Unrelated files are retained. This directory is not ignored by Git, so you can version it with the rest of the project.

These files are a one-way copy of the database. Direct file edits are not imported and can be overwritten by the next editor save. Database revisions, history, authentication, and uploaded image bytes remain in local D1/R2 storage. Keep `.wrangler/state` as well as this folder.

The local Vite server owns filesystem writes. This does not write to your computer from a deployed Cloudflare Worker or `npm start` preview. The folder is blocked from direct HTTP access because it contains drafts. If a write fails, the editor shows a folder-sync warning and a retry button; the database save remains successful.

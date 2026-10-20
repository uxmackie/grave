# Grave

Grave is a documentation reader and browser authoring application built from the requirements in `grave.txt`. The original specification and logos are preserved.

## Run locally

Requires Node 24 and access to the npm registry.

```powershell
cd C:\Users\voxel\Downloads\grave
npm install
npm run typecheck
npm test
npm run setup:local
npm run dev
```

Setup creates a unique local password in `.dev.vars` if that file does not exist. Use that password at `/editor`. The reader is at `/` and each product is at `/<product-slug>`. Never commit `.dev.vars` or use its local password as a production secret.

The development server uses persistent local D1 and R2 storage under `.wrangler/state`. Workspace/product/page changes are server-backed. Browser storage holds only theme preferences and temporary unsaved-draft recovery copies.

`npm run setup:local` applies checked-in migrations without requiring a build. `npm run dev` and `npm start` also apply pending local migrations before starting. To apply them separately, run `npm run db:migrate:local`. These commands use `wrangler.local.json` and preserve existing data.

## Production

The Sites manifest declares D1 `DB` and R2 `BUCKET`. Generate and review Drizzle migrations from `db/schema.ts`, build the Worker, and configure the `EDITOR_PASSWORD` secret before deployment. Without a configured password, the editor fails closed. All editing APIs require a valid HttpOnly session; publication uses optimistic revisions.

No deployment has been made. See `VERIFICATION.md` for the verification log.

## Content architecture

Editor saves during `npm run dev` also write Markdown/MDX and JSON into `content/`. Existing drafts and published versions are copied when the editor loads. See [content/README.md](content/README.md) for the layout and the distinction between these files and the database. File changes are not imported back into the editor.

- `lib/model.ts`: workspace/products, pages, navigation, homepages, templates, public projection, validation and publication differences.
- `lib/store.ts`: atomic draft writes, revision checks, product publication and page history.
- `lib/mdx.ts`: MDX parsing and source-range updates. Author expressions and imports are never compiled or executed.
- `components/content.tsx`: the same renderer is used for Preview and the public reader; Visual adds authoring controls.
- `components/grave-app.tsx`: reader/editor, autosave, recovery, mode changes, search, navigation and themes.
- `components/panels.tsx`: settings, navigation, publishing review, history, media, snippets, templates, links and find/replace.
- `app/api`: authenticated writes, public published snapshots and product-scoped media.

Unknown MDX is preserved as source and shown inertly. Literal component attributes are supported; executable expressions remain inert. Media files are retained so historic versions do not lose their images.

## References and assets

- Supplied Grave SVG logos from `logo`.
- [Mintlify components](https://github.com/mintlify/components) and [navigation](https://www.mintlify.com/docs/organize/navigation) informed the documentation patterns.
- [Paper Mono](https://github.com/paper-design/paper-mono) is referenced from its official repository as a webfont. Font loading has not been verified in this restricted environment.
- Font Awesome Free Solid, Regular and Brands packages provide the shared icon library.

## Status

Dependencies are installed, type checking passes, the unit suite passes, the local browser checks pass, and the production build succeeds. The initial Drizzle migration has been generated and applied locally. No deployment has been made. `REQUIREMENTS.md` retains every original requirement; `VERIFICATION.md` records the verification history.

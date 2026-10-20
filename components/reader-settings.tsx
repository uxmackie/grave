"use client";
import { useEffect, useState } from "react";
import { type Product, type ProductRecord } from "@/lib/model";
import { needsReview, type VersionInfo } from "@/lib/reader-tools";
import { api } from "@/lib/client-api";
import {
  Badge,
  Button,
  Field,
  Input,
  Note,
  PanelSection,
  SelectField,
  Separator,
  Toggle,
} from "./editor/ui";
import { Icon } from "./grave-ui";

export function ReaderSettings({
  product,
  change,
}: {
  product: Product;
  change: (p: Product) => void;
}) {
  const settings = product.reader || {
    updated: true,
    readingTime: true,
    feedback: true,
  };
  const [from, setFrom] = useState(""),
    [pageId, setPageId] = useState(product.pages[0]?.id || ""),
    [error, setError] = useState("");
  return (
    <div className="grid gap-6">
      <PanelSection
        title="Page information"
        description="Metadata shown at the end of published pages."
      >
        {(
          [
            ["updated", "Show last updated date"],
            ["readingTime", "Show reading time"],
            ["feedback", "Collect reader feedback"],
          ] as const
        ).map(([key, label]) => (
          <Toggle
            key={key}
            label={label}
            checked={settings[key]}
            onChange={(value) =>
              change({ ...product, reader: { ...settings, [key]: value } })
            }
          />
        ))}
        <Note>These settings take effect when you publish.</Note>
      </PanelSection>
      <Separator />
      <PanelSection
        title="Redirects"
        description="Send an old page URL to an existing page. Redirects use page identities, so the destination can be renamed without breaking the redirect."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Old page slug">
            <Input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="old-quickstart"
            />
          </Field>
          <SelectField
            label="Destination page"
            value={pageId}
            onValueChange={setPageId}
            placeholder="Choose a page"
            options={product.pages.map((page) => ({
              value: page.id,
              label: page.title,
            }))}
          />
        </div>
        <Button
          icon="plus"
          className="justify-self-start"
          onClick={() => {
            const slug = from.trim();
            if (
              !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
              product.pages.some((p) => p.slug === slug) ||
              (product.redirects || []).some((r) => r.from === slug) ||
              !product.pages.some((p) => p.id === pageId)
            ) {
              setError(
                "Use a unique old slug and choose an existing destination page.",
              );
              return;
            }
            change({
              ...product,
              redirects: [
                ...(product.redirects || []),
                { from: slug, pageId },
              ],
            });
            setFrom("");
            setError("");
          }}
        >
          Add redirect
        </Button>
        {error ? (
          <p role="status" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {(product.redirects || []).length ? (
          <div className="grid gap-1.5">
            {(product.redirects || []).map((redirect) => (
              <div
                key={redirect.from}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <Icon
                  value="arrow-right"
                  className="size-3 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  /{redirect.from}{" "}
                  <span className="text-muted-foreground">→</span>{" "}
                  {product.pages.find((p) => p.id === redirect.pageId)
                    ?.title || "Missing page"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    change({
                      ...product,
                      redirects: product.redirects?.filter(
                        (r) => r !== redirect,
                      ),
                    })
                  }
                  aria-label={"Remove redirect " + redirect.from}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Note>No redirects yet.</Note>
        )}
        <Note>
          Publish to activate changes. Hidden and draft destinations are not
          exposed to readers.
        </Note>
      </PanelSection>
    </div>
  );
}

export function VersionsPanel({ record }: { record: ProductRecord }) {
  const [versions, setVersions] = useState<VersionInfo[]>([]),
    [label, setLabel] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const load = () =>
    api<{ versions: VersionInfo[] }>("/api/products/" + record.id + "/versions")
      .then((r) => {
        setVersions(r.versions);
        setLoaded(true);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [record.id]);
  return (
    <div className="grid gap-6">
      <PanelSection
        title="Save a version"
        description="Save an immutable copy of the currently published documentation. Later edits and publications affect Latest only."
      >
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Version name" className="min-w-40 flex-1">
            <Input
              placeholder="v1.0"
              maxLength={60}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
          <Button
            variant="default"
            disabled={busy || !record.published}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/api/products/" + record.id + "/versions", {
                  method: "POST",
                  body: JSON.stringify({
                    label,
                    revision: record.revision,
                  }),
                });
                setLabel("");
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving version…" : "Save published version"}
          </Button>
        </div>
        {!record.published ? (
          <Note tone="warning">
            Publish this product before saving a version.
          </Note>
        ) : null}
        <p role="status" className="text-xs text-muted-foreground">
          {error || (!loaded ? "Loading versions…" : "")}
        </p>
        {error ? (
          <Button size="sm" className="justify-self-start" onClick={load}>
            Retry loading versions
          </Button>
        ) : null}
      </PanelSection>
      <Separator />
      <PanelSection title="Saved versions">
        {versions.length ? (
          <div className="grid gap-1.5">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
              >
                <a
                  className="min-w-0 truncate text-[13px] font-medium text-primary hover:underline"
                  href={
                    "/" +
                    (record.published?.slug || record.draft.slug) +
                    "/v/" +
                    v.slug
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {v.label}
                </a>
                <time className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(v.created).toLocaleDateString()}
                </time>
              </div>
            ))}
          </div>
        ) : loaded ? (
          <Note>
            No saved versions yet. Name the current publication to create one.
          </Note>
        ) : null}
      </PanelSection>
    </div>
  );
}

type Summary = {
  page_id: string;
  version: string;
  helpful: number;
  unhelpful: number;
};
type Feedback = {
  id: string;
  page_id: string;
  version: string;
  comment: string;
  helpful: number;
  created: string;
};

export function FeedbackDashboard({ product }: { product: Product }) {
  const [data, setData] = useState<{
      summary: Summary[];
      comments: Feedback[];
    } | null>(null),
    [error, setError] = useState("");
  const load = () =>
    api<{ summary: Summary[]; comments: Feedback[] }>(
      "/api/products/" + product.id + "/feedback",
    )
      .then((r) => {
        setData(r);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [product.id]);
  const title = (id: string) =>
    product.pages.find((p) => p.id === id)?.title || "Removed page";
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Reader ratings and comments from published pages.
        </p>
        <Button icon="rotate-right" size="sm" onClick={load}>
          Refresh feedback
        </Button>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {error || (!data ? "Loading feedback…" : "")}
      </p>
      {data ? (
        !data.summary.length ? (
          <Note>
            No feedback yet. Readers can rate published pages when feedback is
            enabled.
          </Note>
        ) : (
          <>
            <PanelSection
              title="Pages needing attention"
              description="Ratings grouped by page and published version."
            >
              <div className="grid gap-1.5">
                {data.summary.map((row) => (
                  <div
                    key={row.page_id + row.version}
                    className="rounded-lg border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[13px] font-medium">
                        {title(row.page_id)}
                      </strong>
                      <Badge
                        variant="secondary"
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {row.version || "Latest"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.helpful} helpful · {row.unhelpful} not helpful
                    </p>
                  </div>
                ))}
              </div>
            </PanelSection>
            <Separator />
            <PanelSection
              title="Recent comments"
              description="Showing up to 200 recent comments."
            >
              {data.comments.length ? (
                <div className="grid gap-2">
                  {data.comments.map((row) => (
                    <article
                      className="rounded-lg border border-border bg-card p-3.5"
                      key={row.id}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-[13px] font-medium">
                          {title(row.page_id)}
                        </strong>
                        <Badge
                          variant="secondary"
                          className="h-5 px-1.5 text-[10px]"
                        >
                          {row.version || "Latest"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {row.helpful ? "Helpful" : "Not helpful"} ·{" "}
                          {new Date(row.created).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-2 text-[13px] leading-relaxed text-foreground">
                        {row.comment}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <Note>No written comments yet.</Note>
              )}
            </PanelSection>
          </>
        )
      ) : null}
    </div>
  );
}

export function FreshnessPanel({
  product,
  change,
}: {
  product: Product;
  change: (p: Product) => void;
}) {
  const pages = product.pages.filter((p) => needsReview(p));
  return (
    <div className="grid gap-5">
      <Note>
        Pages with no recorded review or no review in 90 days. Marking a page
        reviewed updates its draft; publish to retain the review with the public
        snapshot.
      </Note>
      {!pages.length ? (
        <Note tone="success">All pages have a recent review.</Note>
      ) : (
        <div className="grid gap-1.5">
          {pages.map((page) => (
            <div
              key={page.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <span className="grid min-w-0 gap-0.5">
                <strong className="truncate text-[13px] font-medium">
                  {page.title}
                </strong>
                <span className="text-[11px] text-muted-foreground">
                  {page.reviewedAt
                    ? "Reviewed " +
                      new Date(page.reviewedAt).toLocaleDateString()
                    : "Not reviewed yet"}
                </span>
              </span>
              <Button
                size="sm"
                icon="check"
                onClick={() =>
                  change({
                    ...product,
                    pages: product.pages.map((p) =>
                      p.id === page.id
                        ? { ...p, reviewedAt: new Date().toISOString() }
                        : p,
                    ),
                  })
                }
              >
                Mark reviewed
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

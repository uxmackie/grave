"use client";
import { useEffect, useMemo, useState } from "react";
import type { Product, Page } from "@/lib/model";
import { updateMetadata } from "@/lib/mdx";
import { lineDiff } from "@/lib/line-diff";
import { api } from "@/lib/client-api";
import {
  Button,
  Note,
  SelectField,
  Toggle,
} from "./editor/ui";

type Revision = { id: string; created: string; reason: string; page: Page };

export function HistoryPanel({
  product,
  change,
  page,
  notify,
}: {
  product: Product;
  page: Page;
  change: (p: Product) => void;
  notify: (s: string) => void;
}) {
  const [items, setItems] = useState<Revision[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState(""),
    [compare, setCompare] = useState("current"),
    [metadata, setMetadata] = useState(false),
    [split, setSplit] = useState(false),
    [confirm, setConfirm] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api<Revision[]>(
      "/api/products/" +
        product.id +
        "/history?page=" +
        encodeURIComponent(page.id),
    )
      .then((rows) => {
        if (live) {
          setItems(rows);
          setSelected(rows[0]?.id || "");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [product.id, page.id, attempt]);
  const previous = items.find((x) => x.id === selected);
  const target =
    compare === "current"
      ? page
      : items.find((x) => x.id === compare)?.page || page;
  const diff = useMemo(
    () => lineDiff(previous?.page.source || "", target.source),
    [previous, target.source],
  );
  const added = diff.filter((x) => x.kind === "added").length,
    removed = diff.filter((x) => x.kind === "removed").length;
  return (
    <div className="grid gap-5">
      {loading ? (
        <Note>Loading page history…</Note>
      ) : error ? (
        <Note tone="danger">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Retry history
            </Button>
          </div>
        </Note>
      ) : !items.length ? (
        <Note>
          No saved revisions yet. History appears after your first saved change.
        </Note>
      ) : (
        <>
          <div className="page-history-selects grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Earlier revision"
              value={selected}
              onValueChange={(value) => {
                setSelected(value);
                setConfirm(false);
              }}
              options={items.map((x) => ({
                value: x.id,
                label:
                  new Date(x.created).toLocaleString() + " · " + x.reason,
              }))}
            />
            <SelectField
              label="Compare with"
              value={compare}
              onValueChange={setCompare}
              options={[
                { value: "current", label: "Current draft" },
                ...items.map((x) => ({
                  value: x.id,
                  label:
                    new Date(x.created).toLocaleString() + " · " + x.reason,
                })),
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="text-xs text-muted-foreground">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                +{added}
              </span>{" "}
              added ·{" "}
              <span className="font-medium text-destructive">
                −{removed}
              </span>{" "}
              removed
            </p>
            <div
              className="flex rounded-md border border-border p-0.5"
              aria-label="Comparison layout"
            >
              <Button
                size="sm"
                variant={!split ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
                aria-pressed={!split}
                onClick={() => setSplit(false)}
              >
                Unified
              </Button>
              <Button
                size="sm"
                variant={split ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
                aria-pressed={split}
                onClick={() => setSplit(true)}
              >
                Side by side
              </Button>
            </div>
          </div>
          {split ? (
            <div className="history-sides">
              {(["before", "after"] as const).map((side) => (
                <section key={side}>
                  <h3>
                    {side === "before"
                      ? "Earlier revision"
                      : "Comparison revision"}
                  </h3>
                  <div
                    className="history-diff"
                    role="region"
                    aria-label={
                      side === "before" ? "Earlier source" : "Comparison source"
                    }
                    tabIndex={0}
                  >
                    {diff.map((line, i) => (
                      <div key={i} className={"diff-line diff-" + line.kind}>
                        <span>{line[side] || ""}</span>
                        <pre>{line[side] ? line.text || " " : " "}</pre>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div
              className="history-diff"
              tabIndex={0}
              role="region"
              aria-label="Source changes"
            >
              <table>
                <caption className="sr-only">
                  Earlier and comparison line numbers. Plus means added; minus
                  means removed.
                </caption>
                <thead>
                  <tr>
                    <th>Before</th>
                    <th>After</th>
                    <th>Change</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((line, i) => (
                    <tr key={i} className={"diff-" + line.kind}>
                      <td>{line.before || ""}</td>
                      <td>{line.after || ""}</td>
                      <td aria-label={line.kind}>
                        {line.kind === "added"
                          ? "+"
                          : line.kind === "removed"
                            ? "−"
                            : " "}
                      </td>
                      <td>
                        <pre>{line.text || " "}</pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {previous ? (
            <>
              <details className="diff">
                <summary>Page metadata comparison</summary>
                <div className="grid gap-1 px-4 pb-3 pt-1 text-xs">
                  {(
                    ["title", "description", "slug", "hidden", "draft"] as const
                  ).map((key) => (
                    <p key={key} className="text-muted-foreground">
                      <strong className="text-foreground">{key}:</strong>{" "}
                      {String(previous.page[key])} → {String(target[key])}
                    </p>
                  ))}
                </div>
              </details>
              <Toggle
                label="Also restore page title, description, URL and visibility"
                checked={metadata}
                onChange={setMetadata}
              />
              {confirm ? (
                <Note tone="warning">
                  <p>
                    Replace this page’s draft{" "}
                    {metadata ? "and settings" : "source"} with the selected
                    revision? Your current saved draft remains in history.
                    Publication is unchanged.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        change({
                          ...product,
                          pages: product.pages.map((p) =>
                            p.id === page.id
                              ? metadata
                                ? {
                                    ...previous.page,
                                    id: page.id,
                                    reviewedAt: undefined,
                                  }
                                : {
                                    ...p,
                                    source: updateMetadata(
                                      previous.page.source,
                                      {
                                        title: p.title,
                                        description: p.description,
                                        slug: p.slug,
                                        hidden: p.hidden,
                                        draft: p.draft,
                                      },
                                    ),
                                    reviewedAt: undefined,
                                  }
                              : p,
                          ),
                        });
                        setConfirm(false);
                        notify(
                          "Selected revision restored to this page’s draft",
                        );
                      }}
                    >
                      Restore selected revision
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </Note>
              ) : (
                <Button
                  className="justify-self-start"
                  onClick={() => setConfirm(true)}
                >
                  Restore into draft…
                </Button>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

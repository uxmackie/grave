"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/model";
import { mediaUses, updateImageAlt, type MediaUse } from "@/lib/media-usage";
import { quoteAttribute, safeUrl } from "@/lib/mdx";
import { api } from "@/lib/client-api";
import { Icon } from "./grave-ui";
import {
  Badge,
  Button,
  Field,
  Input,
  Note,
  PanelSection,
  SelectField,
} from "./editor/ui";
import { cn } from "@/lib/utils";

type Asset = {
  id: string;
  name: string;
  size: number;
  created?: string;
  uses?: MediaUse[];
};

export function MediaPanel({
  product: p,
  published,
  change,
  onInsert,
  notify,
  initialFile,
}: {
  product: Product;
  published: Product | null;
  change: (p: Product) => void;
  onInsert: (source: string) => void;
  notify: (s: string) => void;
  initialFile?: File | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Asset[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [file, setFile] = useState<File | null>(initialFile || null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState(""),
    [alt, setAlt] = useState(""),
    [caption, setCaption] = useState(""),
    [width, setWidth] = useState("100%"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [attempt, setAttempt] = useState(0),
    [apply, setApply] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    api<Asset[]>("/api/products/" + p.id + "/media")
      .then((rows) => {
        if (live) {
          setItems(rows);
          setError("");
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
  }, [p.id, attempt]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const object = URL.createObjectURL(file);
    setPreview(object);
    return () => URL.revokeObjectURL(object);
  }, [file]);
  const assets = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        uses: [
          ...mediaUses(item.id, p, "Draft"),
          ...(published ? mediaUses(item.id, published, "Published") : []),
          ...(item.uses || []).filter(
            (u) =>
              u.scope !== "Draft" &&
              !u.scope.startsWith("Draft ") &&
              u.scope !== "Published" &&
              !u.scope.startsWith("Published "),
          ),
        ],
      })),
    [items, p, published],
  );
  const visible = assets.filter(
    (x) =>
      x.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "unused" && !x.uses.length) ||
        (filter === "retained" &&
          x.uses.some(
            (u) => u.scope === "History" || u.scope.startsWith("Version "),
          ))),
  );
  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const result = await api<{ url: string }>(
        "/api/products/" + p.id + "/media",
        { method: "POST", body: form },
      );
      setUrl(result.url);
      setFile(null);
      setAttempt((x) => x + 1);
      notify("Image uploaded");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const updatedPages = useMemo(
    () =>
      url
        ? p.pages.map((page) => ({
            ...page,
            source: updateImageAlt(page.source, url, alt),
          }))
        : p.pages,
    [p.pages, url, alt],
  );
  const changed = updatedPages.filter(
    (page, i) => page.source !== p.pages[i].source,
  ).length;
  return (
    <div
      className="grid gap-6"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
      }}
      onPaste={(e) => {
        const f = Array.from(e.clipboardData.files).find((x) =>
          x.type.startsWith("image/"),
        );
        if (f) {
          e.preventDefault();
          setFile(f);
        }
      }}
    >
      <div
        className={cn(
          "grid justify-items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center transition-colors",
          file && "border-primary/50 bg-primary/5",
        )}
      >
        <span className="grid size-10 place-items-center rounded-full border border-border bg-background text-muted-foreground">
          <Icon value="cloud-arrow-up" className="size-4" />
        </span>
        <h3 className="text-sm font-semibold">Upload an image</h3>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Drop or paste an image, or choose a file. PNG, JPEG, GIF or WebP, up
          to 10 MB.
        </p>
        <input
          ref={inputRef}
          aria-label="Upload image"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <Button
          icon="image"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          Choose file
        </Button>
        {file ? (
          <p className="max-w-full truncate text-[11px] text-muted-foreground">
            {file.name} · {Math.ceil(file.size / 1024)} KB
          </p>
        ) : null}
      </div>
      {preview ? (
        <img
          className="mx-auto max-h-44 rounded-md border border-border object-contain"
          src={preview}
          alt="Upload preview"
        />
      ) : null}
      {file ? (
        <div className="flex justify-end">
          <Button
            variant="default"
            icon="cloud-arrow-up"
            onClick={upload}
            disabled={busy}
          >
            {busy ? "Uploading…" : "Upload " + file.name}
          </Button>
        </div>
      ) : null}
      {error ? (
        <Note tone="danger">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAttempt((x) => x + 1)}
            >
              Refresh library
            </Button>
          </div>
        </Note>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <Field label="Search media">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find an image by filename"
          />
        </Field>
        <SelectField
          label="Usage filter"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: "All images" },
            { value: "unused", label: "No known references" },
            { value: "retained", label: "Used in history or versions" },
          ]}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p role="status" className="text-xs text-muted-foreground">
          {loading ? "Loading media…" : visible.length + " images"}
        </p>
        {loading ? null : (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {items.length} total
          </Badge>
        )}
      </div>
      {visible.length ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {visible.map((x) => {
            const selected = url === "/api/media/" + x.id;
            return (
              <div
                key={x.id}
                className={cn(
                  "overflow-hidden rounded-lg border border-border bg-card transition-colors",
                  selected && "border-primary ring-2 ring-primary/20",
                )}
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  aria-pressed={selected}
                  aria-label={"Select " + x.name}
                  onClick={() => {
                    setUrl("/api/media/" + x.id);
                    setApply(false);
                  }}
                >
                  <img
                    loading="lazy"
                    src={"/api/media/" + x.id}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                  />
                </button>
                <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <span className="min-w-0 truncate text-[11px] font-medium">
                    {x.name}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {Math.ceil(x.size / 1024)} KB
                  </span>
                </div>
                <details className="border-t border-border px-2.5 py-1.5 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none">
                    Usage · {x.uses.length}
                  </summary>
                  <div className="grid gap-1 pb-1.5 pt-1.5">
                    {x.uses.map((u, i) => (
                      <p key={i} className="truncate">
                        {u.scope}: {u.title}
                      </p>
                    ))}
                    {!x.uses.length ? (
                      <p>
                        No known references. Images are retained for safe reuse.
                      </p>
                    ) : null}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="grid justify-items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-8 text-center">
            <Icon
              value="images"
              className="size-5 text-muted-foreground"
            />
            <p className="text-sm font-medium">
              {items.length
                ? "No images match these filters."
                : "Upload your first image"}
            </p>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              {items.length
                ? "Try a different search or usage filter."
                : "Uploaded images can be reused across every page in this product."}
            </p>
          </div>
        )
      )}
      <div className="h-px bg-border" />
      <PanelSection
        title="Selected image"
        description="Set the source, alternative text and display width."
      >
        {url ? (
          <img
            src={safeUrl(url)}
            alt=""
            className="max-h-36 w-fit rounded-md border border-border object-contain"
          />
        ) : null}
        <Field label="Selected image URL">
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setApply(false);
            }}
            placeholder="https://…"
          />
        </Field>
        <Field
          label="Alt text"
          hint="Describe the image in this context. Leave blank for a decorative image."
        >
          <Input
            aria-label="Alt text"
            value={alt}
            onChange={(e) => {
              setAlt(e.target.value);
              setApply(false);
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Caption">
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </Field>
          <Field label="Width">
            <Input
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
          </Field>
        </div>
        <Button
          variant="default"
          icon="plus"
          className="justify-self-start"
          disabled={!url || safeUrl(url) === "#" || busy}
          onClick={() =>
            onInsert(
              "<Image src=" +
                quoteAttribute(safeUrl(url)) +
                " alt=" +
                quoteAttribute(alt) +
                " caption=" +
                quoteAttribute(caption) +
                " width=" +
                quoteAttribute(width) +
                " />\n",
            )
          }
        >
          Insert image
        </Button>
      </PanelSection>
      {url && changed > 0 ? (
        apply ? (
          <Note tone="warning">
            <p>
              Apply this alt text to matching image instances across {changed}{" "}
              draft {changed === 1 ? "page" : "pages"}? Published pages keep
              their current text until publication.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  change({ ...p, pages: updatedPages });
                  setApply(false);
                  notify("Image descriptions updated in draft pages");
                }}
              >
                Apply alt text to {changed} pages
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setApply(false)}
              >
                Cancel
              </Button>
            </div>
          </Note>
        ) : (
          <Button
            variant="outline"
            className="justify-self-start"
            onClick={() => setApply(true)}
          >
            Update alt text in existing draft pages…
          </Button>
        )
      ) : null}
    </div>
  );
}

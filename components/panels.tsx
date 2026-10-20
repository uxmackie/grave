"use client";
import React, { useMemo, useState } from "react";
import { Icon, download } from "./grave-ui";
import {
  Badge,
  Button,
  Field,
  IconButton,
  Input,
  Note,
  PanelSection,
  Select,
  SelectContent,
  SelectField,
  SelectItem,
  SelectTrigger,
  Separator,
  Textarea,
  Toggle,
} from "./editor/ui";
import { IconPicker } from "./editor/icon-picker";
import { movePage } from "@/lib/navigation";
import { publishChecks, type QualityIssue } from "@/lib/publish-checks";
import {
  type Product,
  type Page,
  type Workspace,
  type Nav,
  type ProductRecord,
  flatten,
  uid,
  publicationDiff,
  validate,
  templates,
  newPage,
  slugify,
} from "@/lib/model";
import {
  parse,
  replacement,
  updateMetadata,
} from "@/lib/mdx";
import { SourceEditor } from "./content";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

type ProductProps = {
  product: Product;
  change: (p: Product) => void;
  notify: (s: string) => void;
};

export function ProductSettings({
  product: p,
  change,
  notify,
  onDelete,
}: { onDelete: () => void } & ProductProps) {
  return (
    <div className="grid gap-6">
      <PanelSection
        title="Identity"
        description="How this product appears in the workspace and the reader."
      >
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Icon">
            <IconPicker
              value={p.icon}
              onChange={(icon) => change({ ...p, icon })}
            />
          </Field>
          <Field label="Accent color">
            <input
              type="color"
              aria-label="Accent color"
              className="h-9 cursor-pointer rounded-md border border-input bg-transparent p-1"
              value={p.accent}
              onChange={(e) => change({ ...p, accent: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Product name">
          <Input
            value={p.name}
            onChange={(e) => change({ ...p, name: e.target.value })}
          />
        </Field>
        <Field label="Description">
          <Textarea
            rows={3}
            value={p.description}
            onChange={(e) => change({ ...p, description: e.target.value })}
          />
        </Field>
        <SelectField
          label="Hyperlink style"
          value={p.linkStyle || "hover-underline"}
          onValueChange={(value) =>
            change({ ...p, linkStyle: value as Product["linkStyle"] })
          }
          options={[
            { value: "hover-underline", label: "Underline on hover" },
            { value: "accent-text", label: "Accent underline and text" },
            {
              value: "always-underline",
              label: "Always show accent underline",
            },
            {
              value: "accent-hover",
              label: "Accent text and underline on hover",
            },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product slug" hint="Used in the public reader URL.">
            <Input
              value={p.slug}
              onChange={(e) => change({ ...p, slug: e.target.value })}
            />
          </Field>
          <Field label="Product logo URL (optional)">
            <Input
              value={p.logo || ""}
              placeholder="https://…"
              onChange={(e) => change({ ...p, logo: e.target.value })}
            />
          </Field>
        </div>
      </PanelSection>
      <Separator />
      <PanelSection
        title="Reader sidebar message"
        description="A small callout under the reader navigation."
      >
        <Field label="Message icon">
          <IconPicker
            value={p.message.icon}
            onChange={(icon) =>
              change({ ...p, message: { ...p.message, icon } })
            }
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <Input
              value={p.message.title}
              onChange={(e) =>
                change({
                  ...p,
                  message: { ...p.message, title: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Link">
            <Input
              value={p.message.href}
              onChange={(e) =>
                change({
                  ...p,
                  message: { ...p.message, href: e.target.value },
                })
              }
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            rows={2}
            value={p.message.description}
            onChange={(e) =>
              change({
                ...p,
                message: { ...p.message, description: e.target.value },
              })
            }
          />
        </Field>
      </PanelSection>
      <Separator />
      <PanelSection title="Visibility">
        <Toggle
          label="Visible to readers after publication"
          description="Hidden products stay in the workspace but disappear from the public site."
          checked={p.visible}
          onChange={(visible) => change({ ...p, visible })}
        />
      </PanelSection>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3.5">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Export a copy of this product before making destructive changes.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            icon="download"
            onClick={() => exportProduct(p).catch((e) => notify(e.message))}
          >
            Export product
          </Button>
          <Button
            variant="outline"
            icon="trash"
            className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={onDelete}
          >
            Delete product
          </Button>
        </div>
      </div>
    </div>
  );
}

export async function exportProduct(p: Product) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file(
    "grave.json",
    JSON.stringify(
      {
        ...p,
        pages: p.pages.map((page) => {
          const record = { ...page };
          delete (record as Partial<Page>).source;
          return record;
        }),
      },
      null,
      2,
    ),
  );
  for (const page of p.pages)
    zip.file("pages/" + page.slug + ".mdx", page.source);
  for (const [name, source] of Object.entries(p.snippets))
    zip.file("snippets/" + slugify(name) + ".mdx", source);
  download(p.slug + ".zip", await zip.generateAsync({ type: "blob" }));
}

export function HomeSettings({ product: p, change }: ProductProps) {
  const set = (key: string, value: unknown) =>
    change({ ...p, home: { ...p.home, [key]: value } });
  return (
    <div className="grid gap-6">
      <PanelSection
        title="Introduction"
        description="The first block readers see at the product root."
      >
        <Toggle
          label="Show introduction"
          checked={p.home.enabled}
          onChange={(v) => set("enabled", v)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {(["eyebrow", "title", "description", "button"] as const).map(
            (key) => (
              <Field
                key={key}
                label={
                  key === "button"
                    ? "Primary button text"
                    : key.charAt(0).toUpperCase() + key.slice(1)
                }
                className={key === "description" ? "sm:col-span-2" : ""}
              >
                <Input
                  value={p.home[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </Field>
            ),
          )}
        </div>
        <SelectField
          label="Starting page"
          value={p.home.start}
          onValueChange={(value) => set("start", value)}
          placeholder="Choose a starting page"
          options={p.pages.map((x) => ({ value: x.id, label: x.title }))}
        />
      </PanelSection>
      <Separator />
      <PanelSection
        title="Featured pages"
        description="Choose up to three. Only visible, published pages appear to readers."
      >
        {p.pages.length ? (
          <div className="grid gap-1 rounded-lg border border-border p-2">
            {p.pages.map((page) => (
              <Toggle
                key={page.id}
                compact
                label={page.title}
                checked={p.home.featured.includes(page.id)}
                onChange={(v) => {
                  if (v && p.home.featured.length === 3) return;
                  set(
                    "featured",
                    v
                      ? [...p.home.featured, page.id]
                      : p.home.featured.filter((x) => x !== page.id),
                  );
                }}
              />
            ))}
          </div>
        ) : (
          <Note>Create a page before featuring it on the homepage.</Note>
        )}
        <Note>Homepage changes go live when you publish this product.</Note>
      </PanelSection>
    </div>
  );
}

export function PageSettings({
  page,
  product: p,
  change,
  onDelete,
  focusDescription = false,
}: {
  page: Page;
  onDelete: () => void;
  focusDescription?: boolean;
} & ProductProps) {
  const [slug, setSlug] = useState(page.slug),
    [updateLinks, setUpdateLinks] = useState(true),
    [keepRedirect, setKeepRedirect] = useState(true);
  const patch = (v: Partial<Page>) =>
    change({
      ...p,
      pages: p.pages.map((x) =>
        x.id === page.id
          ? { ...x, ...v, source: updateMetadata(v.source ?? x.source, v) }
          : x,
      ),
    });
  function applySlug() {
    if (slug === page.slug) return;
    const old = "/" + p.slug + "/" + page.slug,
      next = "/" + p.slug + "/" + slug;
    change({
      ...p,
      redirects: [
        ...(p.redirects || []).filter(
          (r) => r.from !== slug && r.from !== page.slug,
        ),
        ...(keepRedirect ? [{ from: page.slug, pageId: page.id }] : []),
      ],
      pages: p.pages.map((x) => ({
        ...x,
        ...(x.id === page.id
          ? { slug, source: updateMetadata(x.source, { slug }) }
          : {}),
        source: updateLinks
          ? updateMetadata(
              x.source
                .split("](" + old + ")")
                .join("](" + next + ")")
                .split('"' + old + '"')
                .join('"' + next + '"'),
              x.id === page.id ? { slug } : {},
            )
          : x.id === page.id
            ? updateMetadata(x.source, { slug })
            : x.source,
      })),
    });
  }
  return (
    <div className="grid gap-6">
      <PanelSection
        title="Page details"
        description="These fields also update the MDX metadata."
      >
        <Field label="Page icon">
          <IconPicker
            value={page.icon}
            onChange={(icon) => patch({ icon })}
          />
        </Field>
        <Field label="Page title">
          <Input
            value={page.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </Field>
        <Field label="Description">
          <Textarea
            autoFocus={focusDescription}
            rows={3}
            value={page.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </Field>
      </PanelSection>
      <Separator />
      <PanelSection
        title="URL"
        description="Changing the slug can update links and redirect the old URL."
      >
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Slug" className="min-w-40 flex-1">
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </Field>
          <Button
            icon="check"
            onClick={applySlug}
            disabled={slug === page.slug}
          >
            Apply slug change
          </Button>
        </div>
        <Toggle
          label="Update matching internal links when the slug changes"
          checked={updateLinks}
          onChange={setUpdateLinks}
        />
        <Toggle
          label="Redirect the old page URL to this page"
          checked={keepRedirect}
          onChange={setKeepRedirect}
        />
      </PanelSection>
      <Separator />
      <PanelSection title="Publication">
        <Toggle
          label="Include this page in the next publication"
          checked={!page.draft}
          onChange={(v) => patch({ draft: !v })}
        />
        <Toggle
          label="Hide from readers and search"
          checked={page.hidden}
          onChange={(hidden) => patch({ hidden })}
        />
      </PanelSection>
      <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3.5">
        <p className="text-xs font-semibold text-destructive">Danger zone</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Removing the page from the draft keeps the published version live
          until you publish again.
        </p>
        <Button
          variant="outline"
          icon="trash"
          className="mt-3 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
          onClick={onDelete}
        >
          Delete page
        </Button>
      </div>
    </div>
  );
}

export function NavigationSettings({ product: p, change }: ProductProps) {
  const all = flatten(p.nav);
  const [dragPage, setDragPage] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState("");
  const unassigned = p.pages.filter(
    (page) => !all.some((n) => n.pageId === page.id),
  );
  const move = (pageId: string, parentId: string | null, before?: string) => {
    change(movePage(p, pageId, parentId, before));
    setDragPage(null);
    setDropTarget("");
  };
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<"tab" | "group" | "page">("group");
  const [title, setTitle] = useState("");
  const [parent, setParent] = useState(p.nav[0]?.id || "root");
  const [pageId, setPageId] = useState(p.pages[0]?.id || "");
  const mutate = (id: string, fn: (n: Nav) => Nav) => {
    const walk = (nodes: Nav[]): Nav[] =>
      nodes.map((n) =>
        n.id === id ? fn(n) : { ...n, children: walk(n.children) },
      );
    change({ ...p, nav: walk(p.nav) });
  };
  const remove = (nodes: Nav[], id: string): Nav[] =>
    nodes
      .filter((n) => n.id !== id)
      .map((n) => ({ ...n, children: remove(n.children, id) }));
  const insert = (nodes: Nav[], parent: string, node: Nav): Nav[] =>
    parent
      ? nodes.map((n) =>
          n.id === parent
            ? { ...n, children: [...n.children, node] }
            : { ...n, children: insert(n.children, parent, node) },
        )
      : [...nodes, node];
  function rows(nodes: Nav[], depth = 0): React.ReactNode {
    return nodes.map((n, i) => (
      <div key={n.id}>
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1.5 transition-colors",
            dropTarget === n.id &&
              "border-primary ring-2 ring-primary/20",
          )}
          onDragOver={(e) => {
            if (dragPage) {
              e.preventDefault();
              e.stopPropagation();
              setDropTarget(n.id);
            }
          }}
          onDrop={(e) => {
            if (!dragPage) return;
            e.preventDefault();
            e.stopPropagation();
            const parent =
              n.type === "page"
                ? all.find((x) => x.children.some((c) => c.id === n.id))?.id
                : n.id;
            if (parent)
              move(dragPage, parent, n.type === "page" ? n.pageId : undefined);
          }}
          style={{ marginLeft: depth * 14 }}
        >
          {n.type === "page" ? (
            <button
              type="button"
              className="grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
              draggable
              aria-label={"Drag " + n.title}
              onDragStart={(e) => {
                setDragPage(n.pageId!);
                e.dataTransfer.setData("text/plain", n.pageId!);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDragPage(null);
                setDropTarget("");
              }}
            >
              <Icon value="grip-vertical" className="size-3.5" />
            </button>
          ) : (
            <span className="size-7 shrink-0" />
          )}
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <Icon
              value={
                n.type === "tab"
                  ? "folder-open"
                  : n.type === "group"
                    ? "folder"
                    : "file-lines"
              }
              className="size-3.5"
            />
          </span>
          <Input
            aria-label="Navigation title"
            className="h-8 min-w-24 flex-1 basis-28 px-2 text-[13px]"
            value={n.title}
            onChange={(e) =>
              mutate(n.id, (x) => ({ ...x, title: e.target.value }))
            }
          />
          <IconPicker
            compact
            value={n.icon || { name: "" }}
            onChange={(icon) => mutate(n.id, (x) => ({ ...x, icon }))}
          />
          <Select
            value=""
            onValueChange={(value) => {
              if (value === "unassigned" && n.pageId) move(n.pageId, null);
              else
                change({
                  ...p,
                  nav: insert(
                    remove(p.nav, n.id),
                    value === "root" ? "" : value,
                    n,
                  ),
                });
            }}
          >
            <SelectTrigger
              size="sm"
              className="h-8 w-32 text-xs"
              aria-label={"Move " + n.title + " to"}
            >
              <span className="truncate text-muted-foreground">
                Move to…
              </span>
            </SelectTrigger>
            <SelectContent>
              {n.type === "page" ? (
                <SelectItem value="unassigned">Uncategorized</SelectItem>
              ) : null}
              {n.type === "tab" ? (
                <SelectItem value="root">Top level</SelectItem>
              ) : null}
              {all
                .filter(
                  (x) =>
                    x.type !== "page" &&
                    !flatten([n]).some((y) => y.id === x.id),
                )
                .map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {[-1, 1].map((d) => (
            <IconButton
              key={d}
              icon={d < 0 ? "arrow-up" : "arrow-down"}
              label={"Move " + n.title + (d < 0 ? " up" : " down")}
              className="size-7"
              disabled={!nodes[i + d]}
              onClick={() => {
                const next = [...nodes];
                [next[i], next[i + d]] = [next[i + d], next[i]];
                if (depth === 0) change({ ...p, nav: next });
                else {
                  const par = all.find((x) =>
                    x.children.some((c) => c.id === n.id),
                  );
                  if (par) mutate(par.id, (x) => ({ ...x, children: next }));
                }
              }}
            />
          ))}
          <IconButton
            icon="trash"
            label={"Delete " + n.title}
            className="size-7 text-muted-foreground hover:text-destructive"
            disabled={n.children.length > 0}
            onClick={() => change({ ...p, nav: remove(p.nav, n.id) })}
          />
        </div>
        {rows(n.children, depth + 1)}
      </div>
    ));
  }
  return (
    <div className="grid gap-5">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Tabs are sections within this product. Groups organize the sidebar.
        Empty containers can be deleted.
      </p>
      <section
        className={cn(
          "rounded-lg border border-dashed border-border p-3 transition-colors",
          dropTarget === "unassigned" && "border-primary bg-primary/5",
        )}
        onDragOver={(e) => {
          if (dragPage) {
            e.preventDefault();
            setDropTarget("unassigned");
          }
        }}
        onDrop={(e) => {
          if (dragPage) {
            e.preventDefault();
            move(dragPage, null);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Uncategorized pages</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              These pages appear above sidebar groups. Drag a page here to
              remove it from a group.
            </p>
          </div>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {unassigned.length}
          </Badge>
        </div>
        {unassigned.length ? (
          <div className="mt-3 grid gap-1.5">
            {unassigned.map((page, i) => (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background p-1.5",
                  dropTarget === page.id && "border-primary ring-2 ring-primary/20",
                )}
                key={page.id}
                onDragOver={(e) => {
                  if (dragPage) {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropTarget(page.id);
                  }
                }}
                onDrop={(e) => {
                  if (dragPage) {
                    e.preventDefault();
                    e.stopPropagation();
                    move(dragPage, null, page.id);
                  }
                }}
              >
                <button
                  type="button"
                  className="grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-accent active:cursor-grabbing"
                  draggable
                  aria-label={"Drag " + page.title}
                  onDragStart={(e) => {
                    setDragPage(page.id);
                    e.dataTransfer.setData("text/plain", page.id);
                  }}
                  onDragEnd={() => {
                    setDragPage(null);
                    setDropTarget("");
                  }}
                >
                  <Icon value="grip-vertical" className="size-3.5" />
                </button>
                <span className="min-w-0 flex-1 truncate px-1 text-[13px]">
                  {page.title}
                </span>
                <Select
                  value=""
                  onValueChange={(value) => move(page.id, value)}
                >
                  <SelectTrigger
                    size="sm"
                    className="h-8 w-36 text-xs"
                    aria-label={"Move " + page.title + " to"}
                  >
                    <span className="truncate text-muted-foreground">
                      Move to group…
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {all
                      .filter((n) => n.type !== "page")
                      .map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <IconButton
                  icon="arrow-up"
                  label={"Move " + page.title + " up"}
                  className="size-7"
                  disabled={i === 0}
                  onClick={() =>
                    move(page.id, null, unassigned[i - 1]?.id)
                  }
                />
                <IconButton
                  icon="arrow-down"
                  label={"Move " + page.title + " down"}
                  className="size-7"
                  disabled={i === unassigned.length - 1}
                  onClick={() =>
                    move(page.id, null, unassigned[i + 2]?.id)
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Every page is assigned to a group.
          </p>
        )}
      </section>
      <div className="grid gap-2">{rows(p.nav)}</div>
      {creating ? (
        <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">New navigation item</h3>
            <IconButton
              icon="xmark"
              label="Cancel"
              className="size-7"
              onClick={() => setCreating(false)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Type"
              value={type}
              onValueChange={(value) => setType(value as typeof type)}
              options={[
                { value: "tab", label: "Tab" },
                { value: "group", label: "Group" },
                { value: "page", label: "Page" },
              ]}
            />
            {type === "page" ? (
              <SelectField
                label="Page"
                value={pageId}
                onValueChange={setPageId}
                options={p.pages.map((x) => ({
                  value: x.id,
                  label: x.title,
                }))}
              />
            ) : (
              <Field label="Title">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
            )}
          </div>
          {type !== "tab" ? (
            <SelectField
              label="Parent"
              value={parent}
              onValueChange={setParent}
              options={[
                { value: "root", label: "Top level" },
                ...all
                  .filter((x) => x.type !== "page")
                  .map((x) => ({ value: x.id, label: x.title })),
              ]}
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              icon="plus"
              disabled={type === "page" ? !pageId : !title.trim()}
              onClick={() => {
                const n: Nav = {
                  id: uid(),
                  type,
                  title:
                    type === "page"
                      ? p.pages.find((x) => x.id === pageId)!.title
                      : title,
                  pageId: type === "page" ? pageId : undefined,
                  children: [],
                };
                change({
                  ...p,
                  nav: insert(
                    p.nav,
                    type === "tab" || parent === "root" ? "" : parent,
                    n,
                  ),
                });
                setCreating(false);
                setTitle("");
              }}
            >
              Add item
            </Button>
          </div>
        </div>
      ) : (
        <Button
          icon="plus"
          className="w-full justify-start"
          onClick={() => setCreating(true)}
        >
          Add navigation item
        </Button>
      )}
    </div>
  );
}

function QualityPanel({
  product,
  onOpenIssue,
  busy,
}: {
  product: Product;
  onOpenIssue: (issue: QualityIssue) => void;
  busy: boolean;
}) {
  const [revision, setRevision] = useState(0),
    [filter, setFilter] = useState("all");
  const snapshot = useMemo(
    () => ({ checks: publishChecks(product), revision }),
    [product, revision],
  );
  const { checks } = snapshot;
  const warnings = checks.issues.filter(
    (issue) => issue.severity === "warning",
  ).length;
  const suggestions = checks.issues.length - warnings;
  const summary = [
    warnings === 1 ? "1 warning" : warnings + " warnings",
    suggestions === 1 ? "1 suggestion" : suggestions + " suggestions",
  ].join(" · ");
  const visible = checks.issues.filter(
    (issue) => filter === "all" || issue.severity === filter,
  );
  return (
    <section
      className="grid gap-4 rounded-lg border border-border bg-card p-4"
      aria-labelledby="quality-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 id="quality-title" className="text-sm font-semibold">
            Content quality
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Review links, descriptions, images, and heading structure. These
            checks do not block publishing.
          </p>
        </div>
        <Button
          size="sm"
          icon="rotate-right"
          disabled={busy}
          onClick={() => setRevision((value) => value + 1)}
        >
          Recheck
        </Button>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {snapshot.revision > 0
          ? "Check " + snapshot.revision + " complete. "
          : ""}
        {checks.issues.length ? summary : "No issues found in these checks."}
      </p>
      {checks.issues.length > 0 ? (
        <>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="Filter quality issues"
          >
            {[
              ["all", "All"],
              ["warning", "Warnings"],
              ["suggestion", "Suggestions"],
            ].map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          {visible.length ? (
            <ul className="grid gap-2">
              {visible.map((issue) => (
                <li
                  key={issue.id}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 px-1.5 text-[10px]",
                        issue.severity === "warning"
                          ? "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {issue.severity === "warning"
                        ? "Warning"
                        : "Suggestion"}
                    </Badge>
                    <strong className="text-[13px] font-medium">
                      {issue.page}
                    </strong>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {issue.message}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {issue.snippet
                        ? "Snippet: " + issue.snippet + " · "
                        : ""}
                      {issue.target === "settings"
                        ? "Page description"
                        : "Line " + issue.line}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      disabled={busy}
                      onClick={() => onOpenIssue(issue)}
                      aria-label={
                        (issue.target === "settings"
                          ? "Open page settings"
                          : "Open source") +
                        " for " +
                        issue.page +
                        (issue.snippet ? ", snippet " + issue.snippet : "") +
                        ", " +
                        issue.code
                      }
                    >
                      {issue.target === "settings"
                        ? "Open page settings"
                        : "Open source"}
                      <Icon value="arrow-right" className="size-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              No {filter === "warning" ? "warnings" : "suggestions"} found.{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-2"
                onClick={() => setFilter("all")}
              >
                Show all issues
              </button>
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}

export function PublishReview({
  record,
  onPublish,
  onOpenIssue,
  busy,
}: {
  record: ProductRecord;
  onPublish: () => void;
  onOpenIssue: (issue: QualityIssue) => void;
  busy: boolean;
}) {
  const d = publicationDiff(record.draft, record.published);
  const excluded = record.draft.pages
    .filter((page) => page.hidden || page.draft)
    .map((page) => ({
      title: page.title,
      reason:
        page.hidden && page.draft
          ? "Hidden and draft"
          : page.hidden
            ? "Hidden"
            : "Draft",
    }));
  const errors = [
    ...validate(record.draft),
    ...record.draft.pages
      .filter((p) => !p.draft)
      .flatMap((p) => {
        const e = parse(p.source).error;
        return e ? [p.title + ": " + e] : [];
      }),
  ];
  return (
    <div className="grid gap-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Publish <strong className="text-foreground">{record.draft.name}</strong>
        . Other products will stay unchanged.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Added", d.added.length],
          ["Changed", d.changed.length],
          ["Removed", d.removed.length],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="text-xl font-semibold tabular-nums">{value}</div>
            <div className="text-[11px] font-medium text-muted-foreground">
              {label}
            </div>
          </div>
        ))}
      </div>
      {errors.length > 0 ? (
        <Note tone="danger">
          <strong>Resolve these issues before publishing</strong>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Note>
      ) : null}
      <QualityPanel
        product={record.draft}
        onOpenIssue={onOpenIssue}
        busy={busy}
      />
      {excluded.length > 0 ? (
        <details className="diff">
          <summary>
            {excluded.length} pages excluded from publication
          </summary>
          <ul className="space-y-1 px-4 pb-3 text-sm">
            {excluded.map((page, i) => (
              <li key={i} className="flex items-center gap-2">
                <span>{page.title}</span>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {page.reason}
                </Badge>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {d.configuration ? (
        <details className="diff">
          <summary>Product settings, homepage, or navigation changed</summary>
          <div className="diff-columns">
            <pre>
              {JSON.stringify(
                record.published
                  ? { ...record.published, pages: undefined }
                  : null,
                null,
                2,
              )}
            </pre>
            <pre>
              {JSON.stringify({ ...record.draft, pages: undefined }, null, 2)}
            </pre>
          </div>
        </details>
      ) : null}
      {[...d.added, ...d.changed, ...d.removed].map((page) => (
        <details className="diff" key={page.id}>
          <summary>
            {page.title}{" "}
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {d.added.includes(page)
                ? "Added"
                : d.removed.includes(page)
                  ? "Removed"
                  : "Changed"}
              {page.draft ? " · draft only" : ""}
            </Badge>
          </summary>
          <div className="diff-columns">
            <pre>
              {record.published?.pages.find((x) => x.id === page.id)?.source ||
                "No previous page"}
            </pre>
            <pre>
              {record.draft.pages.find((x) => x.id === page.id)?.source ||
                "Page removed"}
            </pre>
          </div>
        </details>
      ))}
      <div className="flex justify-end">
        <Button
          variant="default"
          icon="paper-plane"
          disabled={busy || !!errors.length}
          onClick={onPublish}
        >
          {busy ? "Publishing…" : "Publish " + record.draft.name}
        </Button>
      </div>
    </div>
  );
}

export function FindReplace({
  product: p,
  change,
  pageId,
  notify,
}: ProductProps & { pageId: string }) {
  const [find, setFind] = useState(""),
    [to, setTo] = useState(""),
    [scope, setScope] = useState("page"),
    [matchCase, setMatchCase] = useState(false),
    [prose, setProse] = useState(true),
    [preview, setPreview] = useState(false);
  const results = p.pages
    .filter((x) => scope === "product" || x.id === pageId)
    .map((page) => ({
      page,
      ...replacement(page.source, find, to, matchCase, prose),
    }))
    .filter((x) => x.count);
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Find">
          <Input
            value={find}
            onChange={(e) => {
              setFind(e.target.value);
              setPreview(false);
            }}
          />
        </Field>
        <Field label="Replace with">
          <Input
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPreview(false);
            }}
          />
        </Field>
      </div>
      <SelectField
        label="Search in"
        value={scope}
        onValueChange={(value) => {
          setScope(value);
          setPreview(false);
        }}
        options={[
          { value: "page", label: "Current page" },
          { value: "product", label: "Entire product" },
        ]}
      />
      <div className="grid gap-2 rounded-lg border border-border p-2">
        <Toggle
          compact
          label="Match case"
          checked={matchCase}
          onChange={(v) => {
            setMatchCase(v);
            setPreview(false);
          }}
        />
        <Toggle
          compact
          label="Prose only (skip code and component properties)"
          checked={prose}
          onChange={(v) => {
            setProse(v);
            setPreview(false);
          }}
        />
      </div>
      <Button disabled={!find} onClick={() => setPreview(true)}>
        Preview changes
      </Button>
      {preview ? (
        <>
          <Note>
            {results.reduce((a, x) => a + x.count, 0)} replacements across{" "}
            {results.length} {results.length === 1 ? "page" : "pages"}.
          </Note>
          {results.map((r) => (
            <details className="diff" key={r.page.id}>
              <summary>
                {r.page.title} · {r.count} replacements
              </summary>
              <div className="diff-columns">
                <pre>{r.page.source}</pre>
                <pre>{r.source}</pre>
              </div>
            </details>
          ))}
          <div className="flex justify-end">
            <Button
              variant="default"
              disabled={!results.length}
              onClick={() => {
                change({
                  ...p,
                  pages: p.pages.map((x) => {
                    const result = results.find((r) => r.page.id === x.id);
                    return result ? { ...x, source: result.source } : x;
                  }),
                });
                setPreview(false);
                notify("Replacements applied to the draft");
              }}
            >
              Apply replacements
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function LinkTools({
  product: p,
  pageId,
}: {
  product: Product;
  pageId: string;
}) {
  const page = p.pages.find((x) => x.id === pageId);
  const url = "/" + p.slug + "/" + page?.slug;
  const backlinks = p.pages.filter(
    (x) => x.id !== pageId && x.source.includes(url),
  );
  const broken = p.pages.flatMap((x) =>
    [...x.source.matchAll(/(?:\]\(|href=["'])(\/[^\s"')]+)/g)].flatMap((m) => {
      const path = m[1].split("#")[0];
      if (!path.startsWith("/" + p.slug + "/")) return [];
      return p.pages.some((y) => "/" + p.slug + "/" + y.slug === path)
        ? []
        : [{ title: x.title, url: m[1] }];
    }),
  );
  return (
    <div className="grid gap-6">
      <PanelSection
        title={"Backlinks to " + (page?.title || "this page")}
        description="Pages that point readers here."
      >
        {backlinks.length ? (
          <div className="grid gap-1.5">
            {backlinks.map((x) => (
              <div
                key={x.id}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
              >
                <Icon value={x.icon} className="size-3.5 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {x.title}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Note>No pages link to this page yet.</Note>
        )}
      </PanelSection>
      <Separator />
      <PanelSection
        title="Broken links in this product"
        description="Links that point at pages which no longer exist."
      >
        {broken.length ? (
          <Note tone="danger">
            <ul className="space-y-1">
              {broken.map((x, i) => (
                <li key={i}>
                  <strong>{x.title}</strong>: {x.url}
                </li>
              ))}
            </ul>
          </Note>
        ) : (
          <Note tone="success">No broken page links found.</Note>
        )}
      </PanelSection>
    </div>
  );
}

export function SnippetSettings({
  product: p,
  change,
  issue,
}: ProductProps & { issue?: QualityIssue }) {
  const [name, setName] = useState(
      issue?.snippet || Object.keys(p.snippets)[0] || "",
    ),
    [creating, setCreating] = useState("");
  return (
    <div className="grid gap-5">
      <SelectField
        label="Snippet"
        value={name}
        onValueChange={setName}
        placeholder="Choose a snippet"
        options={Object.keys(p.snippets).map((x) => ({
          value: x,
          label: x,
        }))}
      />
      <div className="flex flex-wrap items-end gap-2">
        <Field label="New snippet" className="min-w-40 flex-1">
          <Input
            aria-label="New snippet name"
            placeholder="New snippet name"
            value={creating}
            onChange={(e) => setCreating(e.target.value)}
          />
        </Field>
        <Button
          icon="plus"
          disabled={!creating || !!p.snippets[creating]}
          onClick={() => {
            change({
              ...p,
              snippets: { ...p.snippets, [creating]: "Reusable content.\n" },
            });
            setName(creating);
            setCreating("");
          }}
        >
          Create
        </Button>
      </div>
      {name && p.snippets[name] !== undefined ? (
        <>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{name}</h3>
              <Button
                variant="ghost"
                size="sm"
                icon="trash"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => {
                  const snippets = { ...p.snippets };
                  delete snippets[name];
                  change({ ...p, snippets });
                  setName("");
                }}
              >
                Delete snippet
              </Button>
            </div>
            <SourceEditor
              target={name === issue?.snippet ? issue : undefined}
              value={p.snippets[name]}
              onChange={(s) =>
                change({ ...p, snippets: { ...p.snippets, [name]: s } })
              }
              label="Snippet source"
            />
          </div>
          <Note>
            Insert with{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              {'<Snippet name="' + name + '" />'}
            </code>
          </Note>
        </>
      ) : null}
    </div>
  );
}

export function NewPagePanel({
  product: p,
  onCreate,
}: {
  product: Product;
  onCreate: (page: Page) => void;
}) {
  const [title, setTitle] = useState(""),
    [template, setTemplate] = useState("Blank");
  const choices = [
    { name: "Blank", source: "Start writing your documentation.\n" },
    ...Object.entries(templates).map(([name, source]) => ({ name, source })),
    ...p.templates,
  ];
  return (
    <div className="grid gap-5">
      <Field label="Title" hint="Use a clear, specific page title.">
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A clear, helpful title"
        />
      </Field>
      <SelectField
        label="Template"
        value={template}
        onValueChange={setTemplate}
        options={choices.map((x) => ({ value: x.name, label: x.name }))}
      />
      <div className="flex justify-end">
        <Button
          variant="default"
          icon="plus"
          disabled={!title.trim()}
          onClick={() =>
            onCreate(
              newPage(title, choices.find((x) => x.name === template)!.source),
            )
          }
        >
          Create draft page
        </Button>
      </div>
    </div>
  );
}

export { HistoryPanel } from "./page-history";

export function WorkspaceSettings({
  workspace,
  revision,
  onSave,
  notify,
}: {
  workspace: Workspace;
  revision: number;
  onSave: (w: Workspace, r: number) => void;
  notify: (s: string) => void;
}) {
  const [w, setW] = useState(workspace),
    [saving, setSaving] = useState(false);
  return (
    <div className="grid gap-6">
      <PanelSection
        title="Workspace"
        description="Shared identity across every product and reader."
      >
        {(
          [
            "name",
            "logoLight",
            "logoDark",
            "announcement",
            "announcementUrl",
          ] as const
        ).map((k) => (
          <Field
            key={k}
            label={
              {
                name: "Workspace name",
                logoLight: "Light theme logo URL",
                logoDark: "Dark theme logo URL",
                announcement: "Announcement",
                announcementUrl: "Announcement link",
              }[k]
            }
          >
            <Input
              value={w[k]}
              onChange={(e) => setW({ ...w, [k]: e.target.value })}
            />
          </Field>
        ))}
        <SelectField
          label="Default theme"
          value={w.theme}
          onValueChange={(value) => setW({ ...w, theme: value })}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />
      </PanelSection>
      <Separator />
      <PanelSection
        title="External links"
        description="Shown in the reader sidebar and workspace."
      >
        <div className="grid gap-2">
          {w.links.map((x, i) => (
            <div
              key={i}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center"
            >
              <Input
                aria-label="Link title"
                value={x.title}
                onChange={(e) =>
                  setW({
                    ...w,
                    links: w.links.map((a, j) =>
                      j === i ? { ...a, title: e.target.value } : a,
                    ),
                  })
                }
              />
              <Input
                aria-label="Link URL"
                value={x.href}
                onChange={(e) =>
                  setW({
                    ...w,
                    links: w.links.map((a, j) =>
                      j === i ? { ...a, href: e.target.value } : a,
                    ),
                  })
                }
              />
              <IconButton
                icon="trash"
                label="Remove link"
                className="justify-self-end"
                onClick={() =>
                  setW({ ...w, links: w.links.filter((_, j) => i !== j) })
                }
              />
            </div>
          ))}
        </div>
        <Button
          icon="plus"
          className="justify-self-start"
          onClick={() =>
            setW({ ...w, links: [...w.links, { title: "", href: "" }] })
          }
        >
          Add link
        </Button>
      </PanelSection>
      <div className="flex justify-end">
        <Button
          variant="default"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const r = await api<{ revision: number }>("/api/workspace", {
                method: "PUT",
                body: JSON.stringify({ workspace: w, revision }),
              });
              onSave(w, r.revision);
              notify("Workspace settings saved");
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save workspace settings"}
        </Button>
      </div>
    </div>
  );
}
export { MediaPanel } from "./media-library";

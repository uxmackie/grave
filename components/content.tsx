"use client";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Tabs as BaseTabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Popover } from "radix-ui";
import {
  parse,
  raw,
  replaceNode,
  attributes,
  setAttribute,
  setAttributes,
  headingId,
  headings,
  textOf,
  safeUrl,
  codeSource,
  quoteAttribute,
  blocks,
  type Node,
} from "@/lib/mdx";
import { Button, Icon, Field, copyText, emojiNodes } from "./grave-ui";
import {
  Button as EButton,
  Field as EField,
  Input as EInput,
  PanelDialog,
  PanelSection,
  Select,
  SelectContent,
  SelectField as ESelectField,
  SelectItem,
  SelectTrigger,
  Separator,
  Textarea as ETextarea,
  Toggle as EToggle,
} from "./editor/ui";
import { cn } from "@/lib/utils";
import { highlightWith, loadPrism, loadedPrism } from "@/lib/highlight";
import type { Product, IconValue } from "@/lib/model";
import { readerLink } from "@/lib/reader-links";

const blockIcons: Record<string, string> = {
  Paragraph: "paragraph",
  Heading: "heading",
  Callout: "comment-dots",
  Card: "square",
  CardGroup: "table-columns",
  Code: "code",
  CodeGroup: "layer-group",
  Image: "image",
  Icon: "icons",
  Divider: "minus",
  Table: "table",
  Steps: "list-ol",
  Step: "list-ol",
  Tabs: "folder-open",
  Mermaid: "diagram-project",
  Snippet: "puzzle-piece",
};
import { inlineMarkdown, selectionMarkdown } from "@/lib/dom-markdown";
import {
  convertible,
  convertTextBlock,
  insertBlock,
  continueList,
} from "@/lib/authoring";

// Editing-only surfaces stay out of the reader bundle. They are resolved the
// first time someone actually selects text, edits a component, or inserts an
// icon in the editor.
const LazyFormatToolbar = React.lazy(() =>
  import("./format-toolbar").then((module) => ({
    default: module.FormatToolbar,
  })),
);
const LazyIconPicker = React.lazy(() =>
  import("./editor/icon-picker").then((module) => ({
    default: module.IconPicker,
  })),
);
type Props = {
  source: string;
  product: Product;
  onChange?: (s: string) => void;
  notify: (s: string) => void;
  onImage?: (node?: Node, offset?: number | null) => void;
  snippetStack?: string[];
  printing?: boolean;
};
export const Highlight = React.memo(function Highlight({
  text,
  language = "markup",
}: {
  text: string;
  language?: string;
}) {
  const [html, setHtml] = useState<string | null>(() => {
    const prism = loadedPrism();
    return prism ? highlightWith(prism, text, language) : null;
  });
  useEffect(() => {
    let live = true;
    const prism = loadedPrism();
    if (prism) {
      setHtml(highlightWith(prism, text, language));
      return;
    }
    loadPrism()
      .then((loaded) => {
        if (live) setHtml(highlightWith(loaded, text, language));
      })
      .catch(() => {
        if (live) setHtml(null);
      });
    return () => {
      live = false;
    };
  }, [text, language]);
  return html ? (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span>{text}</span>
  );
});
export function SourceEditor({
  value,
  onChange,
  label = "MDX source",
  target,
}: {
  value: string;
  onChange: (s: string) => void;
  label?: string;
  target?: { start: number; end: number };
}) {
  const overlay = useRef<HTMLPreElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const escaped = useRef(false);
  const hintId = useId();
  useEffect(() => {
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      const el = input.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(target.start, target.end);
      const mirror = document.createElement("div");
      const style = getComputedStyle(el);
      for (const key of [
        "font",
        "lineHeight",
        "letterSpacing",
        "padding",
        "boxSizing",
        "wordBreak",
        "overflowWrap",
      ] as const)
        mirror.style[key] = style[key];
      Object.assign(mirror.style, {
        position: "absolute",
        visibility: "hidden",
        width: el.clientWidth + "px",
        whiteSpace: "pre-wrap",
      });
      mirror.textContent = el.value.slice(0, target.start);
      const marker = document.createElement("span");
      marker.textContent = "|";
      mirror.appendChild(marker);
      document.body.appendChild(mirror);
      el.scrollTop = Math.max(0, marker.offsetTop - el.clientHeight / 3);
      mirror.remove();
      el.dispatchEvent(new Event("scroll"));
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return (
    <>
      <span id={hintId} className="sr-only">
        Press Escape, then Tab to leave the editor. Tab indents selected
        lines.
      </span>
      <div className="source-editor">
        <pre ref={overlay} aria-hidden>
          {value.split("\n").map((line, index) => (
            <span className="source-line" data-line={index + 1} key={index}>
              <Highlight text={line || "\u200b"} />
            </span>
          ))}
        </pre>
        <textarea
          ref={input}
          wrap="soft"
          aria-label={label}
          aria-describedby={hintId}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            escaped.current = false;
          }}
          onScroll={(e) => {
            if (overlay.current) {
              overlay.current.scrollTop = e.currentTarget.scrollTop;
              overlay.current.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              escaped.current = true;
              return;
            }
            if (e.key === "Tab" && escaped.current) {
              escaped.current = false;
              return;
            }
            if (
              e.key !== "Tab" ||
              e.ctrlKey ||
              e.metaKey ||
              e.altKey
            ) {
              escaped.current = false;
              return;
            }

            const el = e.currentTarget;
            const current = el.value;
            const a = el.selectionStart;
            const b = el.selectionEnd;

            // Shift+Tab with no selection is reserved for leaving the editor.
            if (e.shiftKey && a === b) {
              escaped.current = false;
              return;
            }

            e.preventDefault();
            if (a === b) {
              onChange(current.slice(0, a) + "  " + current.slice(a));
              requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
              return;
            }

            const lineStart = current.lastIndexOf("\n", a - 1) + 1;
            const selectionEnd =
              b > a && current[b - 1] === "\n" ? b - 1 : b;
            const nextBreak = current.indexOf("\n", selectionEnd);
            const lineEnd = nextBreak === -1 ? current.length : nextBreak;
            const block = current.slice(lineStart, lineEnd);
            const lines = block.split("\n");
            const adjusted = e.shiftKey
              ? lines.map((line) => line.replace(/^ {1,2}/, ""))
              : lines.map((line) => (line ? "  " + line : line));
            const replacement = adjusted.join("\n");
            const delta = replacement.length - block.length;
            const firstDelta = adjusted[0].length - lines[0].length;
            const nextStart = Math.max(lineStart, a + firstDelta);
            const nextEnd = Math.max(nextStart, b + delta);
            onChange(
              current.slice(0, lineStart) +
                replacement +
                current.slice(lineEnd),
            );
            requestAnimationFrame(() =>
              el.setSelectionRange(nextStart, nextEnd),
            );
          }}
        />
      </div>
    </>
  );
}
function Diagram({
  value,
  printing = false,
}: {
  value: string;
  printing?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [rendered, setRendered] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!ready && !printing) return;
    let cancelled = false;
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: printing
            ? "default"
            : document.documentElement.dataset.theme === "dark"
              ? "dark"
              : "default",
        });
        const { svg } = await mermaid.render(
          "diagram-" + crypto.randomUUID(),
          value,
        );
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setRendered(true);
        }
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [value, ready, printing]);
  return (
    <div className="diagram-container">
      {error && (
        <p className="error">
          Diagram could not render. Check the diagram source.
        </p>
      )}
      <div
        ref={ref}
        className="mermaid"
        aria-label="Mermaid diagram"
        data-rendering={!rendered && !error ? true : undefined}
      />
      {!rendered && (
        <pre className={printing ? "diagram-source" : "diagram-placeholder"}>
          {printing || error ? value : "Diagram loads as you scroll."}
        </pre>
      )}
    </div>
  );
}
function CodeBlock({
  node,
  editable,
  onValue,
  notify,
}: {
  node: Node;
  editable: boolean;
  onValue: (value: string, meta?: string) => void;
  notify: (s: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [wrap, setWrap] = useState(!!node.meta?.includes("wrap"));
  const meta = node.meta || "",
    title = meta.match(/title="([^"]+)"/)?.[1] || node.lang || "Code";
  const range = (key: string) => {
    const match = meta.match(new RegExp(key + '="([^"]+)"'));
    const numbers = new Set<number>();
    for (const part of match?.[1]?.split(",") || []) {
      const [a, b] = part.split("-").map(Number);
      for (let i = a; i <= (b || a) && i < a + 10000; i++) numbers.add(i);
    }
    return numbers;
  };
  const highlighted = range("highlight"),
    focused = range("focus");
  return (
    <div className="code-block">
      <div className="code-header">
        <span>{title}</span>
        <div className="row">
          <Button
            aria-label="Toggle code wrapping"
            onClick={() => {
              setWrap(!wrap);
              if (editable)
                onValue(
                  node.value || "",
                  wrap ? meta.replace(/\bwrap\b/g, "") : meta + " wrap",
                );
            }}
            icon="text-width"
          />
          <Button
            icon="copy"
            aria-label="Copy code"
            onClick={() => copyText(node.value || "", notify)}
          />
        </div>
      </div>
      {editable ? (
        <>
          <textarea
            aria-label="Code example"
            className="code-input"
            value={node.value || ""}
            onChange={(e) => onValue(e.target.value)}
            spellCheck={false}
          />
          <details className="code-options">
            <summary>Code options</summary>
            <Field label="Language">
              <input
                value={node.lang || ""}
                onChange={(e) =>
                  onValue(node.value || "", `LANG:${e.target.value}`)
                }
              />
            </Field>
            <Field label="Filename">
              <input
                value={title}
                onChange={(e) =>
                  onValue(
                    node.value || "",
                    meta.replace(/title="[^"]*"/, "") +
                      ` title=${JSON.stringify(e.target.value)}`,
                  )
                }
              />
            </Field>
            <Field label="Options: showLineNumbers, wrap, expandable, highlight and focus ranges">
              <input
                value={meta}
                onChange={(e) => onValue(node.value || "", e.target.value)}
              />
            </Field>
          </details>
        </>
      ) : (
        <pre
          className={
            (wrap ? "wrap " : "") +
            (meta.includes("expandable") && !expanded ? "collapsed" : "")
          }
        >
          <code>
            {(node.value || "").split("\n").map((line, i) => (
              <span
                className={
                  "code-line " +
                  (highlighted.has(i + 1) ? "highlight " : "") +
                  (focused.size && !focused.has(i + 1) ? "unfocused" : "")
                }
                key={i}
              >
                {meta.includes("showLineNumbers") && (
                  <span className="line-number">{i + 1}</span>
                )}
                <Highlight text={line || " "} language={node.lang} />
                {"\n"}
              </span>
            ))}
          </code>
        </pre>
      )}
      {meta.includes("expandable") && (
        <Button onClick={() => setExpanded(!expanded)}>
          {expanded ? "Collapse code" : "Expand code"}
        </Button>
      )}
    </div>
  );
}
function Tabs({
  nodes,
  render,
  code = false,
  preferred = -1,
  printing = false,
}: {
  nodes: Node[];
  render: (n: Node, i: number) => React.ReactNode;
  code?: boolean;
  preferred?: number;
  printing?: boolean;
}) {
  const [index, setIndex] = useState(preferred >= 0 ? String(preferred) : "0");
  useEffect(() => {
    if (preferred >= 0) setIndex(String(preferred));
  }, [preferred]);
  const active = Number(index) < nodes.length ? index : "0";
  if (printing)
    return (
      <div className="print-tabs">
        {nodes.map((node, i) => (
          <section key={i}>
            <h3>
              {code
                ? node.meta?.match(/title="([^"]+)"/)?.[1] ||
                  node.lang ||
                  "Code"
                : String(attributes(node).title || "Section")}
            </h3>
            {render(node, i)}
          </section>
        ))}
      </div>
    );
  return (
    <BaseTabs className="content-tabs" value={active} onValueChange={setIndex}>
      <TabsList
        className="tab-bar"
        aria-label={code ? "Code examples" : "Content tabs"}
      >
        {nodes.map((n, i) => (
          <TabsTrigger value={String(i)} key={i}>
            {code
              ? n.meta?.match(/title="([^"]+)"/)?.[1] ||
                n.lang ||
                "Example " + (i + 1)
              : String(attributes(n).title || "Tab " + (i + 1))}
          </TabsTrigger>
        ))}
      </TabsList>
      {nodes.map((n, i) => (
        <TabsContent value={String(i)} key={i}>
          {Number(active) === i && render(n, i)}
        </TabsContent>
      ))}
    </BaseTabs>
  );
}
function InlineIcon({
  icon,
  tooltip,
  mdx,
  href,
  label,
  onEdit,
  children,
}: {
  icon: IconValue;
  tooltip: string;
  mdx: string;
  href?: string;
  label?: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const linked = !!href?.trim() && !onEdit;
  const Trigger = linked ? "a" : "span";
  const trigger = (
    <Trigger
      href={linked ? safeUrl(href!) : undefined}
      contentEditable={false}
      data-raw={mdx}
      className={"inline-icon " + (onEdit ? "editable-inline-icon" : "")}
      tabIndex={tooltip || onEdit ? 0 : undefined}
      role={linked ? undefined : "button"}
      aria-label={
        onEdit
          ? "Edit icon"
          : linked
            ? label || textOf(parse(tooltip).tree).trim() || icon.name
            : tooltip
              ? "Show icon details"
              : icon.name
      }
      onPointerEnter={tooltip ? show : undefined}
      onPointerLeave={hide}
      onFocus={tooltip ? show : undefined}
      onBlur={hide}
      onClick={
        onEdit
          ? (e) => {
              e.stopPropagation();
              setOpen(false);
              onEdit();
            }
          : undefined
      }
      onKeyDown={(e) => {
        if (onEdit && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onEdit();
        }
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <Icon value={icon} />
    </Trigger>
  );
  if (!tooltip) return trigger;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={cn("icon-tooltip-panel", onEdit && "editor-icon-tooltip")}
          side="top"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerEnter={show}
          onPointerLeave={hide}
          onFocusCapture={show}
          onBlurCapture={hide}
          aria-label="Icon details"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
function EditableText({
  node,
  source,
  tag = "p",
  change,
  children,
  style,
}: {
  node: Node;
  source: string;
  tag?: string;
  change: (s: string) => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const focused = useRef(false),
    cached = useRef(children),
    initial = useRef("");
  const Tag = tag as React.ElementType;
  if (!focused.current) cached.current = children;
  const commit = (element: HTMLElement) => {
    if (element.innerHTML === initial.current) return;
    let body = Array.from(element.childNodes)
      .map((child) => inlineMarkdown(child))
      .join("");
    if (node.type === "heading")
      body = "#".repeat(node.depth || 2) + " " + body;
    const next = replaceNode(source, node, body);
    if (next !== source) change(next);
    initial.current = element.innerHTML;
  };
  return (
    <Tag
      style={style}
      contentEditable
      suppressContentEditableWarning
      data-start={node.position?.start.offset}
      onFocus={(e: React.FocusEvent<HTMLElement>) => {
        focused.current = true;
        initial.current = e.currentTarget.innerHTML;
      }}
      onInput={(e: React.FormEvent<HTMLElement>) => commit(e.currentTarget)}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        commit(e.currentTarget);
        focused.current = false;
      }}
    >
      {cached.current}
    </Tag>
  );
}
function ActionRow({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: IconValue | string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-accent",
        danger &&
          "border-destructive/25 text-destructive hover:bg-destructive/5",
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground",
          danger && "bg-destructive/10 text-destructive",
        )}
      >
        <Icon value={icon} className="size-3.5" />
      </span>
      <span className="flex-1 font-medium">{label}</span>
    </button>
  );
}

function ComponentProperties({
  node,
  source,
  product,
  notify,
  onSave,
  onClose,
  onActions,
  onImage,
}: {
  node: Node;
  source: string;
  product: Product;
  notify: (message: string) => void;
  onSave: (values: Record<string, string | boolean>) => void;
  onClose: () => void;
  onActions: () => void;
  onImage?: () => void;
}) {
  const [values, setValues] = useState(() => attributes(node));
  const [changes, setChanges] = useState<Record<string, string | boolean>>({});
  const set = (key: string, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
    setChanges((current) => ({ ...current, [key]: value }));
  };
  const name = node.name || "Block",
    inline = name === "Icon",
    callout = ["Callout", "Note", "Warning", "Tip", "Info", "Danger"].includes(
      name,
    );
  const text = (key: string) => String(values[key] ?? "");
  const checked = (key: string) =>
    values[key] === true || values[key] === "true";
  const fields =
    name === "Card"
      ? ["title", "href", "image", "cta"]
      : name === "Image"
        ? ["src", "alt", "caption", "width"]
        : name === "Snippet"
          ? ["name"]
          : inline
            ? ["href"]
            : ["title"];
  const labels: Record<string, string> = {
    title: "Title",
    href: "Destination URL",
    image: "Image URL",
    cta: "Link label",
    src: "Image URL",
    alt: "Alternative text",
    caption: "Caption",
    width: "Width",
    name: "Snippet name",
  };
  return (
    <PanelDialog
      title={name + " properties"}
      description="Adjust this component, then apply your changes."
      onClose={onClose}
      footer={
        <>
          <EButton variant="ghost" icon="ellipsis" onClick={onActions}>
            Actions
          </EButton>
          <span className="flex-1" />
          <EButton variant="ghost" onClick={onClose}>
            Cancel
          </EButton>
          <EButton
            variant="default"
            type="submit"
            form="component-properties-form"
          >
            Apply changes
          </EButton>
        </>
      }
    >
      <form
        id="component-properties-form"
        className="grid gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(changes);
        }}
      >
        {fields.length > 0 ? (
          <PanelSection title="Content">
            {fields.map((key) => (
              <EField key={key} label={labels[key] || key}>
                <EInput
                  value={text(key)}
                  onChange={(e) => set(key, e.target.value)}
                />
              </EField>
            ))}
          </PanelSection>
        ) : null}
        {inline || callout || name === "Card" ? (
          <>
            {fields.length > 0 ? <Separator /> : null}
            <PanelSection title="Appearance">
              {callout ? (
                <ESelectField
                  label="Callout style"
                  value={
                    text("type") ||
                    (
                      {
                        Warning: "warning",
                        Danger: "danger",
                        Tip: "tip",
                      } as Record<string, string>
                    )[name] ||
                    "info"
                  }
                  onValueChange={(value) => set("type", value)}
                  options={[
                    "info",
                    "warning",
                    "danger",
                    "success",
                    "tip",
                    "custom",
                  ].map((type) => ({ value: type, label: type }))}
                />
              ) : null}
              {callout && text("type") === "custom" ? (
                <EField label="Custom color">
                  <EInput
                    type="color"
                    className="h-9 w-16 cursor-pointer p-1"
                    value={text("color") || "#0166ff"}
                    onChange={(e) => set("color", e.target.value)}
                  />
                </EField>
              ) : null}
              <EField label="Icon">
                <React.Suspense fallback={null}>
                  <LazyIconPicker
                    value={{
                      name: text(inline ? "name" : "icon") || "circle-info",
                      style: text(inline ? "style" : "iconStyle") || "solid",
                      color: text(inline ? "color" : "iconColor") || undefined,
                    }}
                    onChange={(icon) => {
                      set(inline ? "name" : "icon", icon.name);
                      set(inline ? "style" : "iconStyle", icon.style || "solid");
                      set(inline ? "color" : "iconColor", icon.color || "");
                    }}
                  />
                </React.Suspense>
              </EField>
              {inline ? (
                <EToggle
                  label="Use product accent color"
                  checked={checked("accent")}
                  onChange={(value) => set("accent", value)}
                />
              ) : null}
              {name === "Card" ? (
                <EToggle
                  label="Horizontal layout"
                  checked={checked("horizontal")}
                  onChange={(value) => set("horizontal", value)}
                />
              ) : null}
            </PanelSection>
          </>
        ) : null}
        {inline ? (
          <>
            <Separator />
            <PanelSection
              title="Tooltip"
              description="Line breaks and formatting are preserved."
            >
              <EField label="Content (Markdown and MDX)">
                <ETextarea
                  rows={6}
                  value={text("tooltip")}
                  onChange={(e) => set("tooltip", e.target.value)}
                  placeholder="Add context, links, or multiple paragraphs?"
                />
              </EField>
            </PanelSection>
          </>
        ) : null}
        {onImage ? (
          <EButton
            variant="outline"
            icon="images"
            className="justify-self-start"
            onClick={onImage}
          >
            Choose from media library
          </EButton>
        ) : null}
        <PanelSection title="Preview">
          <div
            className="rounded-lg border border-border bg-muted/40 p-4"
            aria-label="Component preview"
          >
            <Content
              source={setAttributes(
                raw(node, source),
                parse(raw(node, source)).tree.children![0],
                changes,
              )}
              product={product}
              notify={notify}
            />
          </div>
        </PanelSection>
      </form>
    </PanelDialog>
  );
}
export function Content({
  source,
  product,
  onChange,
  notify,
  onImage,
  snippetStack = [],
  printing = false,
}: Props) {
  const parsed = useMemo(() => parse(source), [source]);
  const [menu, setMenu] = useState<Node | null>(null),
    [slash, setSlash] = useState(false),
    [slashQuery, setSlashQuery] = useState(""),
    [properties, setProperties] = useState<Node | null>(null),
    [selection, setSelection] = useState<Range | null>(null),
    [iconInsert, setIconInsert] = useState(false),
    [iconValue, setIconValue] = useState<IconValue>({
      name: "sparkles",
      style: "solid",
    }),
    [iconAccent, setIconAccent] = useState(true),
    [iconTooltip, setIconTooltip] = useState(""),
    [iconHref, setIconHref] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const iconInsertion = useRef<{
    start: number;
    end: number;
    original: string;
    prefix: string;
    before: string;
    selected: string;
    after: string;
  } | null>(null);
  useEffect(() => {
    if (!onChange) return;
    let frame = 0;
    const update = () => {
      if (document.activeElement?.closest("[data-grave-format-toolbar]"))
        return;
      const current = window.getSelection();
      if (!current || !current.rangeCount) {
        setSelection(null);
        return;
      }
      const range = current.getRangeAt(0);
      const element = (
        range.startContainer instanceof Element
          ? range.startContainer
          : range.startContainer.parentElement
      )?.closest("[data-start]");
      if (
        !element ||
        !canvasRef.current?.contains(element) ||
        !element.contains(range.endContainer)
      ) {
        setSelection(null);
        return;
      }
      setSelection(range.cloneRange());
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const outside = (e: PointerEvent) => {
      if (
        !(e.target instanceof Element) ||
        e.target.closest("[data-grave-format-toolbar]")
      )
        return;
      if (!canvasRef.current?.contains(e.target)) setSelection(null);
    };
    document.addEventListener("selectionchange", schedule);
    document.addEventListener("pointerdown", outside);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", schedule);
      document.removeEventListener("pointerdown", outside);
    };
  }, [!!onChange]);
  const blockIconInsertion = useRef<typeof iconInsertion.current>(null);
  const slashOffset = useRef<number | null>(null);
  const dragged = useRef<Node | null>(null);
  const headingMap = useMemo(
    () => new Map(headings(source, parsed.tree).map((h) => [h.offset, h.id])),
    [source, parsed.tree],
  );
  const [hash, setHash] = useState("");
  useEffect(() => {
    const sync = () => setHash(decodeURIComponent(location.hash.slice(1)));
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("grave-route", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("grave-route", sync);
    };
  }, []);
  const containsAnchor = (node: Node): boolean =>
    headingMap.get(node.position?.start.offset ?? -1) === hash ||
    !!node.children?.some(containsAnchor);
  useEffect(() => {
    setProperties((previous) => {
      if (!previous) return null;
      const find = (node: Node): Node | undefined =>
        node.name === previous.name &&
        node.position?.start.offset === previous.position?.start.offset
          ? node
          : node.children?.map(find).find(Boolean);
      return find(parsed.tree) || null;
    });
  }, [parsed.tree]);
  const update = (n: Node, v: string) => onChange?.(replaceNode(source, n, v));
  const prop = (n: Node, key: string, v: string | boolean, close = true) => {
    onChange?.(setAttribute(source, n, key, v));
    if (close) setProperties(null);
  };
  const childControls = (n: Node, kind: string) =>
    onChange && (
      <div className="my-3 flex">
        <EButton
          variant="outline"
          size="sm"
          icon="plus"
          onClick={() => {
            const end = source.lastIndexOf(
              "</" + n.name + ">",
              n.position!.end.offset,
            );
            onChange(
              source.slice(0, end) +
                `\n<${kind} title="New ${kind.toLowerCase()}">\nAdd content.\n</${kind}>\n` +
                source.slice(end),
            );
          }}
        >
          Add {kind.toLowerCase()}
        </EButton>
      </div>
    );
  function table(n: Node) {
    const rows = n.children || [];
    const serialize = (values: string[][], align = n.align || []) =>
      values
        .map(
          (row, i) =>
            "| " +
            row.join(" | ") +
            " |" +
            (i === 0
              ? "\n| " +
                row
                  .map((_, j) =>
                    align[j] === "right"
                      ? "---:"
                      : align[j] === "center"
                        ? ":---:"
                        : ":---",
                  )
                  .join(" | ") +
                " |"
              : ""),
        )
        .join("\n");
    const values = rows.map((r) =>
      (r.children || []).map((c) => raw(c, source)),
    );
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {rows[0]?.children?.map((cell, j) => (
                <th
                  key={j}
                  style={{ textAlign: n.align?.[j] || "left" }}
                  contentEditable={!!onChange}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    if (!onChange || e.currentTarget.innerText === textOf(cell))
                      return;
                    values[0][j] = Array.from(e.currentTarget.childNodes)
                      .map((child) => inlineMarkdown(child))
                      .join("")
                      .replace(/\|/g, "\\|");
                    update(n, serialize(values));
                  }}
                >
                  {cell.children?.map(render)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, i) => (
              <tr key={i}>
                {row.children?.map((cell, j) => (
                  <td
                    key={j}
                    style={{ textAlign: n.align?.[j] || "left" }}
                    contentEditable={!!onChange}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      if (
                        !onChange ||
                        e.currentTarget.innerText === textOf(cell)
                      )
                        return;
                      values[i + 1][j] = Array.from(e.currentTarget.childNodes)
                        .map((child) => inlineMarkdown(child))
                        .join("")
                        .replace(/\|/g, "\\|");
                      update(n, serialize(values));
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text/plain");
                      if (onChange && text.includes("\t")) {
                        e.preventDefault();
                        text
                          .trimEnd()
                          .split(/\r?\n/)
                          .forEach((r, ri) =>
                            r.split("\t").forEach((v, cj) => {
                              while (values.length <= i + 1 + ri)
                                values.push(values[0].map(() => ""));
                              while (values[0].length <= j + cj)
                                values.forEach((x) => x.push(""));
                              values[i + 1 + ri][j + cj] = v.replace(
                                /\|/g,
                                "\\|",
                              );
                            }),
                          );
                        update(n, serialize(values));
                      }
                    }}
                  >
                    {cell.children?.map(render)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {onChange && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 p-2.5">
            <EButton
              size="sm"
              variant="outline"
              onClick={() =>
                update(n, serialize([...values, values[0].map(() => "")]))
              }
            >
              Add row
            </EButton>
            <EButton
              size="sm"
              variant="outline"
              onClick={() =>
                update(n, serialize(values.map((r) => [...r, ""])))
              }
            >
              Add column
            </EButton>
            <Select
              value=""
              onValueChange={(value) =>
                update(
                  n,
                  serialize(values.filter((_, i) => i !== Number(value))),
                )
              }
            >
              <SelectTrigger
                className="h-8 w-[9.5rem] text-xs"
                aria-label="Table row to delete"
              >
                <span className="truncate text-muted-foreground">
                  Delete row…
                </span>
              </SelectTrigger>
              <SelectContent>
                {values.slice(1).map((_, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    Row {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value=""
              onValueChange={(value) => {
                const [action, col] = value.split(":");
                const j = Number(col);
                if (action === "delete" && values[0].length > 1)
                  update(
                    n,
                    serialize(
                      values.map((r) => r.filter((_, i) => i !== j)),
                      (n.align || []).filter((_, i) => i !== j),
                    ),
                  );
                else if (action !== "delete") {
                  const a = [...(n.align || [])];
                  a[j] = action as "left";
                  update(n, serialize(values, a));
                }
              }}
            >
              <SelectTrigger
                className="h-8 w-[10.5rem] text-xs"
                aria-label="Table column actions"
              >
                <span className="truncate text-muted-foreground">
                  Column options…
                </span>
              </SelectTrigger>
              <SelectContent>
                {values[0].flatMap((_, j) =>
                  ["left", "center", "right", "delete"].map((action) => (
                    <SelectItem key={action + j} value={action + ":" + j}>
                      Column {j + 1}: {action}
                    </SelectItem>
                  )),
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  }
  function render(n: Node, i = 0): React.ReactNode {
    const a = attributes(n),
      children = n.children?.map(render);
    if (
      (n.type === "mdxJsxTextElement" || n.type === "mdxJsxFlowElement") &&
      n.name === "Icon"
    ) {
      const icon = {
        name: String(a.name || "sparkles"),
        style: String(a.style || "solid"),
        color:
          a.accent === true || a.accent === "true"
            ? "var(--accent)"
            : String(a.color || "") || undefined,
      };
      const tooltip = String(a.tooltip || "").trim();
      return (
        <InlineIcon
          key={i}
          icon={icon}
          label={String(a.label || a["aria-label"] || "")}
          tooltip={tooltip}
          href={a.href ? readerLink(product, String(a.href)) : ""}
          mdx={raw(n, source)}
          onEdit={onChange ? () => setProperties(n) : undefined}
        >
          {tooltip && (
            <Content
              source={tooltip}
              product={product}
              notify={notify}
              snippetStack={snippetStack}
            />
          )}
        </InlineIcon>
      );
    }
    if (n.type === "mdxJsxTextElement")
      return (
        <span
          key={i}
          contentEditable={false}
          data-raw={raw(n, source)}
          className="preserved-inline"
        >
          {raw(n, source)}
        </span>
      );
    let result: React.ReactNode;
    switch (n.type) {
      case "yaml":
      case "mdxjsEsm":
        return onChange && n.type === "mdxjsEsm" ? (
          <div className="unsupported">
            Preserved import or export. Edit in Source.
          </div>
        ) : null;
      case "root":
        return children;
      case "text":
        return onChange ? n.value : emojiNodes(n.value);
      case "mdxTextExpression":
        return (
          <span
            key={i}
            contentEditable={false}
            data-raw={raw(n, source)}
            className="preserved-inline"
          >
            {raw(n, source).startsWith("{/*") ? "" : raw(n, source)}
          </span>
        );
      case "mdxFlowExpression":
        if (raw(n, source).startsWith("{/*"))
          return onChange ? (
            <div className="unsupported">Comment preserved in Source</div>
          ) : null;
        result = <div className="unsupported">{raw(n, source)}</div>;
        break;
      case "strong":
        return <strong key={i}>{children}</strong>;
      case "emphasis":
        return <em key={i}>{children}</em>;
      case "delete":
        return <del key={i}>{children}</del>;
      case "inlineCode":
        return <code key={i}>{n.value}</code>;
      case "link":
        return (
          <a
            key={i}
            href={readerLink(product, n.url || "")}
            onClick={onChange ? (e) => e.preventDefault() : undefined}
          >
            {children}
          </a>
        );
      case "break":
        return <br key={i} />;
      case "thematicBreak":
        result = <hr className="doc-divider" />;
        break;
      case "paragraph":
        result = onChange ? (
          <EditableText node={n} source={source} change={onChange}>
            {children}
          </EditableText>
        ) : (
          <p>{children}</p>
        );
        break;
      case "heading": {
        const id =
          headingMap.get(n.position?.start.offset || 0) || headingId(textOf(n));
        const Tag = ("h" + n.depth) as React.ElementType;
        result = onChange ? (
          <EditableText
            node={n}
            source={source}
            tag={"h" + n.depth}
            change={onChange}
          >
            {children}
          </EditableText>
        ) : (
          <Tag id={id} className="heading-anchor">
            {children}
            <a
              className="heading-permalink"
              href={"#" + id}
              aria-label={"Link to " + textOf(n)}
            >
              #
            </a>
          </Tag>
        );
        break;
      }
      case "list":
        result = n.ordered ? <ol>{children}</ol> : <ul>{children}</ul>;
        break;
      case "listItem": {
        const editable = !!onChange;
        const insertSibling = (e: React.KeyboardEvent<HTMLLIElement>) => {
          if (
            !editable ||
            e.key !== "Enter" ||
            e.shiftKey ||
            e.nativeEvent.isComposing
          )
            return;
          if ((e.target as Element).closest("li") !== e.currentTarget) return;
          const selection = window.getSelection();
          if (!selection?.isCollapsed || !selection.rangeCount) return;
          const range = selection.getRangeAt(0);
          if (!e.currentTarget.contains(range.endContainer)) return;
          const tail = range.cloneRange();
          tail.selectNodeContents(e.currentTarget);
          tail.setStart(range.endContainer, range.endOffset);
          if (
            tail.toString().trim() ||
            tail.cloneContents().querySelector("ul,ol,[data-raw]")
          )
            return;
          const next = continueList(source, n);
          if (!next) return;
          e.preventDefault();
          e.stopPropagation();
          onChange?.(next.source);
          requestAnimationFrame(() => {
            const item = canvasRef.current?.querySelector<HTMLElement>(
              '[data-list-start="' +
                (n.position!.end.offset +
                  1 +
                  source.slice(
                    source.lastIndexOf("\n", n.position!.start.offset - 1) + 1,
                    n.position!.start.offset,
                  ).length) +
                '"]',
            );
            const target = item?.querySelector<HTMLElement>(
              "[contenteditable=true]",
            );
            if (!target) return;
            target.focus();
            const caret = document.createRange();
            caret.selectNodeContents(target);
            caret.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(caret);
          });
        };
        const emptyTask = /^[-+*]\s+\[ \]\s*$/.test(raw(n, source));
        const emptyParagraph: Node = {
          type: "paragraph",
          children: [],
          position: {
            start: { offset: n.position!.end.offset },
            end: { offset: n.position!.end.offset },
          },
        };
        return (
          <li
            key={i}
            data-list-start={n.position?.start.offset}
            onKeyDown={insertSibling}
          >
            {(emptyTask || (n.checked !== null && n.checked !== undefined)) && (
              <input
                contentEditable={false}
                aria-label="Task item"
                type="checkbox"
                readOnly
                checked={n.checked || false}
              />
            )}{" "}
            {emptyTask || !children?.length
              ? editable
                ? render(emptyParagraph)
                : null
              : children}
          </li>
        );
      }
      case "blockquote":
        result = <blockquote>{children}</blockquote>;
        break;
      case "table":
        result = table(n);
        break;
      case "code":
        result =
          n.lang === "mermaid" && !onChange ? (
            <Diagram printing={printing} value={n.value || ""} />
          ) : (
            <CodeBlock
              node={n}
              editable={!!onChange}
              notify={notify}
              onValue={(value, meta) => {
                const lang = meta?.startsWith("LANG:")
                  ? meta.slice(5)
                  : n.lang || "";
                update(
                  n,
                  codeSource(
                    value,
                    lang,
                    meta?.startsWith("LANG:")
                      ? n.meta || ""
                      : (meta ?? n.meta ?? ""),
                  ),
                );
              }}
            />
          );
        break;
      case "image":
        result = (
          <figure>
            <img
              loading="lazy"
              decoding="async"
              src={safeUrl(n.url || "")}
              alt={n.alt || ""}
            />
            {n.title && <figcaption>{n.title}</figcaption>}
          </figure>
        );
        break;
      case "mdxJsxFlowElement":
      case "mdxJsxTextElement": {
        switch (n.name) {
          case "Divider":
            result = <hr className="doc-divider" />;
            break;
          case "Callout":
          case "Note":
          case "Warning":
          case "Tip":
          case "Info":
          case "Danger":
            result = (
              <aside
                className={"callout " + String(a.type || n.name.toLowerCase())}
                style={a.color ? { borderColor: String(a.color) } : undefined}
              >
                <Icon
                  value={{
                    name: String(
                      ("icon" in a ? a.icon : undefined) ??
                        ((
                          {
                            warning: "triangle-exclamation",
                            danger: "circle-exclamation",
                            tip: "lightbulb",
                            success: "circle-check",
                          } as Record<string, string>
                        )[String(a.type)] ||
                          "circle-info"),
                    ),
                    style: String(a.iconStyle || "solid"),
                    color: String(a.iconColor || a.color || "") || undefined,
                  }}
                />
                <div>
                  {a.title && (
                    <strong
                      contentEditable={!!onChange}
                      suppressContentEditableWarning
                      onBlur={(e) =>
                        prop(n, "title", e.currentTarget.innerText)
                      }
                    >
                      {String(a.title)}
                    </strong>
                  )}
                  {children}
                </div>
              </aside>
            );
            break;
          case "CardGroup":
            result = <div className="card-grid">{children}</div>;
            break;
          case "Card":
            result = (
              <a
                className={
                  "doc-card " +
                  (a.horizontal === "true" || a.horizontal === true
                    ? "horizontal"
                    : "")
                }
                href={readerLink(product, String(a.href || "#"))}
                onClick={onChange ? (e) => e.preventDefault() : undefined}
              >
                {a.image && (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={safeUrl(String(a.image))}
                    alt=""
                  />
                )}
                <div>
                  <Icon
                    value={{
                      name: String(a.icon ?? "book-open"),
                      style: String(a.iconStyle || "solid"),
                      color: String(a.iconColor || "") || undefined,
                    }}
                  />
                  <h3
                    contentEditable={!!onChange}
                    suppressContentEditableWarning
                    onBlur={(e) => prop(n, "title", e.currentTarget.innerText)}
                  >
                    {String(a.title || "Untitled card")}
                  </h3>
                  {children}
                  {a.cta && <span className="card-cta">{String(a.cta)}</span>}
                </div>
              </a>
            );
            break;
          case "Tabs":
            result = (
              <>
                <Tabs
                  printing={printing}
                  nodes={(n.children || []).filter((c) => c.name === "Tab")}
                  preferred={(n.children || [])
                    .filter((c) => c.name === "Tab")
                    .findIndex(containsAnchor)}
                  render={render}
                />
                {childControls(n, "Tab")}
              </>
            );
            break;
          case "Tab":
            result = (
              <div>
                {onChange && (
                  <input
                    aria-label="Tab title"
                    defaultValue={String(a.title || "")}
                    onBlur={(e) => prop(n, "title", e.target.value)}
                  />
                )}{" "}
                {children}
              </div>
            );
            break;
          case "AccordionGroup":
            result = (
              <div>
                {children}
                {childControls(n, "Accordion")}
              </div>
            );
            break;
          case "Accordion":
            result = (
              <details
                className="accordion"
                open={
                  printing || onChange || containsAnchor(n) ? true : undefined
                }
              >
                <summary>
                  <span
                    contentEditable={!!onChange}
                    suppressContentEditableWarning
                    onBlur={(e) => prop(n, "title", e.currentTarget.innerText)}
                  >
                    {String(a.title || "Details")}
                  </span>
                </summary>
                <div>{children}</div>
              </details>
            );
            break;
          case "Steps":
            result = (
              <div className="steps">
                {children}
                {childControls(n, "Step")}
              </div>
            );
            break;
          case "Step":
            result = (
              <section className="step">
                <h3
                  contentEditable={!!onChange}
                  suppressContentEditableWarning
                  onBlur={(e) => prop(n, "title", e.currentTarget.innerText)}
                >
                  {String(a.title || "Step")}
                </h3>
                {children}
              </section>
            );
            break;
          case "CodeGroup":
            result = (
              <>
                <Tabs
                  nodes={(n.children || []).filter((c) => c.type === "code")}
                  render={render}
                  code
                />
                {onChange && (
                  <EButton
                    variant="outline"
                    size="sm"
                    icon="plus"
                    className="mt-2"
                    onClick={() => {
                      const end = source.lastIndexOf(
                        "</CodeGroup>",
                        n.position!.end.offset,
                      );
                      onChange(
                        source.slice(0, end) +
                          "\n" +
                          blocks.Code +
                          "\n" +
                          source.slice(end),
                      );
                    }}
                  >
                    Add code example
                  </EButton>
                )}
              </>
            );
            break;
          case "Image":
            result = (
              <figure>
                <img
                  src={safeUrl(String(a.src || ""))}
                  alt={String(a.alt || "")}
                  style={{
                    width: /^\d+(%|px)?$/.test(String(a.width))
                      ? String(a.width)
                      : "100%",
                  }}
                />
                {a.caption && <figcaption>{String(a.caption)}</figcaption>}
              </figure>
            );
            break;
          case "Snippet":
            result = snippetStack.includes(String(a.name)) ? (
              <div className="error">
                Circular snippet reference: {String(a.name)}
              </div>
            ) : product.snippets[String(a.name)] ? (
              <Content
                source={product.snippets[String(a.name)]}
                product={product}
                notify={notify}
                printing={printing}
                snippetStack={[...snippetStack, String(a.name)]}
              />
            ) : (
              <div className="unsupported">
                Snippet “{String(a.name)}” was not found.
              </div>
            );
            break;
          case "Mermaid":
            result = <Diagram value={textOf(n)} />;
            break;
          default:
            result = (
              <div className="unsupported">
                <span>Unsupported component preserved</span>
                <pre>{raw(n, source)}</pre>
              </div>
            );
        }
        break;
      }
      default:
        result = (
          <div className="unsupported">
            <span>Source preserved without execution</span>
            <pre>{raw(n, source)}</pre>
          </div>
        );
    }
    const hasComponentHandle =
      n.type === "mdxJsxFlowElement" ||
      ["code", "table", "image", "thematicBreak"].includes(n.type);
    if (!onChange || !hasComponentHandle)
      return (
        <React.Fragment key={n.position?.start.offset ?? i}>
          {result}
        </React.Fragment>
      );
    return (
      <div
        className="editable-block"
        key={n.position?.start.offset ?? i}
        onDragOver={(e) => {
          if (dragged.current) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!dragged.current) return;
          e.preventDefault();
          e.stopPropagation();
          const from = dragged.current;
          dragged.current = null;
          if (from === n || !from.position || !n.position) return;
          const a = from.position.start.offset,
            b = from.position.end.offset,
            t = n.position.start.offset;
          if (t >= a && t <= b) return;
          const removed = source.slice(0, a) + source.slice(b);
          const at = t > a ? t - (b - a) : t;
          onChange(
            removed.slice(0, at) +
              raw(from, source) +
              "\n\n" +
              removed.slice(at),
          );
        }}
      >
        <button
          type="button"
          className="block-grip absolute -left-7 top-0.5 z-[2] grid size-6 cursor-grab place-items-center rounded-md text-muted-foreground transition-[opacity,background-color,color] hover:bg-accent hover:text-foreground active:cursor-grabbing"
          aria-label={
            "Actions for " +
            (n.name || (n.type === "thematicBreak" ? "Divider" : n.type))
          }
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            dragged.current = n;
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (
              [
                "Card",
                "Callout",
                "Note",
                "Info",
                "Warning",
                "Tip",
                "Danger",
              ].includes(n.name || "")
            )
              setProperties(n);
            else setMenu(n);
          }}
        >
          <Icon value="grip-vertical" />
        </button>
        {result}
      </div>
    );
  }
  const captureSelection = (range: Range, unwrapLinks = false) => {
    if (!range.startContainer.isConnected) return null;
    const element = (
      range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement
    )?.closest("[data-start]") as HTMLElement | null;
    if (
      !element ||
      !canvasRef.current?.contains(element) ||
      !element.contains(range.endContainer)
    )
      return null;
    const find = (node: Node): Node | undefined =>
      node.position?.start.offset === Number(element.dataset.start) &&
      ["paragraph", "heading"].includes(node.type)
        ? node
        : node.children?.map(find).find(Boolean);
    const node = find(parsed.tree);
    if (!node?.position) return null;
    const before = range.cloneRange();
    before.selectNodeContents(element);
    before.setEnd(range.startContainer, range.startOffset);
    const after = range.cloneRange();
    after.selectNodeContents(element);
    after.setStart(range.endContainer, range.endOffset);
    return {
      start: node.position.start.offset,
      end: node.position.end.offset,
      original: raw(node, source),
      prefix: node.type === "heading" ? "#".repeat(node.depth || 2) + " " : "",
      before: inlineMarkdown(before.cloneContents()),
      selected: selectionMarkdown(range, element, unwrapLinks),
      after: inlineMarkdown(after.cloneContents()),
    };
  };
  const applySelection = (
    bookmark: NonNullable<typeof iconInsertion.current>,
    transform: (selected: string) => string,
  ) => {
    if (!onChange) return;
    const find = (node: Node): Node | undefined =>
      node.position?.start.offset === bookmark.start &&
      ["paragraph", "heading"].includes(node.type)
        ? node
        : node.children?.map(find).find(Boolean);
    const node = find(parsed.tree);
    if (
      !node ||
      ![
        bookmark.original,
        bookmark.prefix + bookmark.before + bookmark.selected + bookmark.after,
      ].includes(raw(node, source))
    ) {
      notify("This paragraph changed. Place the cursor again and retry.");
      return;
    }
    const next = replaceNode(
      source,
      node,
      bookmark.prefix +
        bookmark.before +
        transform(bookmark.selected) +
        bookmark.after,
    );
    (document.activeElement as HTMLElement)?.blur();
    onChange(next);
    setSelection(null);
  };
  const editSelection = (
    range: Range,
    transform: (selected: string) => string,
    unwrapLinks = false,
  ) => {
    const bookmark = captureSelection(range, unwrapLinks);
    if (bookmark) applySelection(bookmark, transform);
  };
  const format = (prefix: string, suffix = prefix) => {
    if (selection && !selection.collapsed)
      editSelection(
        selection,
        (selected) => prefix + selected + suffix,
        prefix === "[",
      );
  };
  const insertIconAtSelection = () => {
    const attrs = [
      `name=${quoteAttribute(iconValue.name || "sparkles")}`,
      `style=${quoteAttribute(iconValue.style || "solid")}`,
      ...(iconHref.trim()
        ? [`href=${quoteAttribute(safeUrl(iconHref))}`]
        : []),
      ...(iconAccent ? ["accent"] : []),
      ...(iconValue.color
        ? [`color=${quoteAttribute(iconValue.color)}`]
        : []),
      ...(iconTooltip.trim()
        ? [`tooltip=${quoteAttribute(iconTooltip)}`]
        : []),
    ];
    const markup = `<Icon ${attrs.join(" ")} />`;
    if (iconInsertion.current)
      applySelection(iconInsertion.current, (selected) => selected + markup);
    else
      onChange?.(insertBlock(source, markup + "\n", slashOffset.current));
    iconInsertion.current = null;
    setIconInsert(false);
  };

  return (
    <div
      ref={canvasRef}
      className={"prose " + (onChange ? "visual-canvas" : "")}
      onKeyDown={(e) => {
        if (onChange && e.key === "/" && !e.nativeEvent.isComposing) {
          const target = (e.target as HTMLElement).closest(
            "[data-start]",
          ) as HTMLElement | null;
          const selection = window.getSelection();
          if (!target || !selection?.isCollapsed || !selection.rangeCount)
            return;
          const before = selection.getRangeAt(0).cloneRange();
          before.selectNodeContents(target);
          before.setEnd(selection.anchorNode!, selection.anchorOffset);
          if (before.toString().trim()) return;
          e.preventDefault();
          blockIconInsertion.current = captureSelection(
            selection.getRangeAt(0),
          );
          slashOffset.current = Number(target.dataset.start);
          target.blur();
          setSlash(true);
        }
      }}
    >
      {parsed.error && (
        <div className="error">
          This MDX needs attention in Source mode: {parsed.error}
        </div>
      )}
      {render(parsed.tree)}
      {onChange && (
        <EButton
          variant="outline"
          icon="plus"
          className="mt-6 w-full justify-start border-dashed bg-transparent text-xs font-normal text-muted-foreground"
          onPointerDown={() => {
            const current = window.getSelection();
            blockIconInsertion.current = current?.rangeCount
              ? captureSelection(current.getRangeAt(0))
              : null;
          }}
          onClick={() => {
            slashOffset.current = null;
            setSlash(true);
          }}
        >
          Add a block
          <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            /
          </kbd>
        </EButton>
      )}
      {selection && onChange && (
        <React.Suspense fallback={null}>
          <LazyFormatToolbar
            selection={selection}
            product={product}
            onFormat={format}
            onInsertIcon={() => {
              iconInsertion.current = captureSelection(selection);
              if (!iconInsertion.current) return;
              setIconValue({ name: "circle-info", style: "solid" });
              setIconAccent(true);
              setIconTooltip("");
              setIconHref("");
              setSelection(null);
              setIconInsert(true);
            }}
            onClose={() => setSelection(null)}
          />
        </React.Suspense>
      )}
      {slash && (
        <PanelDialog
          title="Insert a block"
          description="Add a block at the cursor or after the current block."
          onClose={() => {
            setSlash(false);
            setSlashQuery("");
          }}
        >
          <div className="grid gap-4">
            <EInput
              autoFocus
              aria-label="Find a block"
              placeholder="Find a block…"
              value={slashQuery}
              onChange={(e) => setSlashQuery(e.target.value)}
            />
            <div className="grid max-h-[52vh] gap-1.5 overflow-y-auto sm:grid-cols-2">
              {Object.entries(blocks)
                .filter(([name]) =>
                  name.toLowerCase().includes(slashQuery.toLowerCase()),
                )
                .map(([name, value]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      if (name === "Image" && onImage) {
                        onImage(undefined, slashOffset.current);
                        setSlash(false);
                        setSlashQuery("");
                      } else if (name === "Icon") {
                        iconInsertion.current = blockIconInsertion.current;
                        blockIconInsertion.current = null;
                        setIconValue({ name: "sparkles", style: "solid" });
                        setIconAccent(true);
                        setIconTooltip("");
                        setIconHref("");
                        setSlash(false);
                        setSlashQuery("");
                        setIconInsert(true);
                      } else {
                        onChange?.(
                          insertBlock(source, value, slashOffset.current),
                        );
                        setSlash(false);
                        setSlashQuery("");
                      }
                    }}
                    className="flex min-h-11 items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                      <Icon
                        value={blockIcons[name] || "cube"}
                        className="size-3.5"
                      />
                    </span>
                    <span className="min-w-0 truncate">{name}</span>
                  </button>
                ))}
            </div>
            {!Object.keys(blocks).some((name) =>
              name.toLowerCase().includes(slashQuery.toLowerCase()),
            ) ? (
              <p className="text-sm text-muted-foreground">
                No blocks match “{slashQuery}”.
              </p>
            ) : null}
          </div>
        </PanelDialog>
      )}
      {iconInsert && (
        <PanelDialog
          title="Insert an icon"
          description="Add an inline icon with optional link and tooltip."
          onClose={() => setIconInsert(false)}
          footer={
            <>
              <EButton variant="ghost" onClick={() => setIconInsert(false)}>
                Cancel
              </EButton>
              <EButton
                variant="default"
                icon="plus"
                onClick={insertIconAtSelection}
              >
                Insert icon
              </EButton>
            </>
          }
        >
          <div className="grid gap-5">
            <EField label="Icon">
              <React.Suspense fallback={null}>
                <LazyIconPicker value={iconValue} onChange={setIconValue} />
              </React.Suspense>
            </EField>
            <EToggle
              label="Highlight with accent color"
              checked={iconAccent}
              onChange={setIconAccent}
            />
            <EField label="Destination URL (optional)">
              <EInput
                value={iconHref}
                onChange={(e) => setIconHref(e.target.value)}
                placeholder="https://example.com or /product/page"
              />
            </EField>
            <EField
              label="Tooltip content (MDX)"
              hint="Supports Markdown and MDX, including multiple lines."
            >
              <ETextarea
                autoFocus
                value={iconTooltip}
                onChange={(e) => setIconTooltip(e.target.value)}
                rows={6}
                placeholder="Supports Markdown and MDX, including multiple lines"
              />
            </EField>
            <PanelSection title="Preview">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <Content
                  source={
                    "<Icon name=" +
                    quoteAttribute(iconValue.name || "circle-info") +
                    " style=" +
                    quoteAttribute(iconValue.style || "solid") +
                    " accent=" +
                    quoteAttribute(iconAccent) +
                    " color=" +
                    quoteAttribute(iconValue.color || "") +
                    " tooltip=" +
                    quoteAttribute(iconTooltip) +
                    " href=" +
                    quoteAttribute(iconHref) +
                    " />"
                  }
                  product={product}
                  notify={notify}
                />
              </div>
            </PanelSection>
          </div>
        </PanelDialog>
      )}
      {menu && (
        <PanelDialog
          title="Block actions"
          description="Manage this block in the draft."
          onClose={() => setMenu(null)}
        >
          <div className="grid gap-5">
            <div className="grid gap-2">
              {menu.name && !["CardGroup", "Divider"].includes(menu.name) ? (
                <ActionRow
                  icon="sliders"
                  label="Properties"
                  onClick={() => {
                    setProperties(menu);
                    setMenu(null);
                  }}
                />
              ) : null}
              <ActionRow
                icon="copy"
                label="Copy MDX"
                onClick={() => {
                  copyText(raw(menu, source), notify);
                  setMenu(null);
                }}
              />
              <ActionRow
                icon="clone"
                label="Duplicate"
                onClick={() => {
                  update(menu, raw(menu, source) + "\n\n" + raw(menu, source));
                  setMenu(null);
                }}
              />
              {(["up", "down"] as const).map((dir) => (
                <ActionRow
                  key={dir}
                  icon={"arrow-" + dir}
                  label={"Move " + dir}
                  onClick={() => {
                    function parent(n: Node): Node | undefined {
                      return n.children?.includes(menu!)
                        ? n
                        : n.children?.map(parent).find(Boolean);
                    }
                    const siblings = parent(parsed.tree)?.children || [];
                    const index = siblings.indexOf(menu);
                    const other = siblings[index + (dir === "up" ? -1 : 1)];
                    if (other?.position && menu.position) {
                      const first = dir === "up" ? other : menu,
                        last = dir === "up" ? menu : other;
                      onChange?.(
                        source.slice(0, first.position!.start.offset) +
                          raw(last, source) +
                          source.slice(
                            first.position!.end.offset,
                            last.position!.start.offset,
                          ) +
                          raw(first, source) +
                          source.slice(last.position!.end.offset),
                      );
                    }
                    setMenu(null);
                  }}
                />
              ))}
            </div>
            {convertible(menu) ? (
              <ESelectField
                label="Convert text block"
                value="choose"
                onValueChange={(value) => {
                  if (value === "choose") return;
                  onChange?.(
                    convertTextBlock(
                      source,
                      menu,
                      value === "paragraph" ? "" : value,
                    ),
                  );
                  setMenu(null);
                }}
                options={[
                  { value: "choose", label: "Choose format", disabled: true },
                  { value: "paragraph", label: "Paragraph" },
                  { value: "## ", label: "Heading 2" },
                  { value: "### ", label: "Heading 3" },
                  { value: "> ", label: "Quote" },
                  { value: "- ", label: "List" },
                ]}
              />
            ) : null}
            <Separator />
            <ActionRow
              danger
              icon="trash"
              label="Delete block"
              onClick={() => {
                update(menu, "");
                setMenu(null);
              }}
            />
          </div>
        </PanelDialog>
      )}
      {properties && (
        <ComponentProperties
          key={properties.position?.start.offset}
          node={properties}
          source={source}
          product={product}
          notify={notify}
          onClose={() => setProperties(null)}
          onSave={(values) => {
            onChange?.(setAttributes(source, properties, values));
            setProperties(null);
          }}
          onActions={() => {
            setMenu(properties);
            setProperties(null);
          }}
          onImage={
            properties.name === "Image" && onImage
              ? () => {
                  onImage(properties);
                  setProperties(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

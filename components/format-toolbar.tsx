"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Product } from "@/lib/model";
import { safeUrl } from "@/lib/mdx";
import { selectionToolbarPosition } from "@/lib/selection-toolbar";
import { Icon } from "./grave-ui";
import { Button, IconButton, Input } from "./editor/ui";

export function FormatToolbar({
  selection,
  product,
  onFormat,
  onClose,
  onInsertIcon,
}: {
  selection: Range;
  product: Product;
  onFormat: (prefix: string, suffix?: string) => void;
  onClose: () => void;
  onInsertIcon: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, visible: false });
  const [link, setLink] = useState(false),
    [query, setQuery] = useState("");
  useLayoutEffect(() => {
    const update = () => {
      const element = ref.current;
      if (!element || !selection.startContainer.isConnected) {
        setPosition((p) => ({ ...p, visible: false }));
        return;
      }
      const rect = selection.getBoundingClientRect();
      const viewport = window.visualViewport;
      const x = viewport?.offsetLeft || 0,
        y = viewport?.offsetTop || 0;
      const width = viewport?.width || window.innerWidth,
        height = viewport?.height || window.innerHeight;
      // Keep the toolbar clear of the editor header and the mode switch row.
      const chromeTop = 104;
      setPosition(
        selectionToolbarPosition(rect, element.getBoundingClientRect(), {
          left: x,
          top: y + chromeTop,
          width,
          height: Math.max(180, height - chromeTop),
        }),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [selection, link]);
  const applyLink = (url: string) => {
    onFormat("[", "](" + safeUrl(url) + ")");
  };
  return createPortal(
    <div
      ref={ref}
      className="fixed z-[80] flex w-max max-w-[min(22rem,calc(100vw-1rem))] flex-col gap-0 overflow-hidden rounded-lg border border-border bg-popover text-foreground shadow-lg"
      data-grave-format-toolbar
      style={{
        left: position.left,
        top: position.top,
        visibility: position.visible ? "visible" : "hidden",
      }}
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div
        className="flex items-center gap-0.5 p-1"
        role="toolbar"
        aria-label="Text formatting"
      >
        <IconButton
          className="size-8"
          disabled={selection.collapsed}
          icon="bold"
          label="Bold"
          onClick={() => onFormat("**")}
        />
        <IconButton
          className="size-8"
          disabled={selection.collapsed}
          icon="italic"
          label="Italic"
          onClick={() => onFormat("*")}
        />
        <IconButton
          className="size-8"
          disabled={selection.collapsed}
          icon="strikethrough"
          label="Strikethrough"
          onClick={() => onFormat("~~")}
        />
        <IconButton
          className="size-8"
          disabled={selection.collapsed}
          icon="code"
          label="Inline code"
          onClick={() => onFormat("`")}
        />
        <span className="mx-1 h-5 w-px bg-border" />
        <IconButton
          className="size-8"
          icon="icons"
          label="Insert icon at cursor"
          onClick={onInsertIcon}
        />
        <IconButton
          className="size-8"
          disabled={selection.collapsed}
          icon="link"
          label="Insert link"
          aria-expanded={link}
          onClick={() => setLink(!link)}
        />
      </div>
      {link ? (
        <form
          className="grid w-72 gap-2 border-t border-border p-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim() && safeUrl(query) !== "#") applyLink(query);
          }}
        >
          <div className="relative">
            <Icon
              value="link"
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoFocus
              className="h-8 pl-8 text-xs"
              aria-label="Link URL or page search"
              placeholder="Paste a link or search pages"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {query.trim() && safeUrl(query) !== "#" ? (
            <Button
              size="sm"
              variant="default"
              className="justify-self-start"
              onClick={() => applyLink(query)}
            >
              Use this link
            </Button>
          ) : null}
          <div className="grid max-h-44 gap-0.5 overflow-y-auto">
            {product.pages
              .filter((p) =>
                (p.title + " " + p.slug)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((page) => (
                <button
                  type="button"
                  key={page.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                  onClick={() =>
                    applyLink("/" + product.slug + "/" + page.slug)
                  }
                >
                  <Icon
                    value={page.icon}
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{page.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      /{page.slug}
                    </span>
                  </span>
                </button>
              ))}
          </div>
        </form>
      ) : null}
    </div>,
    document.body,
  );
}

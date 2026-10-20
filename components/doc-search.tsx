"use client";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Product, Page } from "@/lib/model";
import { searchDocuments, searchResults } from "@/lib/reader-tools";
import { Modal, Button, Icon, emojiNodes } from "./grave-ui";
export default function Search({
  product,
  products,
  onClose,
  onOpen,
}: {
  product?: Product;
  products?: Product[];
  onClose: () => void;
  onOpen: (page: Page, hash?: string, product?: Product) => void;
}) {
  const [q, setQ] = useState(""),
    [index, setIndex] = useState(0),
    [recent, setRecent] = useState<string[]>([]);
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const key = "grave-search-" + (product?.id || "workspace");
  useEffect(() => {
    try {
      const values = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(values))
        setRecent(
          values.filter((v): v is string => typeof v === "string").slice(0, 8),
        );
    } catch {}
  }, [key]);
  const documents = useMemo(
    () => searchDocuments(product ? [product] : products || []),
    [product, products],
  );
  const results = useMemo(() => searchResults(documents, q), [documents, q]);
  const choose = (i: number) => {
    const result = results[i];
    if (!result) return;
    const query = q.trim();
    if (query) {
      const next = [query, ...recent.filter((v) => v !== query)].slice(0, 8);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      setRecent(next);
    }
    onOpen(result.page, result.hash, result.product);
  };
  useEffect(() => {
    list.current
      ?.querySelector("[aria-selected=true]")
      ?.scrollIntoView({ block: "nearest" });
  }, [index, results]);
  const change = (value: string) => {
    setQ(value);
    setIndex(0);
  };
  const highlight = (text: string) => {
    const terms = q
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => term.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&"));
    if (!terms.length) return emojiNodes(text);
    const expression = new RegExp("(" + terms.join("|") + ")", "gi");
    return text
      .split(expression)
      .map((part, i) =>
        i % 2 ? (
          <mark key={i}>{part}</mark>
        ) : (
          <Fragment key={i}>{emojiNodes(part)}</Fragment>
        ),
      );
  };
  return (
    <Modal
      title={product ? "Search " + product.name : "Search all documentation"}
      onClose={onClose}
    >
      <input
        autoFocus
        role="combobox"
        aria-label="Search documentation"
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls={id}
        aria-activedescendant={results[index] ? id + "-" + index : undefined}
        placeholder="Search pages, headings, and content…"
        value={q}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            if ((e.key === "Home" || e.key === "End") && !e.altKey) return;
            e.preventDefault();
            setIndex((i) =>
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? Math.max(0, results.length - 1)
                  : (i + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
                    Math.max(1, results.length),
            );
          }
          if (e.key === "Enter") {
            e.preventDefault();
            choose(index);
          }
        }}
      />
      {!q && recent.length > 0 && (
        <section className="recent-searches">
          <div className="row">
            <h3>Recent searches</h3>
            <Button
              onClick={() => {
                setRecent([]);
                try {
                  localStorage.removeItem(key);
                } catch {}
              }}
            >
              Clear history
            </Button>
          </div>
          {recent.map((query) => (
            <button key={query} onClick={() => change(query)}>
              {query}
            </button>
          ))}
        </section>
      )}
      <p className="field-help" role="status">
        {results.length === 1 ? "1 result" : results.length + " results"}
        {results.length === 60 ? " · showing the first 60" : ""}
      </p>
      <div
        ref={list}
        id={id}
        className="search-results"
        role="listbox"
        aria-label="Search results"
      >
        {results.map((result, i) => (
          <button
            id={id + "-" + i}
            key={result.product.id + result.page.id + result.hash}
            tabIndex={-1}
            role="option"
            aria-selected={index === i}
            className={index === i ? "selected" : ""}
            onClick={() => choose(i)}
          >
            <Icon value={result.page.icon} />
            <span>
              <strong>{highlight(result.heading || result.page.title)}</strong>
              <small>
                {emojiNodes(
                  (!product ? result.product.name + " · " : "") +
                    (result.heading
                      ? result.page.title + " · Section"
                      : "Page"),
                )}
              </small>
              <p>{highlight(result.excerpt)}</p>
            </span>
          </button>
        ))}
      </div>
      {!results.length && (
        <div className="empty-state">
          <h3>No results for “{q}”</h3>
          <p>Try fewer words, or browse the available pages.</p>
          <Button onClick={() => change("")}>Browse all pages</Button>
        </div>
      )}
      <div className="search-footer">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> to navigate
        </span>
        <span>
          <kbd>Enter</kbd> to open
        </span>
        <span>
          <kbd>Esc</kbd> to close
        </span>
      </div>
    </Modal>
  );
}

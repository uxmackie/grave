"use client";
import { DocumentHead } from "./document-head";
import { flushSync } from "react-dom";
import { readerLink } from "@/lib/reader-links";
import {
  type Heading,
  readerPath,
  resolveRedirect,
  readingMinutes,
  sourceHeadings,
} from "@/lib/reader-paths";
import { WorkspaceHome, VersionSwitcher, PageFeedback } from "./reader-extras";
import type { QualityIssue } from "@/lib/publish-checks";
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type Product,
  type ProductRecord,
  type Workspace,
  type Page,
  type Nav,
  flatten,
  pruneNav,
  sectionFor,
  visiblePages,
} from "@/lib/model";
import { safeUrl } from "@/lib/url";
import { replaceNode } from "@/lib/text-edit";
import type { Node } from "@/lib/mdx";
import { accentStyles } from "@/lib/colors";
import { singleFlight } from "@/lib/save-queue";
import {
  matchingWorkspace,
  type WorkspaceData,
  type LoadedWorkspace,
} from "@/lib/workspace-state";
const Content = lazy(() =>
  import("./content").then((module) => ({ default: module.Content })),
);
const SourceEditor = lazy(() =>
  import("./content").then((module) => ({ default: module.SourceEditor })),
);
const Modal = lazy(() =>
  import("./modal").then((module) => ({ default: module.Modal })),
);
import {
  Button,
  Icon,
  ThemeControl,
  copyText,
  download,
  emojiNodes,
} from "./grave-ui";
import {
  Button as EButton,
  IconButton as EIconButton,
  Field as EField,
  Input as EInput,
  Textarea as ETextarea,
  PanelDialog,
  Note as ENote,
  Badge as EBadge,
  Separator as ESeparator,
  Select as ESelect,
  SelectContent as ESelectContent,
  SelectItem as ESelectItem,
  SelectTrigger as ESelectTrigger,
  SelectValue as ESelectValue,
} from "./editor/ui";
import { DeleteDialog } from "./editor/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api, folderSyncFailed } from "@/lib/client-api";
const Search = lazy(() => import("./doc-search"));
const ReaderSettings = lazy(() =>
  import("./reader-settings").then((m) => ({ default: m.ReaderSettings })),
);
const VersionsPanel = lazy(() =>
  import("./reader-settings").then((m) => ({ default: m.VersionsPanel })),
);
const FeedbackDashboard = lazy(() =>
  import("./reader-settings").then((m) => ({ default: m.FeedbackDashboard })),
);
const FreshnessPanel = lazy(() =>
  import("./reader-settings").then((m) => ({ default: m.FreshnessPanel })),
);
const ProductSettings = lazy(() =>
  import("./panels").then((module) => ({ default: module.ProductSettings })),
);
const HomeSettings = lazy(() =>
  import("./panels").then((module) => ({ default: module.HomeSettings })),
);
const PageSettings = lazy(() =>
  import("./panels").then((module) => ({ default: module.PageSettings })),
);
const NavigationSettings = lazy(() =>
  import("./panels").then((module) => ({ default: module.NavigationSettings })),
);
const PublishReview = lazy(() =>
  import("./panels").then((module) => ({ default: module.PublishReview })),
);
const FindReplace = lazy(() =>
  import("./panels").then((module) => ({ default: module.FindReplace })),
);
const LinkTools = lazy(() =>
  import("./panels").then((module) => ({ default: module.LinkTools })),
);
const SnippetSettings = lazy(() =>
  import("./panels").then((module) => ({ default: module.SnippetSettings })),
);
const NewPagePanel = lazy(() =>
  import("./panels").then((module) => ({ default: module.NewPagePanel })),
);
const HistoryPanel = lazy(() =>
  import("./panels").then((module) => ({ default: module.HistoryPanel })),
);
const WorkspaceSettings = lazy(() =>
  import("./panels").then((module) => ({ default: module.WorkspaceSettings })),
);
const MediaPanel = lazy(() =>
  import("./panels").then((module) => ({ default: module.MediaPanel })),
);
const exportProduct = (product: Product) =>
  import("./panels").then((module) => module.exportProduct(product));
type Data<T = Product | ProductRecord> = WorkspaceData<T>;
async function flushEditors() {
  const tasks: Promise<boolean>[] = [];
  window.dispatchEvent(new CustomEvent("grave-flush", { detail: tasks }));
  return (await Promise.all(tasks)).every(Boolean);
}
function pathParts() {
  return typeof window === "undefined"
    ? []
    : window.location.pathname
        .split("/")
        .filter(Boolean)
        .map(decodeURIComponent);
}
export default function GraveApp() {
  const [route, setRoute] = useState<string[]>([]),
    [ready, setReady] = useState(false),
    [loaded, setLoaded] = useState<LoadedWorkspace | null>(null),
    [error, setError] = useState(""),
    [theme, setTheme] = useState("system"),
    [toast, setToast] = useState(""),
    [auth, setAuth] = useState<boolean | null>(null);
  const editor = route[0] === "editor";
  const data = matchingWorkspace(loaded, editor ? "editor" : "reader");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }, []);
  const navigate = useCallback((url: string) => {
    void (async () => {
      if (!(await flushEditors())) return;
      history.pushState(null, "", url);
      window.dispatchEvent(new Event("grave-route"));
      setRoute(pathParts());
      window.scrollTo(0, 0);
    })();
  }, []);
  useEffect(() => {
    setRoute(pathParts());
    setReady(true);
    setTheme(localStorage.getItem("grave-theme") || "system");
    // Reader pages need the MDX renderer for their largest content. Start the
    // lazy chunk while the workspace request is in flight instead of waiting
    // for the first render. Home and editor routes do not use it immediately.
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] !== "editor" && parts.length >= 2) void import("./content");
    let lastUrl = location.pathname + location.search + location.hash;
    const remember = () => {
      lastUrl = location.pathname + location.search + location.hash;
    };
    const pop = async () => {
      if (await flushEditors()) {
        setRoute(pathParts());
        remember();
      } else history.pushState(null, "", lastUrl);
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("grave-route", remember);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("grave-route", remember);
    };
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useLayoutEffect(() => {
    document.documentElement.dataset.surface = editor ? "editor" : "reader";
    return () => {
      delete document.documentElement.dataset.surface;
    };
  }, [editor]);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    setLoaded(null);
    setError("");
    async function load() {
      if (editor) {
        const r = await api<{ authenticated: boolean; configured: boolean }>(
          "/api/auth",
        );
        if (!live) return;
        setAuth(r.authenticated);
        if (!r.authenticated) return;
      }
      const result: LoadedWorkspace = editor
        ? {
            mode: "editor",
            value: await api<Data<ProductRecord>>("/api/workspace?editor=1"),
          }
        : { mode: "reader", value: await api<Data<Product>>("/api/workspace") };
      if (live) {
        setLoaded(result);
        if (!localStorage.getItem("grave-theme"))
          setTheme(result.value.workspace.theme);
      }
    }
    load().catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [ready, editor, auth === true]);
  const themeChange = (v: string) => {
    setTheme(v);
    localStorage.setItem("grave-theme", v);
  };
  return (
    <>
      {editor && <DocumentHead editor />}
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!ready ? (
        <div className="loading">Opening Grave…</div>
      ) : error ? (
        <div className="empty-state">
          <img
            className="standalone-logo logo-light"
            src="/brand/wordmark-light.png"
            alt="Grave"
          />
          <img
            className="standalone-logo logo-dark"
            src="/brand/wordmark-dark.png"
            alt="Grave"
          />
          <h1>We couldn’t open your workspace</h1>
          <p>{error}</p>
          <Button onClick={() => location.reload()}>Retry</Button>
        </div>
      ) : editor && auth === false ? (
        <Login onLogin={() => setAuth(true)} navigate={navigate} />
      ) : !data ? (
        <div className="loading">
          <img src="/favicon-32.png" alt="" />
          Opening your documentation…
        </div>
      ) : data.mode === "editor" ? (
        <TooltipProvider delayDuration={300}>
          <Editor
            data={data.value}
            route={route}
            navigate={navigate}
            notify={notify}
            theme={theme}
            themeChange={themeChange}
            onWorkspace={(w, r) =>
              setLoaded((current) =>
                current?.mode === "editor"
                  ? {
                      ...current,
                      value: { ...current.value, workspace: w, revision: r },
                    }
                  : current,
              )
            }
          />
        </TooltipProvider>
      ) : (
        <Reader
          data={data.value}
          route={route}
          navigate={navigate}
          notify={notify}
          theme={theme}
          themeChange={themeChange}
        />
      )}
      <div
        className={"toast " + (toast ? "visible" : "")}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </>
  );
}
function Login({
  onLogin,
  navigate,
}: {
  onLogin: () => void;
  navigate: (s: string) => void;
}) {
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main
      className="grid min-h-dvh place-items-center bg-muted/30 px-5 py-10"
      id="main"
      tabIndex={-1}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-7 shadow-sm">
        <img
          className="logo-light h-7 w-auto"
          src="/brand/wordmark-light.png"
          alt="Grave"
        />
        <img
          className="logo-dark h-7 w-auto"
          src="/brand/wordmark-dark.png"
          alt="Grave"
        />
        <h1 className="mt-6 text-[1.65rem] font-semibold leading-tight tracking-[-0.03em]">
          A little space for big ideas.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enter your workspace password to start writing.
        </p>
        <form
          className="mt-6 grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("/api/auth", {
                method: "POST",
                body: JSON.stringify({ password }),
              });
              onLogin();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <EField label="Workspace password">
            <EInput
              autoFocus
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </EField>
          {error ? <ENote tone="danger">{error}</ENote> : null}
          <EButton
            type="submit"
            variant="default"
            className="w-full"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Open editor"}
          </EButton>
          <EButton
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/")}
          >
            Back to documentation
          </EButton>
        </form>
      </div>
    </main>
  );
}
function useProductColors(p?: Product) {
  useEffect(() => {
    if (!p) return;
    for (const [key, value] of Object.entries(accentStyles(p.accent)))
      document.documentElement.style.setProperty(key, value);
    document.documentElement.dataset.linkStyle =
      p.linkStyle || "hover-underline";
  }, [p?.accent, p?.linkStyle]);
}
type Common<T = Product | ProductRecord> = {
  data: Data<T>;
  route: string[];
  navigate: (s: string) => void;
  notify: (s: string) => void;
  theme: string;
  themeChange: (s: string) => void;
};
function Brand({
  workspace,
  navigate,
}: {
  workspace: Workspace;
  navigate: (s: string) => void;
}) {
  return (
    <a
      className="brand"
      href="/"
      onClick={(e) => {
        e.preventDefault();
        navigate("/");
      }}
      aria-label={workspace.name + " documentation"}
    >
      <img
        className="logo-light"
        src={safeUrl(workspace.logoLight)}
        alt={workspace.name}
      />
      <img
        className="logo-dark"
        src={safeUrl(workspace.logoDark)}
        alt={workspace.name}
      />
    </a>
  );
}
function ProductSwitcher({
  products,
  current,
  onSelect,
  editor,
  onNew,
}: {
  products: Product[];
  current?: Product;
  onSelect: (p: Product) => void;
  editor?: boolean;
  onNew?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="product-switcher">
      <Button
        className="product-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon value={current?.icon || "cube"} />
        <span>{emojiNodes(current?.name || "Products")}</span>
        <Icon value="chevron-down" />
      </Button>
      {open && (
        <Suspense fallback={null}>
          <Modal title="Your products" onClose={() => setOpen(false)}>
            <div className="product-options">
              {products.map((p) => (
                <button
                  key={p.id}
                  className={
                    "product-option " + (p.id === current?.id ? "selected" : "")
                  }
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                >
                  {p.logo ? (
                    <img src={safeUrl(p.logo)} alt="" />
                  ) : (
                    <span className="product-icon" style={{ color: p.accent }}>
                      <Icon value={p.icon} />
                    </span>
                  )}
                  <span>
                    <strong>{emojiNodes(p.name)}</strong>
                    <small>{emojiNodes(p.description)}</small>
                  </span>
                  {p.id === current?.id && <Icon value="check" />}
                </button>
              ))}
            </div>
            {editor && (
              <Button
                icon="plus"
                onClick={() => {
                  setOpen(false);
                  onNew?.();
                }}
              >
                Create product
              </Button>
            )}
          </Modal>
        </Suspense>
      )}
    </div>
  );
}
function EditorProductSwitcher({
  products,
  current,
  onSelect,
  onNew,
}: {
  products: Product[];
  current?: Product;
  onSelect: (p: Product) => void;
  onNew: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <EButton
          variant="ghost"
          className="h-8 max-w-[14rem] justify-between gap-2 rounded-lg px-2 text-[13px] font-medium hover:bg-muted"
          aria-label="Switch product"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Icon value={current?.icon || "cube"} className="size-3.5" />
            <span className="max-w-24 truncate sm:max-w-none">
              {emojiNodes(current?.name || "Products")}
            </span>
          </span>
          <Icon value="chevron-down" className="size-3 opacity-40" />
        </EButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Products</DropdownMenuLabel>
        {products.map((product) => (
          <DropdownMenuItem
            key={product.id}
            onSelect={() => onSelect(product)}
            className="gap-3"
          >
            {product.logo ? (
              <img
                src={safeUrl(product.logo)}
                alt=""
                className="size-7 shrink-0 rounded object-cover"
              />
            ) : (
              <span
                className="grid size-7 shrink-0 place-items-center rounded bg-muted"
                style={{ color: product.accent }}
              >
                <Icon value={product.icon} className="size-3.5" />
              </span>
            )}
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-sm">{emojiNodes(product.name)}</span>
              <span className="truncate text-xs text-muted-foreground">
                {emojiNodes(product.description)}
              </span>
            </span>
            {product.id === current?.id ? (
              <Icon value="check" className="size-3.5 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onNew} className="gap-2">
          <Icon value="plus" className="size-3.5" />
          Create product
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditorThemeControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ESelect value={value} onValueChange={onChange}>
      <ESelectTrigger
        size="sm"
        className="h-8 w-full justify-between border-0 bg-transparent px-2 text-[11px] text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
        aria-label="Color theme"
      >
        <ESelectValue />
      </ESelectTrigger>
      <ESelectContent>
        <ESelectItem value="light">Light</ESelectItem>
        <ESelectItem value="dark">Dark</ESelectItem>
        <ESelectItem value="system">System</ESelectItem>
      </ESelectContent>
    </ESelect>
  );
}

/** Settings and lightweight tools live in the right-hand inspector. Larger
 *  canvases (media, publishing, navigation, search) stay as focused dialogs. */
const inspectorPanels = new Set([
  "Create product",
  "New page",
  "Page settings",
  "Page history",
  "Page tools",
  "Links and backlinks",
  "Homepage",
  "Product settings",
  "Reader settings",
  "Workspace settings",
  "Versions",
  "Snippets",
  "Content freshness",
]);

const pageRailPanels = new Set([
  "",
  "New page",
  "Page settings",
  "Page history",
  "Page tools",
  "Links and backlinks",
]);

const panelDescriptions: Record<string, string> = {
  "Create product": "Start a new documentation product with its own pages and reader.",
  "Product settings": "Identity, links, visibility and the message in the reader sidebar.",
  "New page": "Add a page to the current product.",
  "Page settings": "Title, URL, visibility and publication status for this page.",
  Navigation: "Organize tabs, groups and pages in the reader sidebar.",
  Homepage: "The intro and featured pages shown at the product root.",
  "Reader settings": "Page details, feedback and redirects in the reader.",
  Versions: "Freeze the current publication as a named version.",
  "Reader feedback": "See how readers rate published pages.",
  "Content freshness": "Find pages that are due for a review.",
  "Media library": "Upload, inspect and insert images.",
  "Publish changes": "Review the diff before making it public.",
  "Find and replace": "Replace text across one page or the whole product.",
  Snippets: "Reusable MDX fragments shared across pages.",
  "Page history": "Compare and restore earlier revisions.",
  "Links and backlinks": "See what links here and what is broken.",
  "Page tools": "Actions for the current page.",
  "Workspace settings": "Workspace name, links and local folder sync.",
};

function EditorSidebarItem({
  icon,
  label,
  active = false,
  onClick,
  meta,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  meta?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {icon ? (
        <span className="grid size-4 shrink-0 place-items-center text-current [&_.icon]:size-3.5">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta}
    </button>
  );
}

function SidebarNav({
  nav,
  pages,
  pageId,
  onPage,
  depth = 0,
}: {
  nav: Nav[];
  pages: Page[];
  pageId?: string;
  onPage: (p: Page) => void;
  depth?: number;
}) {
  return (
    <>
      {nav.map((n) => {
        if (n.type === "page") {
          const p = pages.find((x) => x.id === n.pageId);
          return p ? (
            <button
              key={n.id}
              className={"sidebar-link " + (p.id === pageId ? "active" : "")}
              aria-current={p.id === pageId ? "page" : undefined}
              onClick={() => onPage(p)}
            >
              <Icon value={n.icon || p.icon} />
              <span>{emojiNodes(n.title || p.title)}</span>
              {p.draft && <span className="draft-dot" title="Draft" />}
            </button>
          ) : null;
        }
        return depth === 0 ? (
          <section key={n.id} className="nav-section">
            <h3>{emojiNodes(n.title)}</h3>
            <SidebarNav
              nav={n.children}
              pages={pages}
              pageId={pageId}
              onPage={onPage}
              depth={depth + 1}
            />
          </section>
        ) : (
          <details
            key={n.id}
            className="nav-nested"
            open={flatten([n]).some((x) => x.pageId === pageId) || undefined}
          >
            <summary>
              {n.icon && <Icon value={n.icon} />} {emojiNodes(n.title)}
            </summary>
            <SidebarNav
              nav={n.children}
              pages={pages}
              pageId={pageId}
              onPage={onPage}
              depth={depth + 1}
            />
          </details>
        );
      })}
    </>
  );
}
function TocLinks({
  items,
  active,
}: {
  items: Heading[];
  active: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fill, setFill] = useState({ height: 0, visible: false });
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const update = () => {
      const link = Array.from(
        list.querySelectorAll<HTMLAnchorElement>("a"),
      ).find((a) => a.dataset.heading === active);
      setFill(
        link
          ? {
              height: Math.round(link.offsetTop + link.offsetHeight / 2),
              visible: true,
            }
          : { height: 0, visible: false },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, [items, active]);
  return (
    <div className="toc-links" ref={ref}>
      <span
        aria-hidden
        className="toc-fill"
        style={{ height: fill.height + "px", opacity: fill.visible ? 1 : 0 }}
      />
      {items.map((h) => (
        <a
          key={h.id}
          data-heading={h.id}
          aria-current={active === h.id ? "location" : undefined}
          className={active === h.id ? "active" : ""}
          href={"#" + h.id}
          style={{ paddingLeft: h.depth > 2 ? 24 : 12 }}
        >
          {emojiNodes(h.text)}
        </a>
      ))}
    </div>
  );
}
function Reader(props: Common<Product>) {
  const { data, route } = props;
  const latest = data.products.find((p) => p.slug === route[0]);
  const version = route[1] === "v" && route[2] ? route[2] : "";
  const key = latest?.id + ":" + version;
  const [loaded, setLoaded] = useState<{
    key: string;
    product?: Product;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!latest || !version) return;
    let live = true;
    api<{ product: Product }>(
      "/api/products/" +
        latest.id +
        "/versions?version=" +
        encodeURIComponent(version),
    )
      .then((r) => {
        if (live) setLoaded({ key, product: r.product });
      })
      .catch((e) => {
        if (live) setLoaded({ key, error: e.message });
      });
    return () => {
      live = false;
    };
  }, [latest?.id, version, key]);
  if (!route[0])
    return (
      <WorkspaceHome
        workspace={data.workspace}
        products={data.products}
        navigate={props.navigate}
        theme={props.theme}
        themeChange={props.themeChange}
      />
    );
  if (version && latest) {
    if (loaded?.key !== key)
      return (
        <main className="empty-state" id="main" role="status">
          Loading version…
        </main>
      );
    if (!loaded.product)
      return (
        <main className="empty-state" id="main">
          <h1>Version unavailable</h1>
          <p>{loaded.error}</p>
          <Button onClick={() => props.navigate("/" + latest.slug)}>
            Open Latest
          </Button>
        </main>
      );
    return (
      <ReaderContent
        {...props}
        key={key}
        latestProduct={latest}
        version={version}
        data={{
          ...data,
          products: data.products.map((p) =>
            p.id === latest.id
              ? { ...loaded.product!, readerVersion: version }
              : p,
          ),
        }}
        route={[route[0], route[3] || ""]}
      />
    );
  }
  return <ReaderContent {...props} version="" />;
}
function ReaderContent({
  data,
  route,
  navigate,
  notify,
  theme,
  themeChange,
  version,
  latestProduct,
}: Common<Product> & { version: string; latestProduct?: Product }) {
  useLayoutEffect(() => {
    if (location.hash) return;
    document
      .querySelector(".reader-main")
      ?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [route[0], route[1]]);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  const products = data.products;
  const p =
    products.find((x) => x.slug === route[0]) ||
    (!route[0] ? products[0] : undefined);
  const page = p?.pages.find((x) => x.slug === route[1]);
  const reading = useMemo(
    () => ({
      headings: sourceHeadings(page?.source || ""),
      minutes: readingMinutes(page?.source || ""),
    }),
    [page?.source],
  );
  const redirect = p && !page ? resolveRedirect(p, route[1] || "") : undefined;
  useEffect(() => {
    if (p && redirect)
      navigate(
        readerPath(p, redirect, version) + location.search + location.hash,
      );
  }, [p, redirect, version, navigate]);
  useProductColors(p);
  const [tab, setTab] = useState(""),
    [search, setSearch] = useState(false),
    [mobile, setMobile] = useState(false),
    [markdown, setMarkdown] = useState(false),
    [activeHeading, setActiveHeading] = useState("");
  useEffect(() => {
    if (p) setTab(page ? sectionFor(p, page.id) || "" : p.nav[0]?.id || "");
  }, [p?.id, page?.id]);
  useEffect(() => {
    setActiveHeading(reading.headings[0]?.id || "");
  }, [reading]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch(true);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setActiveHeading(entry.target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    const attach = () =>
      document
        .querySelectorAll(".heading-anchor")
        .forEach((n) => observer.observe(n));
    attach();
    const mutations = new MutationObserver(attach);
    const content = document.querySelector(".reader-main");
    if (content) mutations.observe(content, { childList: true, subtree: true });
    if (location.hash)
      setTimeout(
        () =>
          document
            .getElementById(decodeURIComponent(location.hash.slice(1)))
            ?.scrollIntoView(),
        50,
      );
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [page?.id]);
  useEffect(() => {
    let frame = 0,
      lastTime = 0,
      destination = 0;
    let scrolling: HTMLElement | null = null;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      scrolling = null;
    };
    const tick = (time: number) => {
      if (!scrolling) return;
      const elapsed = Math.min(time - lastTime, 32);
      lastTime = time;
      destination = Math.max(
        0,
        Math.min(destination, scrolling.scrollHeight - scrolling.clientHeight),
      );
      const distance = destination - scrolling.scrollTop;
      if (Math.abs(distance) < 0.5) {
        scrolling.scrollTo({ top: destination, behavior: "instant" });
        stop();
        return;
      }
      scrolling.scrollTo({
        top: scrolling.scrollTop + distance * (1 - Math.exp(-elapsed / 65)),
        behavior: "instant",
      });
      frame = requestAnimationFrame(tick);
    };
    const handleWheel = (event: WheelEvent) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        event.ctrlKey ||
        event.defaultPrevented ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ) {
        stop();
        return;
      }
      const reader = target.closest(".reader");
      if (
        !reader ||
        target.closest(".reader-sidebar") ||
        target.closest(".modal,[role=dialog]")
      ) {
        stop();
        return;
      }
      const main = reader.querySelector<HTMLElement>(".reader-main");
      if (
        !main ||
        target.closest(".reader-main") ||
        getComputedStyle(main).overflowY === "visible"
      ) {
        stop();
        return;
      }
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? main.clientHeight
            : 1;
      const delta = event.deltaY * unit;
      if (reduced.matches) {
        stop();
        main.scrollBy({ top: delta, behavior: "instant" });
        return;
      }
      if (
        scrolling !== main ||
        Math.sign(delta) !== Math.sign(destination - main.scrollTop)
      )
        destination = main.scrollTop;
      scrolling = main;
      destination = Math.max(
        0,
        Math.min(destination + delta, main.scrollHeight - main.clientHeight),
      );
      if (!frame) {
        lastTime = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("pointerdown", stop);
    window.addEventListener("keydown", stop);
    window.addEventListener("grave-route", stop);
    return () => {
      stop();
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("grave-route", stop);
    };
  }, [route[0], route[1]]);
  if (!p)
    return (
      <main className="empty-state" id="main">
        <h1>
          {products.length
            ? "Product not found"
            : "Your next great guide starts here."}
        </h1>
        <p>
          {products.length
            ? "Choose a product to continue."
            : "Publish a product from the editor to make it available to readers."}
        </p>
        {products.map((x) => (
          <Button key={x.id} onClick={() => navigate("/" + x.slug)}>
            {x.name}
          </Button>
        ))}
        <Button onClick={() => navigate("/editor")}>Open editor</Button>
      </main>
    );
  const pages = visiblePages(p),
    nav = pruneNav(p.nav, pages),
    section = nav.find((x) => x.id === tab) || nav[0];
  const assigned = flatten(p.nav).map((n) => n.pageId),
    other = pages.filter((x) => !assigned.includes(x.id));
  const ordered = flatten(section?.children || []).flatMap((n) =>
    n.pageId ? pages.filter((x) => x.id === n.pageId) : [],
  );
  const pageIndex = ordered.findIndex((x) => x.id === page?.id);
  const hs = reading.headings;
  const open = (x: Page, hash = "") => {
    navigate(readerPath(p, x, version) + (hash ? "#" + hash : ""));
    setTab(sectionFor(p, x.id) || "");
    setMobile(false);
    setSearch(false);
    if (hash)
      setTimeout(() => document.getElementById(hash)?.scrollIntoView(), 50);
  };
  const side = (
    <>
      <button
        className={"sidebar-link " + (!page ? "active" : "")}
        aria-current={!page ? "page" : undefined}
        onClick={() => {
          navigate(readerPath(p, undefined, version));
          setMobile(false);
        }}
      >
        <Icon value="house" />
        Overview
      </button>
      {other.map((x) => (
        <button
          key={x.id}
          className={"sidebar-link " + (x.id === page?.id ? "active" : "")}
          aria-current={x.id === page?.id ? "page" : undefined}
          onClick={() => open(x)}
        >
          <Icon value={x.icon} />
          <span>{emojiNodes(x.title)}</span>
        </button>
      ))}
      <SidebarNav
        nav={[
          ...(section?.children || []).filter((n) => n.type === "page"),
          ...(section?.children || []).filter((n) => n.type !== "page"),
        ]}
        pages={pages}
        pageId={page?.id}
        onPage={open}
      />
      {p.message.title && (
        <a className="sidebar-message" href={readerLink(p, p.message.href)}>
          <Icon value={p.message.icon} />
          <strong>{emojiNodes(p.message.title)}</strong>
          <p>{emojiNodes(p.message.description)}</p>
        </a>
      )}
      <VersionSwitcher
        product={p}
        latest={latestProduct || p}
        page={page}
        version={version}
        navigate={navigate}
      />
      <div className="sidebar-bottom">
        <ThemeControl value={theme} onChange={themeChange} />
        <a
          href="/editor"
          onClick={(e) => {
            e.preventDefault();
            navigate("/editor/" + p.id);
          }}
        >
          <Icon value="pen-to-square" /> Editor
        </a>
      </div>
    </>
  );
  return (
    <div
      className="reader"
      style={accentStyles(p.accent) as React.CSSProperties}
    >
      <DocumentHead
        product={p}
        page={page}
        version={version}
        missing={!!route[1] && !page}
      />
      <header className="reader-header">
        <div className="header-main">
          <div className="brand-group">
            <Brand workspace={data.workspace} navigate={navigate} />
            <span className="brand-divider" />
            <ProductSwitcher
              products={products}
              current={p}
              onSelect={(x) => navigate("/" + x.slug)}
            />
          </div>
          <Button
            className="search-trigger"
            icon="magnifying-glass"
            onClick={() => setSearch(true)}
          >
            Search documentation<kbd>⌘ K</kbd>
          </Button>
          <div className="header-links">
            {data.workspace.links.map((x, i) => (
              <a key={i} href={safeUrl(x.href)}>
                {emojiNodes(x.title)}
              </a>
            ))}
            <Button
              className="mobile-menu"
              icon="bars"
              aria-label="Open navigation"
              aria-haspopup="dialog"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            />
          </div>
        </div>
        <nav className="reader-tabs" aria-label="Documentation sections">
          {nav.map((n) => (
            <button
              key={n.id}
              className={section?.id === n.id ? "active" : ""}
              onClick={() => {
                setTab(n.id);
                if (page) {
                  const first = flatten(n.children).find((x) => x.pageId);
                  const next = pages.find((x) => x.id === first?.pageId);
                  if (next) open(next);
                }
              }}
            >
              {emojiNodes(n.title)}
            </button>
          ))}
        </nav>
      </header>
      <div className="reader-layout">
        <aside className="reader-sidebar">{side}</aside>
        <main id="main" className={"reader-main " + (!page ? "homepage" : "")}>
          {redirect ? (
            <p role="status">Opening the moved page…</p>
          ) : route[1] && !page ? (
            <div className="empty-state">
              <h1>Page not found</h1>
              <p>This page may have moved or is not published.</p>
              <Button onClick={() => navigate("/" + p.slug)}>
                Browse documentation
              </Button>
            </div>
          ) : !page ? (
            <Homepage product={p} nav={nav} onOpen={open} />
          ) : (
            <>
              <div className="breadcrumb">
                <span>{emojiNodes(section?.title || p.name)}</span>
                <Icon value="chevron-right" />
                <span>{emojiNodes(page.title)}</span>
              </div>
              <header className="page-heading">
                <span className="eyebrow">
                  <span className="tiny-gem" />
                  {emojiNodes(p.name)} DOCUMENTATION
                </span>
                <h1>{emojiNodes(page.title)}</h1>
                <p>{emojiNodes(page.description)}</p>
                <div className="page-actions">
                  <Button
                    icon="copy"
                    onClick={() => copyText(page.source, notify)}
                  >
                    Copy page
                  </Button>
                  <span className="page-action-divider" aria-hidden="true" />
                  <Button icon="code" onClick={() => setMarkdown(true)}>
                    View as Markdown
                  </Button>
                  <span className="page-action-divider" aria-hidden="true" />
                  <Button icon="print" onClick={() => window.print()}>
                    Print / PDF
                  </Button>
                </div>
                <div className="page-freshness">
                  {version && <span>Version {version}</span>}
                  {p.reader?.updated !== false && page.updatedAt && (
                    <time dateTime={page.updatedAt}>
                      Updated {new Date(page.updatedAt).toLocaleDateString()}
                    </time>
                  )}
                  {p.reader?.readingTime !== false && (
                    <span>{reading.minutes} min read</span>
                  )}
                </div>
              </header>
              <details className="mobile-toc">
                <summary>On this page</summary>
                {hs.map((h) => (
                  <a key={h.id} href={"#" + h.id}>
                    {emojiNodes(h.text)}
                  </a>
                ))}
              </details>
              <Suspense
                fallback={
                  <div className="content-skeleton" role="status">
                    <span />
                    <span />
                    <span />
                  </div>
                }
              >
                <Content
                  source={page.source}
                  product={p}
                  notify={notify}
                  printing={printing}
                />
              </Suspense>
              {p.reader?.feedback !== false && (
                <PageFeedback
                  key={p.id + version + page.id}
                  product={p}
                  page={page}
                  version={version}
                />
              )}
              <footer className="page-footer">
                <span>Made with care. Built with Grave.</span>
                <div className="prev-next">
                  {pageIndex > 0 ? (
                    <button onClick={() => open(ordered[pageIndex - 1])}>
                      <small>Previous</small>
                      <strong>
                        {emojiNodes(ordered[pageIndex - 1].title)}
                      </strong>
                    </button>
                  ) : (
                    <span />
                  )}
                  {pageIndex >= 0 && ordered[pageIndex + 1] && (
                    <button onClick={() => open(ordered[pageIndex + 1])}>
                      <small>Next</small>
                      <strong>
                        {emojiNodes(ordered[pageIndex + 1].title)}
                      </strong>
                    </button>
                  )}
                </div>
              </footer>
            </>
          )}
        </main>
        {page && (
          <aside className="toc">
            <h3>
              <Icon value="list" /> On this page
            </h3>
            <TocLinks items={hs} active={activeHeading} />
            <div className="toc-footer">
              <Icon value="book-open" />
              <p>
                Clear answers.
                <br />A little less searching.
              </p>
            </div>
          </aside>
        )}
      </div>
      {search && (
        <Suspense fallback={<div role="status">Opening search…</div>}>
          <Search product={p} onClose={() => setSearch(false)} onOpen={open} />
        </Suspense>
      )}{" "}
      {markdown && page && (
        <Suspense fallback={null}>
          <Modal
            title="View as Markdown"
            wide
            onClose={() => setMarkdown(false)}
          >
            <div className="markdown-view">
              <div className="markdown-view-head">
                <span className="muted">{page.slug}.mdx</span>
                <Button
                  icon="copy"
                  onClick={() => copyText(page.source, notify)}
                >
                  Copy Markdown
                </Button>
              </div>
              <pre>{page.source}</pre>
            </div>
          </Modal>
        </Suspense>
      )}{" "}
      {mobile && (
        <Suspense fallback={null}>
          <Modal
            title="Documentation navigation"
            onClose={() => setMobile(false)}
          >
            {side}
          </Modal>
        </Suspense>
      )}
    </div>
  );
}
function Homepage({
  product: p,
  nav,
  onOpen,
}: {
  product: Product;
  nav: Nav[];
  onOpen: (p: Page) => void;
}) {
  const pages = visiblePages(p);
  const byId = new Map(pages.map((x) => [x.id, x]));
  const featured = p.home.featured
    .map((id) => byId.get(id))
    .filter((x): x is Page => Boolean(x))
    .slice(0, 3);
  const linked = new Set(
    flatten(nav)
      .map((x) => x.pageId)
      .filter((id): id is string => Boolean(id)),
  );
  const configuredGroups = nav.flatMap((n) => n.children);
  const unassigned = pages.filter((x) => !linked.has(x.id));
  const groups = unassigned.length
    ? [
        ...configuredGroups,
        {
          id: "homepage-more",
          title: "More documentation",
          type: "group" as const,
          icon: { name: "book-open" },
          children: unassigned.map((x) => ({
            id: "homepage-" + x.id,
            title: x.title,
            type: "page" as const,
            pageId: x.id,
            icon: x.icon,
            children: [],
          })),
        },
      ]
    : configuredGroups;
  const groupPages = (group: Nav) =>
    Array.from(
      new Map(
        flatten([group])
          .map((x) => (x.pageId ? byId.get(x.pageId) : undefined))
          .filter((x): x is Page => Boolean(x))
          .map((x) => [x.id, x]),
      ).values(),
    );
  const visibleGroups = groups
    .map((group) => ({ group, pages: groupPages(group) }))
    .filter((x) => x.pages.length > 0);
  return (
    <>
      {p.home.enabled && (
        <section className="home-intro">
          <span className="eyebrow">
            <span className="tiny-gem" />
            {emojiNodes(p.home.eyebrow)}
          </span>
          <h1>{emojiNodes(p.home.title)}</h1>
          <p>{emojiNodes(p.home.description)}</p>
          {byId.has(p.home.start) && (
            <Button
              className="primary"
              icon="book-open"
              onClick={() => onOpen(byId.get(p.home.start)!)}
            >
              {emojiNodes(p.home.button)}
            </Button>
          )}
          <div className="intro-index" aria-hidden>
            01 / EXPLORE
          </div>
        </section>
      )}
      {featured.length > 0 && (
        <div className="featured-grid">
          {featured.map((x, i) => (
            <button
              key={x.id}
              className="featured-card"
              onClick={() => onOpen(x)}
            >
              <span className="featured-icon">
                <Icon value={x.icon} />
              </span>
              <span className="card-number">0{i + 1}</span>
              <h2>{emojiNodes(x.title)}</h2>
              <p>{emojiNodes(x.description)}</p>
              <span className="card-cta">Read guide</span>
            </button>
          ))}
        </div>
      )}
      {visibleGroups.length > 0 ? (
        <section className="guide-section">
          <div className="section-heading">
            <h2>Find your next step</h2>
            <span>
              {pages.length} {pages.length === 1 ? "guide" : "guides"} to
              explore
            </span>
          </div>
          <div className="guide-grid">
            {visibleGroups.map(({ group, pages: groupPages }) => (
              <section key={group.id}>
                <h3>
                  <Icon value={group.icon || "folder-open"} />
                  {emojiNodes(group.title)}
                </h3>
                {groupPages.map((x) => (
                  <button key={x.id} onClick={() => onOpen(x)}>
                    <span>{emojiNodes(x.title)}</span>
                    <Icon value={x.icon} />
                  </button>
                ))}
              </section>
            ))}
          </div>
        </section>
      ) : (
        <div className="empty-state homepage-empty">
          <h2>No published pages yet</h2>
          <p>Publish a page from the editor to start building this overview.</p>
        </div>
      )}
      <footer className="home-footer">
        <img src="/favicon-32.png" alt="" />
        <span>Thoughtfully documented with Grave.</span>
      </footer>
    </>
  );
}
function Editor({
  data,
  route,
  navigate,
  notify,
  theme,
  themeChange,
  onWorkspace,
}: Common<ProductRecord> & { onWorkspace: (w: Workspace, r: number) => void }) {
  const [records, setRecords] = useState<ProductRecord[]>(data.products),
    [selected, setSelected] = useState(route[1] || data.products[0]?.id || ""),
    [pageId, setPageId] = useState(""),
    [mode, setMode] = useState("Visual"),
    [panel, setPanel] = useState(""),
    [status, setStatus] = useState("Saved"),
    [saveError, setSaveError] = useState(""),
    [filesError, setFilesError] = useState(folderSyncFailed),
    [conflict, setConflict] = useState(false),
    [mobile, setMobile] = useState(false),
    [publishBusy, setPublishBusy] = useState(false),
    [pendingFile, setPendingFile] = useState<File | null>(null),
    [imageTarget, setImageTarget] = useState<Node | null>(null),
    [newName, setNewName] = useState(""),
    [recover, setRecover] = useState<Product | null>(null),
    [deleteTarget, setDeleteTarget] = useState<"product" | "page" | null>(null),
    [search, setSearch] = useState(false);
  useEffect(() => {
    if (panel) setMobile(false);
  }, [panel]);
  useEffect(() => {
    const failed = () => setFilesError(true);
    window.addEventListener("grave-files-error", failed);
    return () => window.removeEventListener("grave-files-error", failed);
  }, []);
  const imageInsertionOffset = useRef<number | null>(null);
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const saved = useRef(
    new Map<string, string>(
      data.products.map((r: ProductRecord) => [r.id, JSON.stringify(r.draft)]),
    ),
  );
  const blocked = useRef(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const undoStack = useRef<Product[]>([]),
    redoStack = useRef<Product[]>([]);
  const record = records.find((x) => x.id === selected),
    p = record?.draft,
    page = p?.pages.find((x) => x.id === pageId);
  const productLive = Boolean(record?.published);
  const pagePublished = Boolean(
    record?.published?.pages.some((x) => x.id === pageId),
  );
  const [, setUndoCount] = useState(0);
  useProductColors(p);
  const change = useCallback(
    (next: Product) => {
      const current = recordsRef.current.find((x) => x.id === next.id);
      if (current)
        next = {
          ...next,
          pages: next.pages.map((page) => {
            const old = current.draft.pages.find((p) => p.id === page.id);
            return old &&
              (old.source !== page.source ||
                old.title !== page.title ||
                old.description !== page.description)
              ? { ...page, reviewedAt: undefined }
              : page;
          }),
        };
      if (!current || JSON.stringify(current.draft) === JSON.stringify(next))
        return;
      undoStack.current.push(current.draft);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
      setUndoCount((v) => v + 1);
      recordsRef.current = recordsRef.current.map((x) =>
        x.id === next.id ? { ...x, draft: next } : x,
      );
      setRecords(recordsRef.current);
      setStatus("Unsaved");
      try {
        localStorage.setItem(
          "grave-recovery-" + next.id,
          JSON.stringify({
            draft: next,
            base: saved.current.get(next.id),
            savedAt: Date.now(),
          }),
        );
      } catch {
        notify(
          "Draft recovery storage is full. Download a backup to protect your work.",
        );
      }
    },
    [notify],
  );

  const persist = useMemo(
    () =>
      singleFlight(async (): Promise<boolean> => {
        const id = selectedRef.current;
        for (;;) {
          const r = recordsRef.current.find((x) => x.id === id);
          if (!r || saved.current.get(id) === JSON.stringify(r.draft))
            return true;
          if (blocked.current) return false;
          const snapshot = JSON.stringify(r.draft);
          setStatus("Saving");
          try {
            const result = await api<{ revision: number }>(
              "/api/products/" + id,
              {
                method: "PUT",
                body: JSON.stringify({ draft: r.draft, revision: r.revision }),
              },
            );
            saved.current.set(id, snapshot);
            recordsRef.current = recordsRef.current.map((x) =>
              x.id === id ? { ...x, revision: result.revision } : x,
            );
            setRecords(recordsRef.current);
            const latest = recordsRef.current.find((x) => x.id === id);
            const clean = JSON.stringify(latest?.draft) === snapshot;
            try {
              if (clean) localStorage.removeItem("grave-recovery-" + id);
              else
                localStorage.setItem(
                  "grave-recovery-" + id,
                  JSON.stringify({
                    draft: latest?.draft,
                    base: snapshot,
                    savedAt: Date.now(),
                  }),
                );
            } catch {
              notify(
                "Browser recovery storage is unavailable. Download a backup to protect unsaved work.",
              );
            }
            setStatus(clean ? "Saved" : "Unsaved");
            setSaveError("");
          } catch (e) {
            const err = e as Error & { status?: number };
            setSaveError(err.message);
            setStatus("Error");
            if (err.status === 409) {
              blocked.current = true;
              setConflict(true);
            }
            return false;
          }
        }
      }),
    [notify],
  );
  const save = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".editor"))
      active.blur();
    return persist();
  }, [persist]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === "Unsaved") persist();
    }, 900);
    return () => clearTimeout(timer);
  }, [records, status, persist]);
  useEffect(() => {
    const r = recordsRef.current.find((x) => x.id === selected);
    setPageId(r?.draft.pages[0]?.id || "");
    undoStack.current = [];
    redoStack.current = [];
    setUndoCount(0);
    const raw = localStorage.getItem("grave-recovery-" + selected);
    if (raw) {
      try {
        const backup = JSON.parse(raw);
        if (JSON.stringify(backup.draft) !== JSON.stringify(r?.draft))
          setRecover(backup.draft);
      } catch {}
    }
  }, [selected]);
  useEffect(() => {
    const flush = (event: Event) => {
      (event as CustomEvent<Promise<boolean>[]>).detail.push(save());
    };
    window.addEventListener("grave-flush", flush);
    const unload = (e: BeforeUnloadEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest(".editor"))
        active.blur();
      if (
        recordsRef.current.some(
          (x) => saved.current.get(x.id) !== JSON.stringify(x.draft),
        )
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    const keyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("grave-flush", flush);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("keydown", keyboard);
    };
  }, [save]);
  const switchProduct = async (next: Product) => {
    if (!(await save())) return;
    selectedRef.current = next.id;
    setSelected(next.id);
    navigate("/editor/" + next.id);
    setPanel("");
    blocked.current = false;
    setConflict(false);
    setSaveError("");
    setStatus("Saved");
  };
  const [qualityIssue, setQualityIssue] = useState<QualityIssue | undefined>();
  const qualityHandoff = useRef(false);
  const openQualityIssue = async (issue: QualityIssue) => {
    if (!(await save())) return;
    setPageId(issue.pageId);
    setQualityIssue({ ...issue });
    setMobile(false);
    if (issue.target === "settings") setPanel("Page settings");
    else if (issue.snippet) setPanel("Snippets");
    else {
      qualityHandoff.current = true;
      setMode("Source");
      setPanel("");
    }
  };
  const choosePage = async (next: Page) => {
    (document.activeElement as HTMLElement)?.blur();
    if (!(await save())) return;
    setQualityIssue(undefined);
    setPageId(next.id);
    setMobile(false);
  };
  const patchPage = async (source: string) => {
    setQualityIssue(undefined);
    const p = recordsRef.current.find(
      (x) => x.id === selectedRef.current,
    )?.draft;
    const page = p?.pages.find((x) => x.id === pageId);
    if (!p || !page) return;
    const { metadata } = await import("@/lib/mdx");
    const meta = metadata(source);
    const changes: Partial<Page> = { source };
    for (const key of ["title", "description", "slug"] as const)
      if (typeof meta[key] === "string") changes[key] = meta[key];
    if (typeof meta.hidden === "boolean") changes.hidden = meta.hidden;
    if (typeof meta.draft === "boolean") changes.draft = meta.draft;
    change({
      ...p,
      pages: p.pages.map((x) => (x.id === page.id ? { ...x, ...changes } : x)),
    });
  };
  const history = (redo = false) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".editor"))
      active.blur();
    const p = recordsRef.current.find(
      (x) => x.id === selectedRef.current,
    )?.draft;
    if (!p) return;
    const from = redo ? redoStack : undoStack,
      to = redo ? undoStack : redoStack;
    const prev = from.current.pop();
    if (!prev) return;
    to.current.push(p);
    recordsRef.current = recordsRef.current.map((x) =>
      x.id === p.id ? { ...x, draft: prev } : x,
    );
    setRecords(recordsRef.current);
    setStatus("Unsaved");
    setUndoCount((v) => v + 1);
    try {
      localStorage.setItem(
        "grave-recovery-" + p.id,
        JSON.stringify({
          draft: prev,
          base: saved.current.get(p.id),
          savedAt: Date.now(),
        }),
      );
    } catch {
      notify(
        "Draft recovery storage is full. Download a backup to protect your work.",
      );
    }
  };
  const sidebar = (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="flex items-center justify-between px-5 pb-2 pt-3.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          Navigation
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        <button
          type="button"
          onClick={() => setPanel("Product settings")}
          aria-current={panel === "Product settings" ? "page" : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            panel === "Product settings"
              ? "bg-muted text-foreground"
              : "text-foreground hover:bg-muted/60",
          )}
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-md border border-border/80 bg-muted/50 text-muted-foreground [&_.icon]:size-3">
            <Icon value={p?.icon || "book"} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
            {p ? emojiNodes(p.name) : "No product yet"}
          </span>
          {p ? (
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                productLive ? "bg-emerald-500" : "bg-amber-500",
              )}
              title={productLive ? "Published" : "Draft"}
            />
          ) : null}
        </button>
        <div className="ml-3 mt-1 border-l border-border/60 pl-2">
          <nav className="grid gap-0.5">
            <EditorSidebarItem
              icon={<Icon value="house" className="size-3.5" />}
              label="Homepage"
              active={panel === "Homepage"}
              onClick={() => setPanel("Homepage")}
            />
            <EditorSidebarItem
              icon={<Icon value="compass" className="size-3.5" />}
              label="Navigation"
              active={panel === "Navigation"}
              onClick={() => setPanel("Navigation")}
            />
            <div className="mt-4 flex items-center justify-between px-2 pb-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Pages
              </span>
              <EIconButton
                icon="plus"
                label="New page"
                className="size-6 hover:bg-muted"
                onClick={() => setPanel("New page")}
              />
            </div>
            {p?.pages.map((x) => (
              <EditorSidebarItem
                key={x.id}
                icon={<Icon value={x.icon} className="size-3.5" />}
                label={emojiNodes(x.title)}
                active={x.id === pageId}
                onClick={() => choosePage(x)}
                meta={
                  <>
                    {x.draft ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-foreground/30"
                        title="Draft"
                      />
                    ) : null}
                    {x.hidden ? (
                      <Icon
                        value="eye-slash"
                        className="size-3 shrink-0 text-muted-foreground"
                      />
                    ) : null}
                  </>
                }
              />
            ))}
            <div className="mt-4 border-t border-border/70 pt-3">
              <div className="px-2 pb-1.5 text-[11px] font-medium text-muted-foreground">
                Tools
              </div>
              {[
                ["Reader settings", "book-open"],
                ["Reader feedback", "comment"],
                ["Content freshness", "clock"],
              ].map(([name, icon]) => (
                <EditorSidebarItem
                  key={name}
                  icon={<Icon value={icon} className="size-3.5" />}
                  label={name}
                  active={panel === name}
                  onClick={() => setPanel(name)}
                />
              ))}
              {/* The icon rail owns these on desktop; keep them in the mobile
                  navigation sheet so every tool remains reachable. */}
              <div className="md:hidden">
                {[
                  ["Find and replace", "magnifying-glass"],
                  ["Media library", "images"],
                  ["Snippets", "puzzle-piece"],
                  ["Versions", "code-branch"],
                  ["Product settings", "sliders"],
                  ["Workspace settings", "gear"],
                ].map(([name, icon]) => (
                  <EditorSidebarItem
                    key={name}
                    icon={<Icon value={icon} className="size-3.5" />}
                    label={name}
                    active={panel === name}
                    onClick={async () => {
                      if (name !== "Versions" || (await save())) setPanel(name);
                    }}
                  />
                ))}
              </div>
            </div>
          </nav>
        </div>
      </div>
      <div className="shrink-0 border-t border-border/80 p-2.5">
        <div className="flex items-center gap-2.5 px-1 pb-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-muted text-[11px] font-semibold text-foreground">
            {(data.workspace.name || "G").slice(0, 1).toUpperCase()}
          </span>
          <span className="grid min-w-0">
            <span className="truncate text-xs font-medium">
              {data.workspace.name || "Grave workspace"}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              Documentation studio
            </span>
          </span>
        </div>
        <EditorThemeControl value={theme} onChange={themeChange} />
        <EButton
          variant="ghost"
          size="sm"
          className="mt-0.5 h-8 w-full justify-start px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={async () => {
            if (await save()) {
              await api("/api/auth", { method: "DELETE" });
              location.href = "/";
            }
          }}
        >
          Sign out
        </EButton>
      </div>
    </div>
  );
  const emptyState = (
    <div className="grid min-h-[60vh] place-items-center px-6 py-16">
      <div className="grid max-w-sm justify-items-center gap-3 text-center">
        <span className="grid size-11 place-items-center rounded-xl border border-border bg-muted/60 text-muted-foreground">
          <Icon value="feather-pointed" className="size-4" />
        </span>
        <h1 className="text-xl font-semibold tracking-[-0.02em]">
          {p
            ? "Every great guide starts with a page."
            : "Make room for your next idea."}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {p
            ? "Create a page from scratch or start with a template."
            : "Create a product to begin your documentation."}
        </p>
        <EButton
          variant="default"
          icon="plus"
          className="mt-2"
          onClick={() => setPanel(p ? "New page" : "Create product")}
        >
          {p ? "Create your first page" : "Create a product"}
        </EButton>
      </div>
    </div>
  );
  const imageHandlers = {
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("Files")) e.preventDefault();
    },
    onDrop: (e: React.DragEvent) => {
      const file = e.dataTransfer.files[0];
      if (file) {
        e.preventDefault();
        imageInsertionOffset.current = null;
        setPendingFile(file);
        setImageTarget(null);
        setPanel("Media library");
      }
    },
    onPaste: (e: React.ClipboardEvent) => {
      const file = Array.from(e.clipboardData.files).find((f) =>
        f.type.startsWith("image/"),
      );
      if (file) {
        e.preventDefault();
        setPendingFile(file);
        setImageTarget(null);
        setPanel("Media library");
      }
    },
  };
  const statusDot = {
    Saved: "bg-foreground/55",
    Saving: "animate-pulse bg-foreground/35",
    Unsaved: "bg-foreground/25",
    Error: "bg-destructive",
  }[status] || "bg-foreground/25";
  const panelVariant = inspectorPanels.has(panel) ? "inspector" : "modal";
  const pagesActive = pageRailPanels.has(panel);
  return (
    <div
      className="editor flex h-dvh flex-col overflow-hidden bg-background text-foreground"
      style={accentStyles(p?.accent || "#0166ff") as React.CSSProperties}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-background px-3 dark:bg-[var(--surface)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.035)] sm:px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Brand
            workspace={data.workspace}
            navigate={async (url) => {
              if (await save()) navigate(url);
            }}
          />
          <span className="hidden h-4 w-px shrink-0 bg-border sm:block" />
          <EditorProductSwitcher
            products={records.map((x) => x.draft)}
            current={p}
            onSelect={switchProduct}
            onNew={() => setPanel("Create product")}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className="mr-1 hidden items-center gap-2 px-1 text-[11px] font-medium text-muted-foreground sm:inline-flex"
            role="status"
            aria-live="polite"
          >
            <span className={cn("size-1.5 rounded-full", statusDot)} />
            {status === "Saved"
              ? "Saved"
              : status === "Saving"
                ? "Saving…"
                : status === "Unsaved"
                  ? "Unsaved"
                  : status}
          </span>
          <EButton
            variant="ghost"
            size="sm"
            icon="arrow-up-right-from-square"
            aria-label="View docs"
            className="h-8 rounded-lg px-2.5 text-[13px]"
            onClick={async () => {
              if (await save()) navigate("/" + p?.slug);
            }}
          >
            <span className="hidden sm:inline">View docs</span>
          </EButton>
          <EButton
            variant="default"
            size="sm"
            icon="paper-plane"
            disabled={!p}
            className="h-8 rounded-lg px-3.5 text-[13px] shadow-none"
            onClick={async () => {
              if (await save()) setPanel("Publish changes");
            }}
          >
            Publish
          </EButton>
          <EIconButton
            icon="bars"
            label="Open editor navigation"
            variant="ghost"
            className="size-8 md:hidden"
            aria-haspopup="dialog"
            aria-expanded={mobile}
            onClick={() => setMobile(true)}
          />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Editor tools"
          className="hidden w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-border/80 bg-muted/20 px-2 py-3 dark:bg-[var(--surface)] md:flex"
        >
          <EIconButton
            icon="file-lines"
            label="Pages"
            aria-current={pagesActive ? "page" : undefined}
            className={cn(
              "size-8 shrink-0 rounded-lg",
              pagesActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setPanel("")}
          />
          <EIconButton
            icon="magnifying-glass"
            label="Find and replace"
            aria-current={panel === "Find and replace" ? "page" : undefined}
            className={cn(
              "size-8 shrink-0 rounded-lg",
              panel === "Find and replace"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setPanel("Find and replace")}
          />
          <span className="my-1 h-px w-5 shrink-0 bg-border/80" />
          {[
            ["Media library", "images"],
            ["Snippets", "puzzle-piece"],
            ["Versions", "code-branch"],
          ].map(([name, icon]) => (
            <EIconButton
              key={name}
              icon={icon}
              label={name}
              aria-current={panel === name ? "page" : undefined}
              className={cn(
                "size-8 shrink-0 rounded-lg",
                panel === name
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={async () => {
                if (name !== "Versions" || (await save())) setPanel(name);
              }}
            />
          ))}
          <div className="mt-auto flex flex-col items-center gap-1 pt-2">
            <span className="mb-1 h-px w-5 shrink-0 bg-border/80" />
            <EIconButton
              icon="sliders"
              label="Product settings"
              aria-current={panel === "Product settings" ? "page" : undefined}
              className={cn(
                "size-8 shrink-0 rounded-lg",
                panel === "Product settings"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setPanel("Product settings")}
            />
            <EIconButton
              icon="gear"
              label="Workspace settings"
              aria-current={panel === "Workspace settings" ? "page" : undefined}
              className={cn(
                "size-8 shrink-0 rounded-lg",
                panel === "Workspace settings"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setPanel("Workspace settings")}
            />
          </div>
        </nav>
        <aside className="hidden h-full w-60 shrink-0 border-r border-border/80 bg-muted/20 dark:bg-[var(--surface)] md:flex md:flex-col">
          {sidebar}
        </aside>
        <main
          className={cn(
            "flex h-full min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200",
            panelVariant === "inspector" && "xl:pr-[380px]",
          )}
          id="main"
        >
          <Tabs
            value={mode}
            onValueChange={setMode}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-background px-3 py-1.5 dark:bg-[var(--surface)] sm:px-4 md:px-5">
              <div className="flex min-w-0 items-center gap-1.5 text-[12px]">
                <Icon
                  value={page?.icon || "file-lines"}
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                {p ? (
                  <>
                    <span className="hidden max-w-32 truncate text-muted-foreground sm:inline">
                      {emojiNodes(p.name)}
                    </span>
                    <span className="hidden text-border sm:inline">/</span>
                  </>
                ) : null}
                <span className="min-w-0 truncate font-medium text-foreground">
                  {emojiNodes(page?.title || "Your workspace")}
                </span>
                {page ? (
                  <EBadge
                    variant="outline"
                    className="ml-1 h-5 shrink-0 gap-1.5 rounded-md border-transparent bg-transparent px-1.5 text-[10px] font-medium text-muted-foreground"
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        page.draft
                          ? "bg-amber-500"
                          : pagePublished
                            ? "bg-emerald-500"
                            : "bg-muted-foreground/50",
                      )}
                    />
                    {page.draft
                      ? "Draft"
                      : pagePublished
                        ? "Published"
                        : "Ready"}
                  </EBadge>
                ) : null}
              </div>
              <div className="flex items-center gap-0.5">
                <TabsList className="h-8 rounded-lg bg-muted/60 p-0.5">
                  {["Visual", "Source", "Preview"].map((value) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="h-7 rounded-md px-2.5 text-[12px]"
                    >
                      {value}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ESeparator orientation="vertical" className="mx-1.5 h-4" />
                <EIconButton
                  icon="rotate-left"
                  label="Undo"
                  className="size-7"
                  disabled={!undoStack.current.length}
                  onClick={() => history()}
                />
                <EIconButton
                  icon="rotate-right"
                  label="Redo"
                  className="size-7"
                  disabled={!redoStack.current.length}
                  onClick={() => history(true)}
                />
                <EIconButton
                  icon="ellipsis"
                  label="Page tools"
                  className="size-7"
                  onClick={() => setPanel("Page tools")}
                />
              </div>
            </div>
          {filesError && (
            <div
              className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-600/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 sm:px-4 md:px-6 dark:text-amber-300"
              role="alert"
            >
              <span className="min-w-0 flex-1">
                Your changes are saved in the database, but the project files
                could not be updated.
              </span>
              <EButton
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await api("/api/local-files", { method: "POST" });
                    setFilesError(false);
                    notify("Project files updated");
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                Retry folder sync
              </EButton>
            </div>
          )}
          {saveError && (
            <div
              className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive sm:px-4 md:px-6"
              role="alert"
            >
              <span className="min-w-0 flex-1">{saveError}</span>
              <div className="flex flex-wrap items-center gap-2">
                {!conflict && (
                  <EButton size="sm" variant="outline" onClick={() => save()}>
                    Retry save
                  </EButton>
                )}
                <EButton
                  size="sm"
                  variant="outline"
                  icon="download"
                  onClick={() =>
                    download(
                      (p?.slug || "grave") + "-draft-backup.json",
                      JSON.stringify(p, null, 2),
                    )
                  }
                >
                  Download draft backup
                </EButton>
                {conflict && (
                  <EButton
                    size="sm"
                    variant="outline"
                    onClick={() => location.reload()}
                  >
                    Reload saved draft
                  </EButton>
                )}
              </div>
            </div>
          )}
          <TabsContent
            value="Visual"
            className="m-0 min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div
              className="mx-auto w-full max-w-[800px] px-6 pb-24 pt-14 sm:px-10 sm:pt-16"
              {...imageHandlers}
            >
              {p && page ? (
                <>
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                      {p.name}
                      <span className="px-1.5 text-border">/</span>
                      {page.slug}
                    </span>
                    <EButton
                      variant="ghost"
                      size="sm"
                      icon="sliders"
                      className="-mr-2 h-7 shrink-0 rounded-lg px-2 text-[11px] text-muted-foreground"
                      onClick={() => setPanel("Page settings")}
                    >
                      Page settings
                    </EButton>
                  </div>
                  <EInput
                    className="editor-title-input h-auto px-0 py-1 text-[2.05rem] font-semibold leading-[1.15] tracking-[-0.03em]"
                    aria-label="Page title"
                    value={page.title}
                    onChange={async (e) => {
                      const value = e.target.value;
                      const { updateMetadata } = await import("@/lib/mdx");
                      change({
                        ...p,
                        pages: p.pages.map((x) =>
                          x.id === page.id
                            ? {
                                ...x,
                                title: value,
                                source: updateMetadata(x.source, {
                                  title: value,
                                }),
                              }
                            : x,
                        ),
                      });
                    }}
                  />
                  <ETextarea
                    className="editor-description-input mt-3 min-h-10 resize-none px-0 py-0 text-[15px] leading-relaxed"
                    aria-label="Page description"
                    placeholder="Add a short description…"
                    rows={2}
                    value={page.description}
                    onChange={async (e) => {
                      const value = e.target.value;
                      const { updateMetadata } = await import("@/lib/mdx");
                      change({
                        ...p,
                        pages: p.pages.map((x) =>
                          x.id === page.id
                            ? {
                                ...x,
                                description: value,
                                source: updateMetadata(x.source, {
                                  description: value,
                                }),
                              }
                            : x,
                        ),
                      });
                    }}
                  />
                  <div className="mt-10">
                    <Suspense
                      fallback={
                        <div className="content-skeleton" role="status">
                          <span />
                          <span />
                          <span />
                        </div>
                      }
                    >
                      <Content
                        key={page.id + "Visual"}
                        source={page.source}
                        product={p}
                        notify={notify}
                        onChange={patchPage}
                        onImage={(node, offset) => {
                          imageInsertionOffset.current = offset ?? null;
                          setImageTarget(node || null);
                          setPendingFile(null);
                          setPanel("Media library");
                        }}
                      />
                    </Suspense>
                  </div>
                  <div className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon value="lock" className="size-3" />
                      Draft changes are private until you publish
                    </span>
                    <EButton
                      variant="ghost"
                      size="sm"
                      icon="clock-rotate-left"
                      onClick={() => setPanel("Page history")}
                    >
                      Version history
                    </EButton>
                  </div>
                </>
              ) : (
                emptyState
              )}
            </div>
          </TabsContent>
          <TabsContent
            value="Preview"
            className="m-0 min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div
              className="mx-auto w-full max-w-[800px] px-6 pb-24 pt-14 sm:px-10 sm:pt-16"
              {...imageHandlers}
            >
              {p && page ? (
                <>
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                      {p.name}
                      <span className="px-1.5 text-border">/</span>
                      {page.slug}
                    </span>
                    <EButton
                      variant="ghost"
                      size="sm"
                      icon="sliders"
                      className="-mr-2 h-7 shrink-0 rounded-lg px-2 text-[11px] text-muted-foreground"
                      onClick={() => setPanel("Page settings")}
                    >
                      Page settings
                    </EButton>
                  </div>
                  <h1 className="editor-preview-title font-semibold">
                    {emojiNodes(page.title)}
                  </h1>
                  <p className="editor-preview-description mt-3 text-muted-foreground">
                    {emojiNodes(page.description)}
                  </p>
                  <div className="mt-10">
                    <Suspense
                      fallback={
                        <div className="content-skeleton" role="status">
                          <span />
                          <span />
                          <span />
                        </div>
                      }
                    >
                      <Content
                        key={page.id + "Preview"}
                        source={page.source}
                        product={p}
                        notify={notify}
                        onImage={(node, offset) => {
                          imageInsertionOffset.current = offset ?? null;
                          setImageTarget(node || null);
                          setPendingFile(null);
                          setPanel("Media library");
                        }}
                      />
                    </Suspense>
                  </div>
                  <div className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon value="lock" className="size-3" />
                      Draft changes are private until you publish
                    </span>
                    <EButton
                      variant="ghost"
                      size="sm"
                      icon="clock-rotate-left"
                      onClick={() => setPanel("Page history")}
                    >
                      Version history
                    </EButton>
                  </div>
                </>
              ) : (
                emptyState
              )}
            </div>
          </TabsContent>
          <TabsContent
            value="Source"
            className="editor-source-shell m-0 flex min-h-0 flex-1 flex-col overflow-hidden"
            {...imageHandlers}
          >
            {p && page ? (
              <Suspense
                fallback={
                  <div className="source-editor-loading" role="status">
                    Loading source…
                  </div>
                }
              >
                <SourceEditor
                  target={
                    qualityIssue?.pageId === page.id && !qualityIssue.snippet
                      ? qualityIssue
                      : undefined
                  }
                  value={page.source}
                  onChange={patchPage}
                />
              </Suspense>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">{emptyState}</div>
            )}
          </TabsContent>
        </Tabs>
        </main>
      </div>
      {panel ? (
        <PanelDialog
          title={panel}
          description={panelDescriptions[panel]}
          variant={panelVariant}
          onFocusReturn={() => {
            if (!qualityHandoff.current) return false;
            qualityHandoff.current = false;
            document
              .querySelector<HTMLTextAreaElement>(
                ".editor-source-shell .source-editor textarea",
              )
              ?.focus();
            return true;
          }}
          wide={[
            "Navigation",
            "Publish changes",
            "Page history",
            "Media library",
            "Find and replace",
            "Publish changes",
            "Reader feedback",
            "Content freshness",
            "Versions",
          ].includes(panel)}
          onClose={() => {
            imageInsertionOffset.current = null;
            setImageTarget(null);
            setPendingFile(null);
            setPanel("");
          }}
        >
          {panel === "Create product" && (
            <div className="grid gap-5">
              <EField
                label="Product name"
                hint="A product groups its own pages, navigation and reader."
              >
                <EInput
                  autoFocus
                  value={newName}
                  placeholder="e.g. Pwned docs"
                  onChange={(e) => setNewName(e.target.value)}
                />
              </EField>
              <ENote>
                You can add pages, change the accent color and publish when
                you are ready.
              </ENote>
              <div className="flex justify-end gap-2">
                <EButton variant="ghost" onClick={() => setPanel("")}>
                  Cancel
                </EButton>
                <EButton
                  variant="default"
                  icon="plus"
                  disabled={!newName.trim()}
                  onClick={async () => {
                    if (!(await save())) return;
                    try {
                      const r = await api<ProductRecord>("/api/products", {
                        method: "POST",
                        body: JSON.stringify({ name: newName }),
                      });
                      saved.current.set(r.id, JSON.stringify(r.draft));
                      recordsRef.current = [...recordsRef.current, r];
                      setRecords(recordsRef.current);
                      selectedRef.current = r.id;
                      setSelected(r.id);
                      setPanel("");
                      setNewName("");
                      navigate("/editor/" + r.id);
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  Create product
                </EButton>
              </div>
            </div>
          )}
          <Suspense fallback={<p role="status">Loading tools...</p>}>
            {panel === "Workspace settings" && (
              <WorkspaceSettings
                workspace={data.workspace}
                revision={data.revision}
                onSave={onWorkspace}
                notify={notify}
              />
            )}
            {p && (
              <>
                {panel === "Reader settings" && (
                  <ReaderSettings product={p} change={change} />
                )}{" "}
                {panel === "Versions" && record && (
                  <VersionsPanel record={record} />
                )}{" "}
                {panel === "Reader feedback" && (
                  <FeedbackDashboard product={p} />
                )}{" "}
                {panel === "Content freshness" && (
                  <FreshnessPanel product={p} change={change} />
                )}{" "}
                {panel === "Homepage" && (
                  <HomeSettings product={p} change={change} notify={notify} />
                )}{" "}
                {panel === "Product settings" && (
                  <ProductSettings
                    product={p}
                    change={change}
                    notify={notify}
                    onDelete={() => setDeleteTarget("product")}
                  />
                )}{" "}
                {panel === "Navigation" && (
                  <NavigationSettings
                    product={p}
                    change={change}
                    notify={notify}
                  />
                )}{" "}
                {panel === "New page" && (
                  <NewPagePanel
                    product={p}
                    onCreate={(x) => {
                      change({ ...p, pages: [...p.pages, x] });
                      setPageId(x.id);
                      setMode("Visual");
                      setPanel("");
                    }}
                  />
                )}{" "}
                {panel === "Snippets" && (
                  <SnippetSettings
                    issue={qualityIssue}
                    product={p}
                    change={change}
                    notify={notify}
                  />
                )}{" "}
                {panel === "Find and replace" && (
                  <FindReplace
                    product={p}
                    change={change}
                    notify={notify}
                    pageId={pageId}
                  />
                )}{" "}
                {panel === "Media library" && (
                  <MediaPanel
                    initialFile={pendingFile}
                    product={p}
                    published={record?.published || null}
                    change={change}
                    notify={notify}
                    onInsert={async (s) => {
                      if (page) {
                        const source = imageTarget
                          ? replaceNode(page.source, imageTarget, s.trimEnd())
                          : (
                              await import("@/lib/authoring")
                            ).insertBlock(
                              page.source,
                              s,
                              imageInsertionOffset.current,
                            );
                        patchPage(source);
                      }
                      setImageTarget(null);
                      setPendingFile(null);
                      setPanel("");
                    }}
                  />
                )}{" "}
                {panel === "Publish changes" && record && (
                  <PublishReview
                    onOpenIssue={openQualityIssue}
                    record={record}
                    busy={publishBusy}
                    onPublish={async () => {
                      setPublishBusy(true);
                      try {
                        if (!(await save())) return;
                        const current = recordsRef.current.find(
                          (x) => x.id === p.id,
                        )!;
                        const result = await api<{
                          published: Product;
                          revision: number;
                        }>("/api/products/" + p.id + "/publish", {
                          method: "POST",
                          body: JSON.stringify({ revision: current.revision }),
                        });
                        setRecords(
                          recordsRef.current.map((x) =>
                            x.id === p.id
                              ? {
                                  ...x,
                                  published: result.published,
                                  revision: result.revision,
                                }
                              : x,
                          ),
                        );
                        setPanel("");
                        notify(p.name + " published successfully");
                      } catch (e) {
                        notify((e as Error).message);
                      } finally {
                        setPublishBusy(false);
                      }
                    }}
                  />
                )}{" "}
                {page && (
                  <>
                    {panel === "Page settings" && (
                      <PageSettings
                        key={page.id}
                        focusDescription={
                          qualityIssue?.pageId === page.id &&
                          qualityIssue.target === "settings"
                        }
                        page={page}
                        product={p}
                        change={change}
                        notify={notify}
                        onDelete={() => setDeleteTarget("page")}
                      />
                    )}{" "}
                    {panel === "Page history" && (
                      <HistoryPanel
                        product={p}
                        page={page}
                        change={change}
                        notify={notify}
                      />
                    )}{" "}
                    {panel === "Links and backlinks" && (
                      <LinkTools product={p} pageId={page.id} />
                    )}{" "}
                    {panel === "Page tools" && (
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          {[
                            ["Page settings", "sliders"],
                            ["Page history", "clock-rotate-left"],
                            ["Find and replace", "magnifying-glass"],
                            ["Links and backlinks", "link"],
                          ].map(([label, icon]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setPanel(label)}
                              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3 text-left text-sm transition-colors hover:bg-accent"
                            >
                              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                                <Icon value={icon} className="size-3.5" />
                              </span>
                              <span className="flex-1 font-medium">
                                {label}
                              </span>
                              <Icon
                                value="chevron-right"
                                className="size-3 text-muted-foreground"
                              />
                            </button>
                          ))}
                        </div>
                        <ESeparator />
                        <div className="grid gap-2">
                          <EButton
                            variant="outline"
                            icon="floppy-disk"
                            className="justify-start"
                            onClick={() => {
                              const name = prompt(
                                "Template name",
                                page.title,
                              );
                              if (name) {
                                change({
                                  ...p,
                                  templates: [
                                    ...p.templates.filter(
                                      (x) => x.name !== name,
                                    ),
                                    { name, source: page.source },
                                  ],
                                });
                                notify("Template saved");
                                setPanel("");
                              }
                            }}
                          >
                            Save as product template
                          </EButton>
                          <EButton
                            variant="outline"
                            icon="download"
                            className="justify-start"
                            onClick={() =>
                              download(page.slug + ".mdx", page.source)
                            }
                          >
                            Download MDX
                          </EButton>
                          <EButton
                            variant="outline"
                            icon="copy"
                            className="justify-start"
                            onClick={() => copyText(page.source, notify)}
                          >
                            Copy page
                          </EButton>
                        </div>
                        <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3.5">
                          <p className="text-xs font-semibold text-destructive">
                            Danger zone
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Removing the page from the draft hides it until you
                            publish the deletion.
                          </p>
                          <EButton
                            variant="outline"
                            icon="trash"
                            className="mt-3 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                            onClick={() => setDeleteTarget("page")}
                          >
                            Delete page
                          </EButton>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </Suspense>
        </PanelDialog>
      ) : null}
      {recover ? (
        <PanelDialog
          title="Recover your unsaved draft"
          description="A local copy on this device is newer than the saved draft."
          onClose={() => setRecover(null)}
          footer={
            <>
              <EButton
                variant="ghost"
                onClick={() => {
                  localStorage.removeItem("grave-recovery-" + recover.id);
                  setRecover(null);
                }}
              >
                Use saved draft
              </EButton>
              <EButton
                variant="outline"
                icon="download"
                onClick={() =>
                  download(
                    recover.slug + "-recovery.json",
                    JSON.stringify(recover, null, 2),
                  )
                }
              >
                Download backup
              </EButton>
              <EButton
                variant="default"
                onClick={() => {
                  change(recover);
                  setRecover(null);
                }}
              >
                Restore local draft
              </EButton>
            </>
          }
        >
          <div className="grid gap-3">
            <ENote tone="warning">
              A local draft for <strong>{recover.name}</strong> differs from the
              saved version. Restore it into the editor or download it before
              continuing.
            </ENote>
            <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              Browser drafts are stored on this device. Restoring replaces the
              current editor contents with the local copy.
            </div>
          </div>
        </PanelDialog>
      ) : null}
      <DeleteDialog
        key={"product-delete-" + (p?.id || "none")}
        open={deleteTarget === "product" && !!p}
        title={`Delete ${p?.name || "this product"}?`}
        description={
          <>
            This removes <strong>{p?.name || "the product"}</strong> and its
            documentation from the public reader. The published snapshot is
            deleted too. This cannot be undone.
          </>
        }
        confirmLabel="Delete product"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!p) return;
          if (!(await save()))
            throw new Error(
              "Save failed. Resolve the error before deleting this product.",
            );
          const current = recordsRef.current.find((x) => x.id === p.id);
          if (!current) throw new Error("This product is no longer available.");
          await api(
            "/api/products/" + p.id + "?revision=" + current.revision,
            { method: "DELETE" },
          );
          const next = recordsRef.current.filter((x) => x.id !== p.id);
          const nextId = next[0]?.id || "";
          setRecords(next);
          setSelected(nextId);
          navigate(nextId ? "/editor/" + nextId : "/editor");
          setPanel("");
          setDeleteTarget(null);
          localStorage.removeItem("grave-recovery-" + p.id);
          notify("Product deleted");
        }}
      >
        {p ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs leading-relaxed text-muted-foreground">
              Want a copy first? Export the product as JSON.
            </span>
            <EButton
              variant="outline"
              size="sm"
              icon="download"
              onClick={() =>
                exportProduct(p).catch((e) => notify(e.message))
              }
            >
              Export backup
            </EButton>
          </div>
        ) : null}
      </DeleteDialog>
      <DeleteDialog
        key={"page-delete-" + (page?.id || "none")}
        open={deleteTarget === "page" && !!p && !!page}
        title={`Delete ${page?.title || "this page"}?`}
        description="This removes the page from the draft. The published page stays available until you publish again."
        confirmLabel="Delete page"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!p || !page) return;
          change({ ...p, pages: p.pages.filter((x) => x.id !== page.id) });
          setPageId(p.pages.find((x) => x.id !== page.id)?.id || "");
          setPanel("");
          setDeleteTarget(null);
        }}
      />
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent
          side="left"
          className="flex w-64 flex-col gap-0 border-r border-border/80 p-0 dark:bg-[var(--surface)]"
        >
          <SheetHeader className="border-b border-border/70 px-4 py-3 text-left">
            <SheetTitle className="text-[13px] font-semibold">
              Navigation
            </SheetTitle>
            <SheetDescription className="sr-only">
              Editor navigation and workspace tools
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1">{sidebar}</div>
        </SheetContent>
      </Sheet>
      {search && p && (
        <Suspense fallback={<div role="status">Opening search…</div>}>
          <Search
            product={{
              ...p,
              pages: p.pages.map((x) => ({
                ...x,
                draft: false,
                hidden: false,
              })),
            }}
            onClose={() => setSearch(false)}
            onOpen={(x) => {
              choosePage(x);
              setSearch(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

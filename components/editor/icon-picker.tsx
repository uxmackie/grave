"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { IconValue } from "@/lib/model";
import { loadStyle, type CatalogIcon } from "../icon-catalog";
import { registerIcons } from "../icon-registry";
import { Icon, emojiNodes } from "../grave-ui";
import { cn } from "@/lib/utils";
import {
  Button,
  Field,
  IconButton,
  Input,
  PanelDialog,
} from "./ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const emojis = [
  ["🚀", "rocket launch"],
  ["💎", "gem jewel diamond"],
  ["📚", "books library"],
  ["📄", "page document"],
  ["✨", "sparkles"],
  ["🔧", "wrench tools"],
  ["⚡", "lightning bolt"],
  ["🌍", "earth globe"],
  ["🎨", "palette art"],
  ["💡", "light bulb idea"],
  ["📦", "package box"],
  ["🛠️", "tools hammer"],
  ["🎯", "target bullseye"],
  ["🔥", "fire"],
  ["✅", "check success"],
  ["⚠️", "warning"],
  ["❌", "cross error"],
  ["ℹ️", "information"],
  ["❤️", "heart"],
  ["🔒", "lock security"],
  ["🔑", "key"],
  ["⚙️", "gear settings"],
  ["📋", "clipboard"],
  ["🔍", "search magnify"],
  ["💬", "speech comment"],
  ["🧭", "compass navigation"],
  ["🏠", "home house"],
  ["📁", "folder"],
  ["📝", "memo pencil"],
  ["🧪", "test science"],
  ["💻", "laptop computer"],
  ["🌱", "seedling plant"],
  ["🎉", "party celebration"],
  ["🤝", "handshake"],
  ["🔗", "link"],
  ["📊", "chart"],
  ["🕒", "clock time"],
  ["🖼️", "image picture"],
];

const swatches = ["#0166ff", "#8b5cf6", "#16a34a", "#f59e0b", "#ef4444"];

function PickerTile({
  label,
  active,
  className,
  onClick,
  onShow,
  onHide,
  children,
}: {
  label: string;
  active?: boolean;
  className?: string;
  onClick: () => void;
  onShow: (target: HTMLElement, label: string) => void;
  onHide: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerEnter={(event) => onShow(event.currentTarget, label)}
      onPointerLeave={onHide}
      onFocus={(event) => onShow(event.currentTarget, label)}
      onBlur={onHide}
      className={cn(
        "grid aspect-square place-items-center rounded-md transition-colors hover:bg-accent",
        className,
        active && "bg-accent text-foreground ring-1 ring-ring",
      )}
    >
      {children}
    </button>
  );
}

export function IconPicker({
  value,
  onChange,
  compact = false,
}: {
  value: IconValue;
  onChange: (value: IconValue) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(value.style || "solid");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogIcon[]>([]);
  const [loading, setLoading] = useState(false);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const loadToken = useRef(0);
  const load = useCallback((style: string) => {
    const token = ++loadToken.current;
    loadStyle(style, (icons) => {
      if (token !== loadToken.current) return;
      registerIcons(icons);
      setCatalog((current) => [...current, ...icons]);
    })
      .catch(() => {})
      .finally(() => {
        if (token === loadToken.current) setLoading(false);
      });
  }, []);
  const showTip = (target: HTMLElement, label: string) => {
    const tip = tipRef.current;
    if (!tip) return;
    tip.textContent = label;
    const rect = target.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    const center = Math.min(
      Math.max(rect.left + rect.width / 2, half + 8),
      window.innerWidth - half - 8,
    );
    const above = rect.top > 36;
    tip.style.left = `${center}px`;
    tip.style.top = above ? `${rect.top - 6}px` : `${rect.bottom + 6}px`;
    tip.style.transform = above
      ? "translate(-50%, -100%)"
      : "translate(-50%, 0)";
    tip.style.opacity = "1";
  };
  const hideTip = () => {
    if (tipRef.current) tipRef.current.style.opacity = "0";
  };
  const closePicker = () => {
    loadToken.current++;
    setLoading(false);
    setOpen(false);
  };
  const openPicker = () => {
    setOpen(true);
    if (tab === "emoji") return;
    setCatalog([]);
    setLoading(true);
    load(tab);
  };
  const chooseTab = (next: string) => {
    setTab(next);
    hideTip();
    setCatalog([]);
    setLoading(next !== "emoji");
    if (next !== "emoji") load(next);
  };
  const choose = (next: IconValue) => {
    onChange(next);
    closePicker();
  };
  return (
    <>
      {compact ? (
        <IconButton
          icon={value.name ? value : "icons"}
          label={value.name || "Choose icon"}
          variant="outline"
          className="size-9 shrink-0"
          onClick={openPicker}
        />
      ) : (
        <Button
          icon={value.name ? value : "icons"}
          className="justify-start"
          onClick={openPicker}
        >
          <span className="truncate">{value.name || "Choose icon"}</span>
        </Button>
      )}
      {open ? (
        <PanelDialog
          title="Choose an icon"
          description="Search the built-in icon sets or pick an emoji."
          wide
          onClose={closePicker}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  onChange({ name: "" });
                  closePicker();
                }}
              >
                Remove icon
              </Button>
              <Button
                variant="outline"
                onClick={() => onChange({ ...value, color: undefined })}
              >
                Default color
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <Input
              autoFocus
              placeholder="Search icons or emojis…"
              aria-label="Search icons"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                hideTip();
              }}
            />
            <Tabs value={tab} onValueChange={chooseTab}>
              <TabsList className="grid w-full grid-cols-4">
                {["solid", "regular", "brands", "emoji"].map((name) => (
                  <TabsTrigger key={name} value={name} className="capitalize">
                    {name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {tab !== "emoji" && loading ? (
              <p className="text-xs text-muted-foreground" role="status">
                Loading icons…
              </p>
            ) : null}
            <div
              className="icon-picker-grid grid max-h-[340px] grid-cols-[repeat(auto-fill,minmax(42px,1fr))] gap-1.5 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2"
              onScroll={hideTip}
              onKeyDown={(event) => {
                const buttons = Array.from(
                  event.currentTarget.querySelectorAll("button"),
                );
                const index = buttons.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                const columns =
                  getComputedStyle(event.currentTarget).gridTemplateColumns.split(
                    " ",
                  ).length || 1;
                const delta =
                  event.key === "ArrowRight"
                    ? 1
                    : event.key === "ArrowLeft"
                      ? -1
                      : event.key === "ArrowDown"
                        ? columns
                        : event.key === "ArrowUp"
                          ? -columns
                          : 0;
                if (delta) {
                  event.preventDefault();
                  buttons[
                    (index + delta + buttons.length) % buttons.length
                  ]?.focus();
                }
              }}
            >
              {tab === "emoji"
                ? emojis
                    .filter(([name, keywords]) =>
                      (name + keywords).includes(query.toLowerCase()),
                    )
                    .map(([name, keywords]) => (
                      <PickerTile
                        key={name}
                        label={keywords}
                        active={value.name === name}
                        className="text-xl"
                        onShow={showTip}
                        onHide={hideTip}
                        onClick={() =>
                          choose({
                            name,
                            style: "emoji",
                            color: value.color,
                          })
                        }
                      >
                        {emojiNodes(name)}
                      </PickerTile>
                    ))
                : catalog
                    .filter(
                      (entry) =>
                        entry.style === tab &&
                        entry.icon.iconName.includes(query.toLowerCase()),
                    )
                    .map(({ icon }) => (
                      <PickerTile
                        key={icon.iconName}
                        label={icon.iconName}
                        active={
                          value.name === icon.iconName && value.style === tab
                        }
                        className="text-muted-foreground hover:text-foreground"
                        onShow={showTip}
                        onHide={hideTip}
                        onClick={() =>
                          choose({
                            name: icon.iconName,
                            style: tab,
                            color: value.color,
                          })
                        }
                      >
                        <Icon
                          className="icon-picker-icon"
                          value={{
                            name: icon.iconName,
                            style: tab,
                            color: value.color,
                          }}
                        />
                      </PickerTile>
                    ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Icon color" className="w-28">
                <Input
                  type="color"
                  className="h-10 p-1"
                  value={value.color || "#0166ff"}
                  onChange={(event) =>
                    onChange({ ...value, color: event.target.value })
                  }
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2 pb-0.5">
                {swatches.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="size-7 rounded-full ring-offset-2 ring-offset-background transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ background: color }}
                    aria-label={color}
                    onClick={() => onChange({ ...value, color })}
                  />
                ))}
              </div>
            </div>
          </div>
        </PanelDialog>
      ) : null}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tipRef}
              data-slot="icon-picker-tooltip"
              aria-hidden="true"
              className="pointer-events-none fixed z-[60] whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background opacity-0 shadow-md transition-opacity duration-75"
            />,
            document.body,
          )
        : null}
    </>
  );
}

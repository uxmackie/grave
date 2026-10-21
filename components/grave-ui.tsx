"use client";
import React, { useEffect, useState } from "react";
import {
  lookupIcon,
  fallbackIcon,
  loadIcons,
  subscribeIcons,
  iconRevision,
  iconServerRevision,
} from "./icon-registry";
import { Button as BaseButton } from "@/components/ui/button";
import type { IconValue } from "@/lib/model";
import { splitEmoji } from "@/lib/twemoji";
export function emojiNodes(
  text: string | null | undefined,
  className = "twemoji",
): React.ReactNode {
  if (!text) return text ?? null;
  const parts = splitEmoji(text);
  if (parts.length === 1 && parts[0].type === "text") return text;
  return parts.map((part, i) =>
    part.type === "emoji" ? (
      <img
        key={i}
        className={className}
        src={part.url}
        alt={part.text}
        title={part.text}
        draggable={false}
        loading="lazy"
        decoding="async"
      />
    ) : (
      part.text
    ),
  );
}
export function Icon({
  value,
  className = "",
}: {
  value?: IconValue | string;
  className?: string;
}) {
  const v = typeof value === "string" ? { name: value } : value;
  React.useSyncExternalStore(subscribeIcons, iconRevision, iconServerRevision);
  const resolved = v ? lookupIcon(v.style || "solid", v.name) : undefined;
  useEffect(() => {
    if (v?.name && v.style !== "emoji" && !resolved)
      void loadIcons(v.style || "solid", v.name).catch(() => {});
  }, [v?.name, v?.style, resolved]);
  if (!v?.name) return null;
  if (v.style === "emoji")
    return (
      <span
        className={"icon emoji " + className}
        style={{ color: v.color }}
        aria-hidden
      >
        {emojiNodes(v.name)}
      </span>
    );
  const d = resolved || fallbackIcon;
  return (
    <svg
      aria-hidden
      className={"icon " + className}
      style={{ color: v.color }}
      viewBox={`0 0 ${d.icon[0]} ${d.icon[1]}`}
      fill="currentColor"
    >
      {(Array.isArray(d.icon[4]) ? d.icon[4] : [d.icon[4]]).map((path, i) => (
        <path key={i} d={path} />
      ))}
    </svg>
  );
}
export function Button({
  icon,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string }) {
  return (
    <BaseButton
      type="button"
      variant="outline"
      className={"button " + className}
      {...props}
    >
      {icon && <Icon value={icon} />} {children}
    </BaseButton>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
const LazyIconPicker = React.lazy(() => import("./icon-picker"));
export function IconPicker(props: {
  value: IconValue;
  onChange: (value: IconValue) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  return enabled ? (
    <React.Suspense fallback={<Button disabled>Loading icons...</Button>}>
      <LazyIconPicker {...props} />
    </React.Suspense>
  ) : (
    <Button onClick={() => setEnabled(true)}>
      <Icon value={props.value} />
      Choose icon
    </Button>
  );
}
export async function copyText(text: string, notify: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    notify("Copied to clipboard");
  } catch {
    notify("Copy failed. Select the text and copy it manually.");
  }
}
export function download(name: string, data: string | Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    data instanceof Blob
      ? data
      : new Blob([data], { type: "text/plain;charset=utf-8" }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function ThemeControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (x: string) => void;
}) {
  return (
    <select
      className="theme-control"
      aria-label="Color theme"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System</option>
    </select>
  );
}

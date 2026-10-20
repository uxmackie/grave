"use client";
import { useState } from "react";
import { Button, Icon, Modal, Field, emojiNodes } from "./grave-ui";
import type { IconValue } from "@/lib/model";
import { allIcons } from "./icon-catalog";
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
export default function IconPicker({
  value,
  onChange,
}: {
  value: IconValue;
  onChange: (v: IconValue) => void;
}) {
  const [open, setOpen] = useState(true),
    [tab, setTab] = useState(value.style || "solid"),
    [q, setQ] = useState("");
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icon value={value} />
        {value.name || "Choose icon"}
      </Button>
      {open && (
        <Modal title="Choose an icon" onClose={() => setOpen(false)}>
          <input
            autoFocus
            placeholder="Search icons or emojis…"
            aria-label="Search icons"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="segmented">
            {["solid", "regular", "brands", "emoji"].map((t) => (
              <Button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </Button>
            ))}
          </div>
          <div
            className="icon-grid"
            onKeyDown={(e) => {
              const els = Array.from(
                e.currentTarget.querySelectorAll("button"),
              );
              const i = els.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const d =
                e.key === "ArrowRight"
                  ? 1
                  : e.key === "ArrowLeft"
                    ? -1
                    : e.key === "ArrowDown"
                      ? 8
                      : e.key === "ArrowUp"
                        ? -8
                        : 0;
              if (d) {
                e.preventDefault();
                els[(i + d + els.length) % els.length]?.focus();
              }
            }}
          >
            {tab === "emoji"
              ? emojis
                  .filter(([name, keywords]) =>
                    (name + keywords).includes(q.toLowerCase()),
                  )
                  .map(([name, keywords]) => (
                    <Button
                      key={name}
                      aria-label={keywords}
                      title={keywords}
                      className={value.name === name ? "active" : ""}
                      onClick={() => {
                        onChange({ name, style: "emoji", color: value.color });
                        setOpen(false);
                      }}
                    >
                      {emojiNodes(name)}
                    </Button>
                  ))
              : allIcons
                  .filter(
                    (x) =>
                      x.style === tab &&
                      x.icon.iconName.includes(q.toLowerCase()),
                  )
                  .map(({ icon }) => (
                    <Button
                      key={icon.iconName}
                      aria-label={icon.iconName}
                      title={icon.iconName}
                      className={
                        value.name === icon.iconName && value.style === tab
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        onChange({
                          name: icon.iconName,
                          style: tab,
                          color: value.color,
                        });
                        setOpen(false);
                      }}
                    >
                      <Icon
                        value={{
                          name: icon.iconName,
                          style: tab,
                          color: value.color,
                        }}
                      />
                    </Button>
                  ))}
          </div>
          <Field label="Icon color">
            <input
              type="color"
              value={value.color || "#0166ff"}
              onChange={(e) => onChange({ ...value, color: e.target.value })}
            />
          </Field>
          <div className="row">
            {["#0166ff", "#8b5cf6", "#16a34a", "#f59e0b", "#ef4444"].map(
              (color) => (
                <button
                  key={color}
                  className="swatch"
                  aria-label={color}
                  style={{ background: color }}
                  onClick={() => onChange({ ...value, color })}
                />
              ),
            )}
            <Button onClick={() => onChange({ ...value, color: undefined })}>
              Default color
            </Button>
            <Button
              onClick={() => {
                onChange({ name: "" });
                setOpen(false);
              }}
            >
              Remove icon
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

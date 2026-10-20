"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Button as UIButton } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { IconValue } from "@/lib/model";
import { Icon } from "../grave-ui";
import { evilButtonClass } from "./button-styles";

type ButtonProps = React.ComponentProps<typeof UIButton> & {
  icon?: IconValue | string;
};

/** Editor button: shadcn's Button, with the app's Font Awesome icon slot. */
export function Button({
  icon,
  children,
  variant = "outline",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <UIButton
      type={type}
      variant={variant}
      className={cn(evilButtonClass(variant), className)}
      {...props}
    >
      {icon ? <Icon value={icon} /> : null}
      {children}
    </UIButton>
  );
}

export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "icon-sm",
  className,
  ...props
}: Omit<ButtonProps, "children" | "icon"> & {
  icon: IconValue | string;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <UIButton
          type="button"
          variant={variant}
          size={size}
          aria-label={label}
          className={cn(evilButtonClass(variant), className)}
          {...props}
        >
          <Icon value={icon} />
        </UIButton>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="text-[11px]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-[12px] font-medium text-foreground">{label}</span>
      {children}
      {hint ? (
        <span className="text-[11px] leading-relaxed text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  className,
  disabled,
}: {
  label: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: React.ReactNode; disabled?: boolean }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-full" aria-label={String(label)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  compact = false,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-4",
        compact
          ? "py-1.5"
          : "rounded-lg border border-border/80 bg-transparent px-3 py-2.5",
        disabled && "opacity-60",
      )}
    >
      <span className="grid gap-0.5">
        <span className="text-[12.5px] font-medium leading-relaxed text-foreground">
          {label}
        </span>
        {description ? (
          <span className="text-[11.5px] leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={typeof label === "string" ? label : undefined}
      />
    </label>
  );
}

export function PanelDialog({
  title,
  description,
  wide = false,
  variant = "modal",
  onClose,
  onFocusReturn,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  wide?: boolean;
  variant?: "modal" | "inspector";
  onClose: () => void;
  onFocusReturn?: () => boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const previous = React.useRef<HTMLElement | null>(
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement),
  );
  const inspector = variant === "inspector";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-variant={variant}
        overlayClassName={inspector ? "bg-transparent" : undefined}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          inspector
            ? "fixed top-14 right-0 bottom-0 left-auto z-50 w-[380px] max-w-[calc(100vw-1rem)] translate-x-0 translate-y-0 rounded-none border-y-0 border-r-0 border-l border-border/70 bg-background shadow-none data-[state=closed]:slide-out-to-right data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-right data-[state=open]:zoom-in-100 dark:bg-[var(--surface)] sm:max-w-[380px]"
            : "max-h-[min(88dvh,920px)] rounded-xl border-border/80 bg-background shadow-xl data-[state=open]:zoom-in-95 dark:bg-[var(--surface)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_24px_80px_rgb(0_0_0/0.55)] sm:max-w-lg",
          wide && !inspector && "sm:max-w-4xl",
        )}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!onFocusReturn?.()) previous.current?.focus();
        }}
      >
        <DialogHeader
          className={cn(
            "flex shrink-0 flex-row items-start justify-between gap-4 border-b border-border/70 text-left",
            inspector ? "px-4 py-4" : "px-5 py-4",
          )}
        >
          <div className="grid min-w-0 gap-1">
            <DialogTitle className="text-[15px] font-semibold tracking-[-0.01em]">
              {title}
            </DialogTitle>
            {description ? (
              <DialogDescription className="text-[12px] leading-relaxed">
                {description}
              </DialogDescription>
            ) : null}
          </div>
          <UIButton
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("-mr-1 -mt-1 shrink-0", evilButtonClass("ghost"))}
            aria-label="Close dialog"
            onClick={onClose}
          >
            <XIcon />
          </UIButton>
        </DialogHeader>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            inspector ? "px-4 py-4" : "px-5 py-5",
          )}
        >
          {children}
        </div>
        {footer ? (
          <div
            className={cn(
              "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/70",
              inspector ? "px-4 py-3" : "px-5 py-3",
            )}
          >
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function PanelSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-3", className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3">
          {title ? (
            <div className="grid gap-0.5">
              <h3 className="text-[13px] font-semibold tracking-[-0.005em] text-foreground">
                {title}
              </h3>
              {description ? (
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          ) : null}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Note({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "danger" | "success" | "warning";
}) {
  const tones = {
    muted: "border-border bg-muted/40 text-muted-foreground",
    danger: "border-destructive/30 bg-destructive/5 text-destructive",
    success:
      "border-emerald-600/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
    warning:
      "border-amber-600/25 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  } as const;
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed",
        tones[tone],
      )}
    >
      {children}
    </div>
  );
}

export function KeyValue({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/70 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-[13px] text-foreground">
        {children}
      </span>
    </div>
  );
}

export {
  Input,
  Textarea,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Separator,
};

"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AshBurstButton } from "../evil-buttons/ash-burst-button";
import { Button, Note } from "./ui";

/**
 * Destructive confirmation for products and pages. The ash burst plays
 * before the action runs so the button visibly burns away rather than the
 * dialog unmounting mid-burst.
 */
export function DeleteDialog({
  open,
  title,
  description,
  confirmLabel,
  busyLabel = "Deleting…",
  onCancel,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (busy) return;
        setError("");
        onCancel();
      }}
    >
      <AlertDialogContent className="gap-5 rounded-xl border-border/80 bg-background dark:bg-[var(--surface)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_24px_80px_rgb(0_0_0/0.55)] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children ? <div className="grid gap-3">{children}</div> : null}
        {error ? <Note tone="danger">{error}</Note> : null}
        <AlertDialogFooter className="mt-1 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={busy}
            className="h-8 px-3 text-[13px] sm:mr-auto"
          >
            Cancel
          </Button>
          <AshBurstButton
            disabled={busy}
            className="h-8 px-3 text-[13px]"
            onClick={() => {
              if (busy) return;
              setBusy(true);
              setError("");
              window.setTimeout(async () => {
                try {
                  await onConfirm();
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "The item could not be deleted.",
                  );
                  setBusy(false);
                }
              }, 620);
            }}
          >
            {busy ? busyLabel : confirmLabel}
          </AshBurstButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

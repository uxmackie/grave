"use client";
import { useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "./grave-ui";

/** Reader dialog shell. Kept in its own module so the Radix dialog bundle is
 *  only fetched when someone opens search, products or the markdown view. */
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  onFocusReturn,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  onFocusReturn?: () => boolean;
}) {
  const previous = useRef<HTMLElement | null>(
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        customLayout
        showCloseButton={false}
        className={
          "modal " +
          (wide ? "wide " : "") +
          (title.toLowerCase().includes("navigation") && title !== "Navigation"
            ? "navigation-drawer"
            : "")
        }
        aria-describedby={undefined}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (!onFocusReturn?.()) previous.current?.focus();
        }}
      >
        <header>
          <DialogTitle>{title}</DialogTitle>
          <Button icon="xmark" aria-label="Close dialog" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

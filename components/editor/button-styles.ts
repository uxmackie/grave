/**
 * Shared surface language for editor actions. It borrows Evil Buttons'
 * physical feel: a graded face, a fine inner highlight, a dark outer hairline
 * and a short spring on press. Everything stays inside the monochrome chrome.
 */
export type EvilButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

const interaction =
  "inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium outline-none select-none " +
  "transition-[scale,filter,box-shadow,background-color,color] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] " +
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "active:scale-[0.97] active:duration-100 active:ease-out motion-reduce:active:scale-100 " +
  "disabled:pointer-events-none disabled:opacity-50";

const raised =
  "border-0 bg-transparent bg-linear-to-b from-[#363636] to-[#272727] text-neutral-50 " +
  "shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)] " +
  "hover:bg-transparent hover:text-neutral-50 hover:brightness-110 " +
  "active:brightness-95 active:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)]";

const raisedStrong =
  "border-0 bg-transparent bg-linear-to-b from-[#4b4b4b] to-[#252525] font-semibold text-white " +
  "shadow-[0_0_0_1px_rgb(0_0_0/0.92),inset_0_0_0_1px_rgb(255_255_255/0.08),inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(0_0_0/0.28),0_5px_16px_-4px_rgb(0_0_0/0.5)] " +
  "hover:bg-transparent hover:text-white hover:brightness-110 " +
  "active:brightness-95 active:shadow-[0_0_0_1px_rgb(0_0_0/0.92),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.09),0_0_1px_rgb(0_0_0/0.24),0_1px_4px_-2px_rgb(0_0_0/0.4)]";

const quiet =
  "cursor-pointer touch-manipulation rounded-[10px] transition-[scale,background-color,color] duration-200 ease-out " +
  "active:scale-[0.96] motion-reduce:active:scale-100";

// Secondary actions sit on the same paper as the editor. They keep the fine
// inner highlight and hairline of the Evil Buttons face, but read as a
// surface rather than a primary, pressed action.
const paper =
  "border border-border bg-card text-foreground " +
  "shadow-[inset_0_1px_0_rgb(255_255_255/0.42),0_1px_2px_rgb(0_0_0/0.04)] " +
  "hover:bg-muted/55 hover:text-foreground " +
  "active:shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_1px_rgb(0_0_0/0.03)]";

export function evilButtonClass(variant?: EvilButtonVariant | null) {
  if (variant === "ghost") return quiet;
  if (variant === "link") return "cursor-pointer";
  if (variant === "default") return interaction + " " + raisedStrong;
  if (variant === "destructive")
    return interaction + " " + raised + " text-red-100";
  if (variant === "secondary") return interaction + " " + paper;
  return interaction + " " + paper;
}

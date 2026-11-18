import type { ReactNode } from "react";
import type { ToolColour } from "../tools/types";

/** "brand" is the royal-purple shell bar; the others are the pastel tool colours. */
export type BarColour = ToolColour | "brand";

interface RetroTitleBarProps {
  title: string;
  colour: BarColour;
  /** Left of the title: a Home button, an icon. */
  leading?: ReactNode;
  /** Right of the title: the square window buttons. */
  controls?: ReactNode;
  /** True for the real app window: the bar then drags the OS window (Tauri reads the attribute). */
  dragRegion?: boolean;
}

/** The coloured bar on top of a window: leading item, mono title, square controls. */
export function RetroTitleBar({
  title,
  colour,
  leading,
  controls,
  dragRegion = false,
}: RetroTitleBarProps) {
  // WHY: Tauri only drags when the pressed element itself carries the attribute, not its
  // children, so the bar and the title both get it. Buttons inside stay clickable.
  const dragProps = dragRegion ? { "data-tauri-drag-region": "" } : {};
  return (
    <header className="retro-titlebar" data-colour={colour} {...dragProps}>
      {leading}
      <span className="retro-titlebar__title" {...dragProps}>
        {title}
      </span>
      <div className="retro-titlebar__controls">{controls}</div>
    </header>
  );
}

interface RetroWindowProps {
  titleBar: ReactNode;
  footer?: ReactNode;
  /** A floating window (a dialog) gets a hard shadow and rounded corners; the app shell does not. */
  floating?: boolean;
  children: ReactNode;
}

export function RetroWindow({ titleBar, footer, floating = false, children }: RetroWindowProps) {
  return (
    <section className={floating ? "retro-window retro-window--floating" : "retro-window"}>
      {titleBar}
      <div className="retro-window__body">{children}</div>
      {footer}
    </section>
  );
}

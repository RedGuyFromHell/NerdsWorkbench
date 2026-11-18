import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "danger";
  /** "large" is for the one main action of a tool (GENERATE!, Export print PNG). */
  size?: "normal" | "large";
}

export function Button({
  variant = "default",
  size = "normal",
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  const classes = ["retro-button", `retro-button--${variant}`, `retro-button--${size}`];
  if (className) classes.push(className);
  return <button type={type} className={classes.join(" ")} {...rest} />;
}

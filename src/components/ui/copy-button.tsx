"use client";

import { useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

export function CopyButton({
  text,
  label = "コピー",
  copiedLabel = "コピーしました",
  size = "xs",
  variant = "secondary",
  className,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button size={size} variant={variant} leftIcon={copied ? "check" : "copy"} onClick={copy} className={className}>
      {copied ? copiedLabel : label}
    </Button>
  );
}

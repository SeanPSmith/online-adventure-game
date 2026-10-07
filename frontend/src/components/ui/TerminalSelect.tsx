import { useEffect, useRef, useState } from "react";

export interface TerminalSelectOption {
  value: string;
  label: string;
}

interface TerminalSelectProps {
  value: string;
  options: TerminalSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}

export function TerminalSelect({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  className = "",
}: TerminalSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className={`terminal-select ${open ? "is-open" : ""} ${className}`.trim()} ref={rootRef}>
      <button
        className="terminal-select-trigger"
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if ((event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{selected?.label ?? "—"}</span>
        <b aria-hidden="true">⌄</b>
      </button>

      {open ? (
        <div className="terminal-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? "is-selected" : ""}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value ? <b aria-hidden="true">◀</b> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

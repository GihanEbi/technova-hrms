"use client";

// Reusable form controls: field wrapper, date/range/time pickers, searchable select,
// currency input and file upload. All of them follow the same tokens as the base inputs.
import * as React from "react";
import { format, parseISO } from "date-fns";
import type { DateRange, Matcher } from "react-day-picker";
import { CalendarDays, Check, ChevronsUpDown, Paperclip, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label, Input } from "@/components/ui/primitives";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";

// ---------------- Field ----------------
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const triggerCls =
  "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-surface px-3 text-left text-sm shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive dark:bg-subtle";

// ---------------- Date picker ----------------
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Select a date",
  disabled,
  disabledDays,
  invalid,
  startMonth,
  endMonth,
  ariaLabel,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  disabledDays?: Matcher | Matcher[];
  invalid?: boolean;
  startMonth?: Date;
  endMonth?: Date;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" id={id} disabled={disabled} aria-invalid={invalid || undefined} aria-label={ariaLabel} className={triggerCls}>
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className={cn("flex-1 truncate tabular", !selected && "text-muted-foreground")}>
            {selected ? format(selected, "EEE, d MMM yyyy") : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout={startMonth ? "dropdown" : "label"}
          startMonth={startMonth}
          endMonth={endMonth}
          disabled={disabledDays}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// ---------------- Date range picker ----------------
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  className,
  align = "start",
}: {
  value: { from: string; to: string } | null;
  onChange: (value: { from: string; to: string } | null) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const range: DateRange | undefined = value ? { from: parseISO(value.from), to: parseISO(value.to) } : undefined;
  const [draft, setDraft] = React.useState<DateRange | undefined>(range);
  React.useEffect(() => {
    if (open) setDraft(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Date range" className={cn(triggerCls, "sm:w-auto sm:min-w-60", className)}>
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className={cn("flex-1 truncate tabular", !range && "text-muted-foreground")}>
            {range?.from && range.to ? `${format(range.from, "d MMM yyyy")} – ${format(range.to, "d MMM yyyy")}` : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align={align}>
        <Calendar mode="range" selected={draft} onSelect={setDraft} numberOfMonths={1} defaultMonth={range?.from} />
        <div className="flex items-center justify-end gap-2 border-t border-border px-1 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button
            size="sm"
            disabled={!draft?.from}
            onClick={() => {
              if (draft?.from) {
                onChange({ from: format(draft.from, "yyyy-MM-dd"), to: format(draft.to ?? draft.from, "yyyy-MM-dd") });
                setOpen(false);
              }
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------- Time input ----------------
export function TimeInput(props: Omit<React.ComponentProps<"input">, "type">) {
  return <Input type="time" step={300} className="tabular [&::-webkit-calendar-picker-indicator]:opacity-60 dark:[color-scheme:dark]" {...props} />;
}

// ---------------- Searchable select ----------------
export interface Option {
  value: string;
  label: string;
  description?: string;
}
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  invalid,
  allowClear,
  ariaLabel,
  disabled,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  invalid?: boolean;
  allowClear?: boolean;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" id={id} role="combobox" aria-expanded={open} aria-invalid={invalid || undefined} aria-label={ariaLabel} disabled={disabled} className={triggerCls}>
          <span className={cn("flex-1 truncate", !current && "text-muted-foreground")}>{current?.label ?? placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground">None</span>
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.description ?? ""} ${o.value}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{o.label}</span>
                    {o.description && <span className="truncate text-xs text-muted-foreground">{o.description}</span>}
                  </div>
                  {o.value === value && <Check className="!text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------- Currency input ----------------
const fmtMoney = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? "" : v.toLocaleString("en-US", { maximumFractionDigits: 2 }));
/** Focusing never rewrites the text, so select-all + type always replaces the value. Formatting is re-applied on blur. */
export function CurrencyInput({
  id,
  value,
  onChange,
  currency = "LKR",
  invalid,
  ...rest
}: {
  id?: string;
  value: number | null | undefined;
  onChange: (value: number) => void;
  currency?: string;
  invalid?: boolean;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "type">) {
  const [text, setText] = React.useState(fmtMoney(value));
  const focused = React.useRef(false);
  React.useEffect(() => {
    if (!focused.current) setText(fmtMoney(value));
  }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs font-medium text-muted-foreground">{currency}</span>
      <Input
        {...rest}
        id={id}
        inputMode="decimal"
        aria-invalid={invalid || undefined}
        className="pl-12 text-right tabular"
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(fmtMoney(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const raw = e.target.value.replace(/[^0-9.]/g, "");
          onChange(raw === "" ? 0 : Number(raw));
        }}
      />
    </div>
  );
}

// ---------------- File upload ----------------
export function FileUpload({
  id,
  accept,
  onFile,
  fileName,
  onClear,
  hint = "PNG, JPG or PDF up to 2 MB",
  maxSizeMb = 2,
  label = "Upload a file",
}: {
  id?: string;
  accept?: string;
  onFile: (file: File) => void;
  fileName?: string | null;
  onClear?: () => void;
  hint?: string;
  maxSizeMb?: number;
  label?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState(false);
  const handle = (file?: File) => {
    if (!file) return;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File is larger than ${maxSizeMb} MB.`);
      return;
    }
    setError(null);
    onFile(file);
  };
  if (fileName) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-subtle px-3 py-2 text-sm">
        <Paperclip className="size-4 text-muted-foreground" />
        <span className="flex-1 truncate">{fileName}</span>
        {onClear && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Remove file">
            <X />
          </Button>
        )}
      </div>
    );
  }
  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-input px-4 py-5 text-center transition-colors hover:bg-subtle",
          drag && "border-primary bg-primary-soft",
        )}
      >
        <Upload className="size-5 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">Drag and drop or click to browse · {hint}</span>
      </label>
      <input ref={inputRef} id={id} type="file" accept={accept} className="sr-only" onChange={(e) => handle(e.target.files?.[0] ?? undefined)} />
      {error && <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

/** Read an image file and downscale it to a small square data URL for localStorage. */
export function readImageAsDataUrl(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, size / Math.min(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Unsupported image"));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

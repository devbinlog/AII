"use client";

import type { EditableParameter } from "@/types/domain";

// ============================================================
// Types
// ============================================================

interface ParameterEditorProps {
  param: EditableParameter;
  value: unknown;
  onChange: (paramId: string, value: unknown) => void;
  onReset: (paramId: string) => void;
}

// ============================================================
// Validation helpers
// ============================================================

function validateAndCoerce(param: EditableParameter, raw: unknown): unknown {
  switch (param.type) {
    case "color": {
      if (typeof raw === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(raw)) {
        return raw;
      }
      return param.defaultValue;
    }
    case "number": {
      const n = typeof raw === "string" ? parseFloat(raw) : Number(raw);
      if (isNaN(n)) return param.defaultValue;
      const min = param.min ?? -Infinity;
      const max = param.max ?? Infinity;
      return Math.min(max, Math.max(min, n));
    }
    case "text": {
      if (typeof raw === "string") return raw.slice(0, 100);
      return param.defaultValue;
    }
    case "select": {
      if (typeof raw === "string" && param.options?.includes(raw)) return raw;
      return param.defaultValue;
    }
  }
}

// ============================================================
// ParameterEditor
// ============================================================

export function ParameterEditor({
  param,
  value,
  onChange,
  onReset,
}: ParameterEditorProps) {
  function handleChange(raw: unknown) {
    const coerced = validateAndCoerce(param, raw);
    onChange(param.id, coerced);
  }

  const isDefault =
    JSON.stringify(value) === JSON.stringify(param.defaultValue);

  return (
    <div
      className="flex flex-col gap-2 pb-4"
      style={{
        borderBottom: "1px solid var(--color-neutral-800)",
      }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between">
        <label
          className="text-sm font-semibold"
          style={{ color: "var(--color-neutral-100)" }}
        >
          {param.label}
        </label>
        <button
          onClick={() => onReset(param.id)}
          disabled={isDefault}
          aria-label={`Reset ${param.label}`}
          className="text-xs font-mono px-2 py-0.5 rounded transition-opacity disabled:opacity-30"
          style={{
            color: "var(--color-neutral-400)",
            border: "1px solid var(--color-neutral-700)",
            cursor: isDefault ? "default" : "pointer",
          }}
        >
          Reset
        </button>
      </div>

      {/* Control by type */}
      {param.type === "color" && (
        <ColorInput
          value={typeof value === "string" ? value : String(param.defaultValue)}
          onChange={handleChange}
        />
      )}

      {param.type === "number" && (
        <NumberInput
          value={typeof value === "number" ? value : Number(param.defaultValue)}
          {...(param.min !== undefined ? { min: param.min } : {})}
          {...(param.max !== undefined ? { max: param.max } : {})}
          onChange={handleChange}
        />
      )}

      {param.type === "text" && (
        <TextInput
          value={typeof value === "string" ? value : String(param.defaultValue)}
          onChange={handleChange}
        />
      )}

      {param.type === "select" && (
        <SelectInput
          value={typeof value === "string" ? value : String(param.defaultValue)}
          options={param.options ?? []}
          onChange={handleChange}
        />
      )}

      {/* Meta info */}
      <p
        className="text-xs font-mono"
        style={{ color: "var(--color-neutral-500)" }}
      >
        {param.id} · {param.property}
      </p>
    </div>
  );
}

// ============================================================
// Sub-inputs
// ============================================================

function inputBaseStyle(): React.CSSProperties {
  return {
    backgroundColor: "var(--color-neutral-900)",
    color: "var(--color-neutral-50)",
    border: "1px solid var(--color-neutral-700)",
    outline: "none",
  };
}

// ── Color ─────────────────────────────────────────────────────

interface ColorInputProps {
  value: string;
  onChange: (v: unknown) => void;
}

function ColorInput({ value, onChange }: ColorInputProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded cursor-pointer border-0 p-0"
        style={{
          backgroundColor: "transparent",
        }}
      />
      <input
        type="text"
        value={value}
        maxLength={9}
        onChange={(e) => {
          const raw = e.target.value.trim();
          // Allow typing in progress — only commit valid hex
          if (/^#[0-9A-Fa-f]{0,8}$/.test(raw)) {
            if (/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{8}$/.test(raw)) {
              onChange(raw);
            } else {
              // Pass as-is but don't validate yet — user may still be typing
              // We won't call onChange with invalid value; just let the input be uncontrolled visually
            }
          }
        }}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (/^#[0-9A-Fa-f]{6}$/.test(raw) || /^#[0-9A-Fa-f]{3}$/.test(raw)) {
            onChange(raw);
          } else {
            // Revert to last valid value by not calling onChange
          }
        }}
        className="flex-1 px-2 py-1.5 rounded text-sm font-mono"
        style={inputBaseStyle()}
        placeholder="#e8192c"
      />
    </div>
  );
}

// ── Number ────────────────────────────────────────────────────

interface NumberInputProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: unknown) => void;
}

function NumberInput({ value, min = 0, max = 1, onChange }: NumberInputProps) {
  const step = max - min <= 1 ? 0.01 : 1;

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 cursor-pointer"
        style={{ accentColor: "var(--color-accent)" }}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        className="w-20 px-2 py-1.5 rounded text-sm font-mono text-right"
        style={inputBaseStyle()}
      />
    </div>
  );
}

// ── Text ──────────────────────────────────────────────────────

interface TextInputProps {
  value: string;
  onChange: (v: unknown) => void;
}

function TextInput({ value, onChange }: TextInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        value={value}
        maxLength={100}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded text-sm"
        style={inputBaseStyle()}
        placeholder="Enter text..."
      />
      <span
        className="text-xs font-mono text-right"
        style={{ color: "var(--color-neutral-500)" }}
      >
        {value.length}/100
      </span>
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────

interface SelectInputProps {
  value: string;
  options: string[];
  onChange: (v: unknown) => void;
}

function SelectInput({ value, options, onChange }: SelectInputProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 rounded text-sm cursor-pointer"
      style={inputBaseStyle()}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

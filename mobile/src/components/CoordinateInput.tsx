import { useRef, useState } from "react";
import { parseCoordinateInput, toggleCoordinateSign } from "../lib/coordinateInput";

interface Props {
  axis: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  onFocus: (input: HTMLInputElement) => void;
}

export function CoordinateInput({ axis, label, value, onChange, onFocus }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ text: value === null ? "" : String(value), value });
  // External loads/resets must supersede a draft, even while the field is focused.
  const text = Object.is(draft.value, value) ? draft.text : value === null ? "" : String(value);
  const incomplete = text !== "" && parseCoordinateInput(text) === null;
  const update = (next: string) => {
    const parsed = parseCoordinateInput(next);
    setDraft({ text: next, value: parsed });
    onChange(parsed);
  };

  return (
    <div className="coordinate-axis-field">
      <label>
        <span>{axis}</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          aria-invalid={incomplete}
          title={incomplete ? "Enter a complete number; this value is not saved yet." : label}
          value={text}
          onFocus={(event) => onFocus(event.currentTarget)}
          onChange={(event) => update(event.target.value)}
          onBlur={() => {
            // Incomplete text is never exported or synced as the previous value.
            // On leaving the field it becomes an explicit empty coordinate.
            setDraft({ text: value === null ? "" : String(value), value });
          }}
        />
      </label>
      <button
        type="button"
        className="coordinate-sign-button"
        aria-label={`Toggle sign for ${label}`}
        title="Switch positive / negative"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          update(toggleCoordinateSign(text));
          inputRef.current?.focus();
        }}
      >±</button>
      {incomplete && <small className="coordinate-input-error" role="status">Incomplete number</small>}
    </div>
  );
}

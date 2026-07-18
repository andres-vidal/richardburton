"use client";

import { FC } from "react";
import Button from "./Button";
import TextInput from "./TextInput";

/** A small icon control for a row action (reorder / remove). */
const RowButton: FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: string;
}> = ({ label, onClick, disabled, children }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    className="shrink-0 px-2 py-1 text-gray-600 rounded transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:pointer-events-none"
  >
    {children}
  </button>
);

/**
 * Editor for a publication's ordered, free-text provenance list. The value is
 * the whole list — add/remove/reorder produce a new array through `onChange`, so
 * there is no per-row local state (the reorder is a plain array swap, not a
 * drag-measured layout).
 */
const ReferencesEditor: FC<{
  value: string[];
  onChange: (references: string[]) => void;
  label?: string;
}> = ({ value, onChange, label = "References" }) => {
  const setAt = (index: number, content: string) =>
    onChange(value.map((entry, i) => (i === index ? content : entry)));

  const removeAt = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  const add = () => onChange([...value, ""]);

  const move = (index: number, delta: number) => {
    const target = index + delta;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-xs text-gray-500">
          Sources that back this record, so a reader can verify it.
        </span>
      </div>

      {value.length === 0 ? (
        <p className="text-sm italic text-gray-500">No references yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {value.map((content, index) => (
            // Index keys: rows have no identity of their own — the value is the
            // list, and a reorder is a content swap on stable positions.
            <li key={index} className="flex gap-1 items-center">
              <TextInput
                bordered
                fill
                value={content}
                onChange={(next) => setAt(index, next)}
                aria-label={`Reference ${index + 1}`}
                placeholder="A citation, URL, or note"
              />
              <RowButton
                label={`Move reference ${index + 1} up`}
                onClick={() => move(index, -1)}
                disabled={index === 0}
              >
                ↑
              </RowButton>
              <RowButton
                label={`Move reference ${index + 1} down`}
                onClick={() => move(index, 1)}
                disabled={index === value.length - 1}
              >
                ↓
              </RowButton>
              <RowButton
                label={`Remove reference ${index + 1}`}
                onClick={() => removeAt(index)}
              >
                ✕
              </RowButton>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button
          label="Add reference"
          variant="outline"
          width="fit"
          size="small"
          onClick={add}
        />
      </div>
    </section>
  );
};

export default ReferencesEditor;

"use client";

import {
  Publication,
  type PublicationId,
  type PublicationKey,
  type PublicationKeyType,
} from "modules/publication/model";
import { validate } from "modules/publication/remote";
import { overrideField } from "modules/publication/store";
import { FC, FocusEvent, HTMLProps, Ref, forwardRef } from "react";
import TextArrayDataInput from "./TextArrayDataInput";
import TextDataInput from "./TextDataInput";
import TextEnumArrayDataInput from "./TextEnumArrayDataInput";
import TextEnumDataInput from "./TextEnumDataInput";
import TextNumberDataInput from "./TextNumberDataInput";
import Tooltip from "./Tooltip";

const COMPONENTS_PER_TYPE: Record<PublicationKeyType, FC<Props>> = {
  text: TextDataInput,
  enum: TextEnumDataInput,
  enumArray: TextEnumArrayDataInput,
  number: TextNumberDataInput,
  array: TextArrayDataInput,
};

/**
 * Types whose change is a discrete commit — a chip added, an option picked —
 * rather than a keystroke. They validate immediately, because the user has
 * finished saying what they mean and may never blur the field: a combobox
 * keeps focus after a selection, so waiting for blur leaves the row looking
 * valid until some *other* field is touched.
 *
 * Typed fields (`text`, `number`) wait for blur instead, since `validate` is a
 * server call and validating per keystroke would mean a request per character.
 */
const VALIDATES_ON_CHANGE: PublicationKeyType[] = [
  "array",
  "enum",
  "enumArray",
];

type Props = Omit<HTMLProps<HTMLInputElement>, "onChange" | "ref"> & {
  ref?: Ref<HTMLElement>;
  rowId: PublicationId;
  colId: PublicationKey;
  value: string;
  error: string;
  onChange?: (value: string) => void;
  autoValidated?: boolean;
  /** What to run when `autoValidated` fires. Defaults to the bulk validate; the
   * edit form passes the id-aware one. */
  onValidate?: () => void;
  fill?: boolean;
  bordered?: boolean;
  /**
   * How a field's error reaches the reader. The workspace table has no room
   * for a message under a cell — it would reflow the grid — so there the
   * tinted cell is the signal and the tooltip carries the detail. A form has
   * the room, and an error nobody hovers is an error nobody reads.
   */
  errorDisplay?: "tooltip" | "inline";
};

const DataInput = forwardRef<HTMLElement, Props>(function DataInput(
  { onValidate, errorDisplay, ...props },
  ref,
) {
  const {
    rowId,
    colId,
    value: data,
    error,
    autoValidated,
    onBlur,
    onChange,
  } = props;

  const type = Publication.ATTRIBUTE_TYPES[props.colId];
  const Component = COMPONENTS_PER_TYPE[type];
  const placeholder = Publication.ATTRIBUTE_LABELS[colId];

  const validateRow = onValidate ?? (() => validate([rowId]));

  function doValidate() {
    if (autoValidated) validateRow();
  }

  function handleChange(value: string) {
    overrideField(rowId, colId, value);
    if (VALIDATES_ON_CHANGE.includes(type)) {
      doValidate();
    }
    onChange?.(value);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    doValidate();
    onBlur?.(event);
  }

  const field = (
    <Component
      {...props}
      {...Publication.define(colId)}
      ref={ref}
      value={data}
      onBlur={handleBlur}
      onChange={handleChange}
      placeholder={placeholder}
      error={error}
      fill
      bordered
    />
  );

  return errorDisplay === "inline" ? (
    <div className="flex flex-col gap-1">
      {field}
      <p role="alert" className="min-h-4 text-xs text-red-700">
        {error}
      </p>
    </div>
  ) : (
    <Tooltip variant="error" message={props.error}>
      {field}
    </Tooltip>
  );
});

export type { Props as DataInputProps };
export default DataInput;

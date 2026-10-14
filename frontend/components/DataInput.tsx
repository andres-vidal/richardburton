"use client";

import {
  Publication,
  type PublicationId,
  type PublicationKey,
  type PublicationValue,
} from "modules/publication/model";
import { usePublicationStore } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { setField } from "modules/publication/store";
import { useReportPosition } from "modules/publication/presence";
import { FC, FocusEvent, HTMLProps, Ref } from "react";
import OriginalBookDataInput from "./OriginalBookDataInput";
import TextArrayDataInput from "./TextArrayDataInput";
import TextEnumArrayDataInput from "./TextEnumArrayDataInput";
import TextInput from "./TextInput";
import TextNumberDataInput from "./TextNumberDataInput";
import Tooltip from "./Tooltip";

/** The props of the input element that a field draws. */
type InputProps = Omit<
  HTMLProps<HTMLInputElement>,
  "onChange" | "ref" | "value"
>;

type Props = InputProps & {
  rowId: PublicationId;
  colId: PublicationKey;
  value: PublicationValue;
  error: string;
  onChange?: (value: PublicationValue) => void;
  /**
   * Where the field's error is written. `"tooltip"`, the default, tints the
   * field and puts the message in a tooltip, which takes no room around the
   * field. `"inline"` writes the message under the field, in a slot two lines
   * tall that is always reserved, so that the field does not move when a
   * message appears. A longer message is cut at two lines on screen, and is
   * read in full by assistive technology.
   */
  errorDisplay?: "tooltip" | "inline";
};

/**
 * What the component for one attribute receives: the props of the input it
 * draws, and the attribute's value in the shape the attribute holds. `fill`
 * stretches the field to its parent's height, and `bordered` outlines it.
 * `ref` receives the field's outer element, which a tooltip anchors to.
 */
type FieldProps<V extends PublicationValue> = InputProps & {
  ref?: Ref<HTMLDivElement>;
  value: V;
  error: string;
  onChange?: (value: V) => void;
  fill?: boolean;
  bordered?: boolean;
};

/**
 * The field that edits the attribute `colId` of the row `rowId`, chosen by the
 * attribute's type. A change is written to the row in the enclosing store and
 * then passed to `onChange`. Focus in the field reports the cell as the
 * person's position in the document, and leaving the field reports that the
 * person is in no cell.
 */
const DataInput: FC<Props> = ({
  rowId,
  colId,
  value,
  error,
  errorDisplay,
  onFocus,
  onBlur,
  onChange,
  ...props
}) => {
  const t = useTranslations("attributes");
  const type = Publication.ATTRIBUTE_TYPES[colId];

  const store = usePublicationStore();
  const report = useReportPosition();

  function handleChange(value: PublicationValue) {
    setField(store, rowId, colId, value);
    onChange?.(value);
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    report({ row: String(rowId), field: colId });
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    report(null);
    onBlur?.(event);
  }

  const shared = {
    ...props,
    ...Publication.define(colId),
    error,
    placeholder: t(colId),
    onFocus: handleFocus,
    onBlur: handleBlur,
    onChange: handleChange,
    fill: true,
    bordered: true,
  };

  // The attribute's type decides whether its value is one string or several,
  // so each branch reads `value` in the shape that its type holds.
  const field =
    type === "array" ? (
      <TextArrayDataInput
        {...shared}
        value={value as string[]}
        lookup={colId === "publishers" ? "publishers" : "authors"}
      />
    ) : type === "enumArray" ? (
      <TextEnumArrayDataInput {...shared} value={value as string[]} />
    ) : type === "book" ? (
      <OriginalBookDataInput
        {...shared}
        value={value as string}
        rowId={rowId}
      />
    ) : type === "number" ? (
      <TextNumberDataInput {...shared} value={value as string} />
    ) : (
      <TextInput {...shared} value={value as string} />
    );

  return errorDisplay === "inline" ? (
    <div className="flex flex-col gap-1">
      {field}
      <p role="alert" className="min-h-8 text-xs text-red-700 line-clamp-2">
        {error}
      </p>
    </div>
  ) : (
    <Tooltip variant="error" message={error}>
      {field}
    </Tooltip>
  );
};

export type { FieldProps as DataInputFieldProps };
export default DataInput;

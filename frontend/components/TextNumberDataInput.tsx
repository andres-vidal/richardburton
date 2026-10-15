"use client";

import { parseInt, toString } from "lodash";
import { FC } from "react";
import { DataInputFieldProps } from "./DataInput";
import NumberInput from "./NumberInput";

/**
 * A field for an attribute that holds a whole number as a string. It shows the
 * value as a number and passes each edit to `onChange` as a string.
 */
const TextNumberDataInput: FC<DataInputFieldProps<string>> = ({
  value,
  onChange,
  ...props
}) => (
  <NumberInput
    {...props}
    value={value ? parseInt(value) : undefined}
    onChange={(next) => onChange?.(toString(next))}
  />
);

export default TextNumberDataInput;

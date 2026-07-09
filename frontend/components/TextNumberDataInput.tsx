"use client";

import { parseInt, toString } from "lodash";
import { FC, forwardRef } from "react";
import { DataInputProps } from "./DataInput";
import NumberInput from "./NumberInput";

export default forwardRef<HTMLInputElement, DataInputProps>(
  function TextNumberDataInput({ value, onChange, ...props }, ref) {
    function handleChange(value: number) {
      onChange?.(toString(value));
    }

    return (
      <NumberInput
        {...props}
        ref={ref}
        value={value ? parseInt(value) : undefined}
        onChange={handleChange}
      />
    );
  },
) as FC<DataInputProps>;

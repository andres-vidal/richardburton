"use client";

import { FC, forwardRef } from "react";
import { ScalarDataInputProps } from "./DataInput";
import TextInput from "./TextInput";

export default forwardRef<HTMLInputElement, ScalarDataInputProps>(
  function TextDataInput(
    { rowId: _rowId, colId: _colId, autoValidated: _autoValidated, ...props },
    ref,
  ) {
    return <TextInput {...props} ref={ref} />;
  },
) as FC<ScalarDataInputProps>;

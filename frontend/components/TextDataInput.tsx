"use client";

import { FC, forwardRef } from "react";
import { DataInputProps } from "./DataInput";
import TextInput from "./TextInput";

export default forwardRef<HTMLInputElement, DataInputProps>(
  function TextDataInput(
    { rowId: _rowId, colId: _colId, autoValidated: _autoValidated, ...props },
    ref,
  ) {
    return <TextInput {...props} ref={ref} />;
  },
) as FC<DataInputProps>;

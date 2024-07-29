import { FC, forwardRef } from "react";
import { PublicationInputProps } from "./PublicationInput";
import TextInput from "./TextInput";

export default forwardRef<HTMLInputElement, PublicationInputProps>(
  function TextDataInput(props, ref) {
    return <TextInput {...props} ref={ref} />;
  },
) as FC<PublicationInputProps>;

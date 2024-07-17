import { parseInt, toString } from "lodash";
import { FC, forwardRef } from "react";
import { PublicationInputProps } from "./PublicationInput";
import NumberInput from "./NumberInput";

export default forwardRef<HTMLInputElement, PublicationInputProps>(
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
) as FC<PublicationInputProps>;

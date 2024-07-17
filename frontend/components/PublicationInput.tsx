import {
  Publication,
  PublicationId,
  PublicationKey,
  PublicationKeyType,
} from "modules/publication";
import { FC, HTMLProps, Ref, forwardRef } from "react";
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

type Props = Omit<HTMLProps<HTMLInputElement>, "onChange" | "ref"> & {
  ref: Ref<HTMLElement>;
  publicationId: PublicationId;
  attribute: PublicationKey;
  value: string;
  error: string;
  onChange?: (value: string) => void;
  autoValidated?: boolean;
};

const PublicationInput = forwardRef<HTMLElement, Props>(
  function DataInput(props, ref) {
    const { attribute, value, error, onBlur, onChange } = props;

    const type = Publication.ATTRIBUTE_TYPES[attribute];
    const Component = COMPONENTS_PER_TYPE[type];
    const placeholder = Publication.ATTRIBUTE_LABELS[attribute];

    return (
      <Tooltip error message={props.error}>
        <Component
          {...props}
          {...Publication.define(attribute)}
          ref={ref}
          value={value}
          onBlur={onBlur}
          onChange={onChange}
          placeholder={placeholder}
          error={error}
        />
      </Tooltip>
    );
  },
);

export type { Props as PublicationInputProps };
export default PublicationInput;

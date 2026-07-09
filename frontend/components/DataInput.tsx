import {
  Publication,
  PublicationId,
  PublicationKey,
  PublicationKeyType,
  overrideField,
  validate,
} from "modules/publication";
import {
  FC,
  FocusEvent,
  HTMLProps,
  Ref,
  forwardRef,
  useEffect,
  useState,
} from "react";
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
  ref?: Ref<HTMLElement>;
  rowId: PublicationId;
  colId: PublicationKey;
  value: string;
  error: string;
  onChange?: (value: string) => void;
  autoValidated?: boolean;
  fill?: boolean;
};

const DataInput = forwardRef<HTMLElement, Props>(
  function DataInput(props, ref) {
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

    const [value, setValue] = useState(data);

    function doValidate() {
      if (autoValidated) {
        validate([rowId]);
      }
    }

    function handleChange(value: string) {
      setValue(value);
      overrideField(rowId, colId, value);
      if (type == "array" || type == "enum") {
        doValidate();
      }
      onChange?.(value);
    }

    function handleBlur(event: FocusEvent<HTMLInputElement>) {
      doValidate();
      onBlur?.(event);
    }

    useEffect(() => {
      if (data !== value) {
        setValue(data);
      }
    }, [data, rowId, colId, value, setValue]);

    return (
      <Tooltip variant="error" message={props.error}>
        <Component
          {...props}
          {...Publication.define(colId)}
          ref={ref}
          value={value}
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder={placeholder}
          error={error}
          fill
        />
      </Tooltip>
    );
  },
);

export type { Props as DataInputProps };
export default DataInput;

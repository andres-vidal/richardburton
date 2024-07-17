import {
  Publication,
  PublicationId,
  PublicationKey,
} from "modules/publication";
import {
  FocusEvent,
  HTMLProps,
  Ref,
  forwardRef,
  useEffect,
  useState,
} from "react";
import PublicationInput from "./PublicationInput";

type Props = Omit<HTMLProps<HTMLInputElement>, "onChange" | "ref"> & {
  ref: Ref<HTMLElement>;
  rowId: PublicationId;
  colId: PublicationKey;
  value: string;
  error: string;
  onChange?: (value: string) => void;
  autoValidated?: boolean;
};

const TablePublicationInput = forwardRef<HTMLElement, Props>(
  function (props, ref) {
    const {
      rowId,
      colId,
      value: data,
      error,
      onBlur,
      autoValidated,
      onChange,
    } = props;

    const type = Publication.ATTRIBUTE_TYPES[colId];
    const validate = Publication.REMOTE.useValidate();
    const override = Publication.STORE.ATTRIBUTES.useOverride();
    const [value, setValue] = useState(data);

    function doValidate() {
      if (autoValidated) {
        validate([rowId]);
      }
    }

    function handleChange(value: string) {
      setValue(value);
      override(rowId, colId, value);
      onChange?.(value);
      if (type == "array" || type == "enum") {
        doValidate();
      }
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
      <PublicationInput
        {...props}
        {...Publication.define(colId)}
        ref={ref}
        value={value}
        attribute={colId}
        publicationId={rowId}
        onChange={handleChange}
        onBlur={handleBlur}
        error={error}
        autoValidated={autoValidated}
      />
    );
  },
);

export default TablePublicationInput;

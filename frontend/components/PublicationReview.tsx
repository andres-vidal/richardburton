import { Key } from "app";
import AddCircleIcon from "assets/add-circle.svg";
import ErrorIcon from "assets/error.svg";
import {
  Column,
  ColumnHeader,
  Content,
  PublicationIndexTable,
  Row,
  RowId,
  RowProps,
  SignalColumn,
} from "components/PublicationIndexTable";
import { isElement } from "lodash";
import { Publication } from "modules/publication";
import {
  FC,
  KeyboardEventHandler,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  useIsSelected,
  useIsSelectionEmpty,
  useSelectionEvent,
} from "react-selection-manager";
import TablePublicationInput from "./TablePublicationInput";
import Tooltip from "./Tooltip";

const ExtendedColumn: typeof Column = (props) => {
  const { useIsValid, useIsFocused } = Publication.STORE;
  const { rowId } = props;

  const isSelected = useIsSelected(rowId);
  const isValid = useIsValid(rowId);
  const isFocused = useIsFocused(rowId);

  return (
    <Column
      {...props}
      invalid={!isValid}
      focused={isFocused}
      selected={isSelected}
      selectable={true}
    />
  );
};

const ExtendedColumnHeader: typeof ColumnHeader = (props) => {
  return <ColumnHeader {...props} toggleable={false} />;
};

const ExtendedSignalColumn: FC<{ rowId: RowId }> = ({ rowId }) => {
  const { useIsValid, useIsFocused } = Publication.STORE;
  const isValid = useIsValid(rowId);
  const isFocused = useIsFocused(rowId);

  const isSelected = useIsSelected(rowId);
  const [isIdVisible] = Publication.STORE.ATTRIBUTES.useAreRowIdsVisible();

  return (
    <SignalColumn
      rowId={rowId}
      focused={isFocused}
      invalid={!isValid}
      selected={isSelected}
      selectable
    >
      <span
        className="flex items-center text-xs text-gray-400 error:text-red-500"
        data-error={!isValid}
      >
        {!isValid && <ErrorIcon className="w-5 aspect-square" />}
        {isIdVisible && rowId + 1}
      </span>
    </SignalColumn>
  );
};

const ExtendedContent: typeof Content = ({ rowId, colId, value, error }) => {
  return (
    <TablePublicationInput
      rowId={rowId}
      colId={colId}
      value={value}
      error={error}
      autoValidated
    />
  );
};

const ExtendedRow: FC<RowProps> = (props) => {
  const { rowId } = props;
  const { useErrorDescription, useIsFocused } = Publication.STORE;

  const error = useErrorDescription(rowId);
  const focused = useIsFocused(rowId);

  const ref = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focused]);

  return (
    <Tooltip
      error
      message={error}
      placement="top-start"
      boundary="main"
      portalRoot="main"
      absoluteCenter
    >
      <Row {...props} ref={ref} />
    </Tooltip>
  );
};

const useSubmit = () => {
  const register = Publication.STORE.useAddNew();
  const validate = Publication.REMOTE.useValidate();

  return useCallback(() => {
    const id = register();
    validate([id]);
  }, [register, validate]);
};

const SubmittableData: typeof Content = ({ rowId, colId, value, error }) => {
  const submit = useSubmit();

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      if (
        event.key === Key.ENTER &&
        isElement(event.target) &&
        !(event.target as HTMLInputElement).matches(
          '[data-multiselect-input="true"]',
        )
      ) {
        submit();
      }
    },
    [submit],
  );

  return (
    <TablePublicationInput
      rowId={rowId}
      colId={colId}
      value={value}
      error={error}
      onKeyDown={handleKeyDown}
    />
  );
};

const NewPublicationSignalColumn: FC<{ rowId: RowId }> = ({ rowId }) => {
  const submit = useSubmit();
  return (
    <SignalColumn rowId={rowId}>
      <button
        className="flex text-indigo-600 rounded-full w-fit h-fit hover:text-indigo-700"
        onClick={submit}
      >
        <AddCircleIcon className="w-5 aspect-square" />
      </button>
    </SignalColumn>
  );
};

const NewPublicationRow: FC = () => {
  return (
    <Row
      rowId={Publication.NEW_ROW_ID}
      Column={Column}
      Content={SubmittableData}
      SignalColumn={NewPublicationSignalColumn}
    />
  );
};

const PublicationReview: FC = () => {
  const ids = Publication.STORE.useVisibleIds();
  const onSelect = useSelectionEvent();
  const isSelectionEmpty = useIsSelectionEmpty();

  const toggleSelection = (id: number) => (event: MouseEvent) =>
    onSelect({
      id,
      type: "publication",
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      orderedIds: ids,
    });

  return (
    <PublicationIndexTable
      ExtendedRow={ExtendedRow}
      ExtendedColumn={ExtendedColumn}
      ExtendedColumnHeader={ExtendedColumnHeader}
      ExtendedContent={ExtendedContent}
      ExtendedSignalColumn={ExtendedSignalColumn}
      ExtraRow={NewPublicationRow}
      onRowClick={toggleSelection}
      selectable={isSelectionEmpty}
    />
  );
};

export default PublicationReview;

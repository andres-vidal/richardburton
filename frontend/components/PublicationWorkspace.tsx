"use client";

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
import ClearSelection from "listeners/ClearSelection";
import { isElement } from "lodash";
import {
  useAreRowIdsVisible,
  useIsPublicationFocused,
  useIsPublicationValid,
  usePublicationErrorDescription,
  usePublicationField,
  usePublicationFieldError,
  useVisiblePublicationIds,
} from "modules/publication/hooks";
import { validate } from "modules/publication/remote";
import { usePublicationStore } from "modules/publication/workspace";
import { DRAFT_ID, addNew } from "modules/publication/store";
import {
  isSelectionGesture,
  select,
  useIsSelected,
  useIsSelectionEmpty,
} from "modules/selection";
import {
  FC,
  KeyboardEventHandler,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
} from "react";
import DataInput from "./DataInput";
import Tooltip from "./Tooltip";
import WorkspaceReferencesCell from "./WorkspaceReferencesCell";

const ExtendedColumn: typeof Column = (props) => {
  const { rowId } = props;

  const isSelected = useIsSelected(rowId);
  const isValid = useIsPublicationValid(rowId);
  const isFocused = useIsPublicationFocused(rowId);

  return (
    <Column
      {...props}
      invalid={!isValid}
      focused={isFocused}
      selected={isSelected}
    />
  );
};

// Feeds the trailing references cell the same row state the attribute cells get,
// so it shares the row's hover / error / selected background.
const ExtendedTrailingColumn: FC<{ rowId: RowId }> = ({ rowId }) => {
  const isSelected = useIsSelected(rowId);
  const isValid = useIsPublicationValid(rowId);
  const isFocused = useIsPublicationFocused(rowId);

  return (
    <WorkspaceReferencesCell
      rowId={rowId}
      invalid={!isValid}
      focused={isFocused}
      selected={isSelected}
    />
  );
};

const ExtendedColumnHeader: typeof ColumnHeader = (props) => {
  return <ColumnHeader {...props} toggleable={false} />;
};

const ExtendedSignalColumn: FC<{ rowId: RowId }> = ({ rowId }) => {
  const isValid = useIsPublicationValid(rowId);
  const isFocused = useIsPublicationFocused(rowId);

  const isSelected = useIsSelected(rowId);
  const [isIdVisible] = useAreRowIdsVisible();

  return (
    <SignalColumn
      rowId={rowId}
      focused={isFocused}
      invalid={!isValid}
      selected={isSelected}
      selectsRow
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

const ExtendedContent: typeof Content = ({ rowId, colId }) => {
  const value = usePublicationField(rowId, colId);
  const error = usePublicationFieldError(rowId, colId);

  return (
    <DataInput
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

  const error = usePublicationErrorDescription(rowId);
  const focused = useIsPublicationFocused(rowId);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focused]);

  return (
    <Tooltip
      variant="error"
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
  const store = usePublicationStore();

  return useCallback(() => {
    const id = addNew(store);
    validate(store, [id]);
  }, [store]);
};

const SubmittableData: typeof Content = ({ rowId, colId }) => {
  const submit = useSubmit();
  const value = usePublicationField(rowId, colId);
  const error = usePublicationFieldError(rowId, colId);

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
    <DataInput
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
        type="button"
        aria-label="Add publication"
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
      rowId={DRAFT_ID}
      Column={Column}
      Content={SubmittableData}
      SignalColumn={NewPublicationSignalColumn}
      TrailingColumn={WorkspaceReferencesCell}
      collapsible={false}
    />
  );
};

const PublicationWorkspace: FC = () => {
  const store = usePublicationStore();
  const ids = useVisiblePublicationIds();
  const isSelectionEmpty = useIsSelectionEmpty();

  // Only a click on the row's handle selects it. The row hears every click in
  // it, including the ones that land in a field — those belong to the field, and
  // selecting on them would fight the person typing.
  const toggleSelection = (id: number) => (event: MouseEvent) => {
    if (!isSelectionGesture(event.target)) return;

    select(store, {
      id,
      type: "publication",
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      orderedIds: ids,
    });
  };

  return (
    <>
      <ClearSelection store={store} />
      <PublicationIndexTable
        ExtendedRow={ExtendedRow}
        ExtendedColumn={ExtendedColumn}
        ExtendedColumnHeader={ExtendedColumnHeader}
        ExtendedContent={ExtendedContent}
        ExtendedSignalColumn={ExtendedSignalColumn}
        ExtendedTrailingColumn={ExtendedTrailingColumn}
        ExtraRow={NewPublicationRow}
        onRowClick={toggleSelection}
        selectable={isSelectionEmpty}
        collapsible={false}
      />
    </>
  );
};

export default PublicationWorkspace;

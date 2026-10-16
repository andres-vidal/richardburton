"use client";

import { Key } from "app";
import AddCircleIcon from "assets/add-circle.svg";
import ErrorIcon from "assets/error.svg";
import {
  Column,
  Content,
  PublicationIndexTable,
  Row,
  RowId,
  RowProps,
  SignalColumn,
  TrailingColumn,
} from "components/PublicationIndexTable";
import ClearSelection from "listeners/ClearSelection";
import WarningIcon from "assets/warning.svg";
import {
  useAreRowIdsVisible,
  useIsPublicationFocused,
  useIsPublicationValid,
  usePublicationErrorDescription,
  usePublicationResemblance,
  usePublicationRowNumber,
  usePublicationField,
  usePublicationFieldError,
  useReviewing,
} from "modules/publication/hooks";
import { colourOf, useOnThisCell } from "modules/publication/presence";
import { usePublicationStore } from "modules/publication/workspace";
import {
  DRAFT_ID,
  addNew,
  closeReview,
  publicationIdsAtom,
} from "modules/publication/store";
import type { PublicationId } from "modules/publication/model";
import {
  isSelectionGesture,
  select,
  useIsSelected,
  useIsSelectionEmpty,
} from "modules/selection";
import {
  FC,
  KeyboardEvent,
  MouseEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useTranslations } from "next-intl";
import DataInput from "./DataInput";
import Tooltip from "./Tooltip";
import PublicationResemblances from "./PublicationResemblances";
import WorkspaceNotesCell from "./WorkspaceNotesCell";
import WorkspaceSourcesCell from "./WorkspaceSourcesCell";

/**
 * A cell of a saved row. It reads the row's state, so the cell takes the row's
 * selected, invalid and focused background, and marks another person who has
 * the cell focused.
 */
const ExtendedColumn: typeof Column = (props) => {
  const { rowId, colId } = props;

  const isSelected = useIsSelected(rowId);
  const isValid = useIsPublicationValid(rowId);
  const isFocused = useIsPublicationFocused(rowId);

  // The email of another person who has this cell focused, if anyone does.
  const email = useOnThisCell(String(rowId), colId);

  return (
    <Column
      {...props}
      invalid={!isValid}
      focused={isFocused}
      selected={isSelected}
      focusedBy={email ? { email, colour: colourOf(email) } : null}
    />
  );
};

/**
 * Returns a cell of a saved row that renders `Cell` with the row's selected,
 * invalid and focused state, so it shares the row's background.
 */
const withRowState = (
  Cell: typeof WorkspaceSourcesCell | typeof WorkspaceNotesCell,
): FC<{ rowId: RowId }> =>
  function RowStateCell({ rowId }) {
    const isSelected = useIsSelected(rowId);
    const isValid = useIsPublicationValid(rowId);
    const isFocused = useIsPublicationFocused(rowId);

    return (
      <Cell
        rowId={rowId}
        invalid={!isValid}
        focused={isFocused}
        selected={isSelected}
      />
    );
  };

/**
 * The cells at the end of a saved row: its notes, then its sources with the
 * look-alike button, so that button ends the row.
 */
const TRAILING_COLUMNS: TrailingColumn[] = [
  { name: "notes", Cell: withRowState(WorkspaceNotesCell) },
  { name: "sources", Cell: withRowState(WorkspaceSourcesCell) },
];

/** The cells at the end of the draft row, which has no row state to show. */
const DRAFT_TRAILING_COLUMNS: TrailingColumn[] = [
  { name: "notes", Cell: WorkspaceNotesCell },
  { name: "sources", Cell: WorkspaceSourcesCell },
];

/**
 * The leading cell of a saved row, which is its selection handle. It shows an
 * error icon when the row is invalid, a warning icon when it resembles
 * something, and the row's number while row numbers are shown.
 */
const ExtendedSignalColumn: FC<{ rowId: RowId }> = ({ rowId }) => {
  const t = useTranslations("resemblances");
  const isValid = useIsPublicationValid(rowId);
  const isFocused = useIsPublicationFocused(rowId);
  const resemblance = usePublicationResemblance(rowId);
  const rowNumber = usePublicationRowNumber(rowId);

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
        {isValid && resemblance && (
          <WarningIcon
            role="img"
            aria-label={t("rowLooksLike")}
            className="w-5 text-amber-500 aspect-square"
          />
        )}
        {isIdVisible && rowNumber}
      </span>
    </SignalColumn>
  );
};

/** The field that edits one attribute of a row, with the field's error. */
const ExtendedContent: typeof Content = ({ rowId, colId }) => {
  const value = usePublicationField(rowId, colId);
  const error = usePublicationFieldError(rowId, colId);

  return <DataInput rowId={rowId} colId={colId} value={value} error={error} />;
};

/**
 * A saved row, with the row's error in a tooltip over it. The row scrolls
 * into view when it becomes the focused row.
 *
 * The tooltip gives the row new event handlers each time it renders, so the
 * component is memoised: it renders only when its own props or the row's error
 * or focus change, and not each time the table does.
 */
const ExtendedRow = memo(function ExtendedRow(props: RowProps) {
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
      absoluteCenter
    >
      <Row {...props} ref={ref} />
    </Tooltip>
  );
});

/** Returns a function that adds the draft row to the workspace. */
const useSubmit = () => {
  const store = usePublicationStore();

  return useCallback(() => {
    addNew(store);
  }, [store]);
};

/**
 * A field of the draft row. Enter in it adds the row, unless the field used the
 * key itself, as a combobox does to pick an option, and marked it with
 * `preventDefault`.
 */
const SubmittableData: typeof Content = ({ rowId, colId }) => {
  const submit = useSubmit();
  const value = usePublicationField(rowId, colId);
  const error = usePublicationFieldError(rowId, colId);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === Key.ENTER && !event.defaultPrevented) submit();
  }

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

/** The leading cell of the draft row: a button that adds the row. */
const NewPublicationSignalColumn: FC<{ rowId: RowId }> = ({ rowId }) => {
  const t = useTranslations("admin");
  const submit = useSubmit();
  return (
    <SignalColumn rowId={rowId}>
      <button
        type="button"
        aria-label={t("addPublication")}
        className="flex text-indigo-600 rounded-full w-fit h-fit hover:text-indigo-700"
        onClick={submit}
      >
        <AddCircleIcon className="w-5 aspect-square" />
      </button>
    </SignalColumn>
  );
};

/** The draft row at the end of the table, where a new publication is typed. */
const NewPublicationRow: FC = () => {
  return (
    <Row
      rowId={DRAFT_ID}
      Column={Column}
      Content={SubmittableData}
      SignalColumn={NewPublicationSignalColumn}
      TrailingColumns={DRAFT_TRAILING_COLUMNS}
      collapsible={false}
    />
  );
};

/**
 * The editable publication table of the enclosing store: a field in every cell
 * of every row, a draft row at the end, and the resemblance review over it.
 *
 * A click on a row's leading cell selects the row. A click anywhere else in a
 * row belongs to the field there and selects nothing.
 */
const PublicationWorkspace: FC = () => {
  const store = usePublicationStore();
  const isSelectionEmpty = useIsSelectionEmpty();
  const reviewing = useReviewing();

  // Selects the row `id` when the click landed on its selection handle. The row
  // order is read from the store at the click, so the function is the same on
  // every render and the rows do not render again when the order changes.
  const toggleSelection = useCallback(
    (id: PublicationId, event: MouseEvent) => {
      if (!isSelectionGesture(event.target)) return;

      select(store, {
        id,
        type: "publication",
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
        orderedIds: store.get(publicationIdsAtom),
      });
    },
    [store],
  );

  return (
    <>
      <ClearSelection store={store} />
      <PublicationResemblances
        isOpen={reviewing !== null}
        startAt={reviewing?.startAt}
        onClose={() => closeReview(store)}
      />
      <PublicationIndexTable
        ExtendedRow={ExtendedRow}
        ExtendedColumn={ExtendedColumn}
        ExtendedContent={ExtendedContent}
        ExtendedSignalColumn={ExtendedSignalColumn}
        ExtendedTrailingColumns={TRAILING_COLUMNS}
        ExtraRow={NewPublicationRow}
        onRowClick={toggleSelection}
        selectable={isSelectionEmpty}
        collapsible={false}
      />
    </>
  );
};

export default PublicationWorkspace;

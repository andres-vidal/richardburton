"use client";

import {
  usePublicationExcerpts,
  usePublicationMarkedField,
  usePublicationIds,
  useVisibleAttributes,
} from "modules/publication/hooks";
import {
  Publication,
  type PublicationId,
  type PublicationKey,
} from "modules/publication/model";
import { Link } from "i18n/navigation";
import {
  AriaRole,
  FC,
  HTMLProps,
  MouseEvent,
  ReactNode,
  createContext,
  forwardRef,
  memo,
  useContext,
  useMemo,
  useRef,
} from "react";
import { mergeRefs } from "react-merge-refs";
import { useTranslations } from "next-intl";
import useVisible from "utils/useVisible";
import Highlight from "./Highlight";
import { EmptySearchResults } from "./EmptySearchResults";
import CellPresence from "./CellPresence";
import { gridTemplateColumns } from "./publicationIndexColumns";
import { PublicationIndexTableSkeleton } from "./PublicationIndexTableSkeleton";

type RowId = PublicationId;
type ColId = PublicationKey;

/**
 * Returns the address of a row's record, or is null when the rows have no
 * address of their own.
 *
 * With an address, the title cell is a link to it, so a crawler can follow the
 * row as well as a click can.
 */
const RowHref = createContext<((id: RowId) => string) | null>(null);

type DivProps = Omit<HTMLProps<HTMLDivElement>, "ref"> & {
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
};

// Returns a component that renders a div with the ARIA `role`, which gives the
// CSS grid the semantics of a table. Every prop, the ref included, is passed to
// the div.
const roleDiv = (role: AriaRole) => {
  const Component = forwardRef<HTMLDivElement, DivProps>((props, ref) => (
    <div {...props} ref={ref} role={role} />
  ));
  Component.displayName = `Aria.${role}`;
  return Component;
};

const Aria = {
  Table: roleDiv("table"),
  Row: roleDiv("row"),
  Cell: roleDiv("cell"),
  ColumnHeader: roleDiv("columnheader"),
};

// Returns the columns a table renders: every attribute when `collapsible` is
// false, and otherwise the attributes the column menu leaves visible. Toggling a
// column re-renders the header and every row, which add or remove that column's
// cells.
const useColumns = (collapsible: boolean | undefined): ColId[] => {
  const visible = useVisibleAttributes();
  return collapsible === false ? Publication.ATTRIBUTES : visible;
};

/** The header cell of a column: the attribute's name. */
const ColumnHeader: FC<{ colId: ColId }> = ({ colId }) => {
  const t = useTranslations("attributes");
  const label = t(colId);
  return (
    <Aria.ColumnHeader className="mx-0.5 px-3 py-2 font-semibold text-left truncate">
      {label}
    </Aria.ColumnHeader>
  );
};

/**
 * A search can match a publication on its sources, which the table does not
 * show, which makes the row look unrelated to the search. This renders the
 * excerpt of the matching source so the reader can see why it is here.
 */
const SourceMatch: FC<{ rowId: RowId }> = ({ rowId }) => {
  const excerpt = usePublicationExcerpts(rowId)?.sources;

  return excerpt ? (
    <span className="block text-xs text-gray-500 truncate">
      <Highlight className="text-gray-700 bg-amber-100">{excerpt}</Highlight>
    </span>
  ) : null;
};

/**
 * The saved value of one cell, with the words the search matched marked. An
 * unsaved edit does not show here. The title links to the row's record when
 * `RowHref` gives an address, and shows the matching source under it.
 */
const Content: FC<{
  rowId: RowId;
  colId: ColId;
}> = ({ rowId, colId }) => {
  const marked = usePublicationMarkedField(rowId, colId);
  const href = useContext(RowHref);
  const isTitle = colId === "title";

  return (
    <div className="px-2 py-1 truncate">
      {isTitle && href ? (
        <Link
          href={href(rowId)}
          onClick={(event) => event.preventDefault()}
          className="hover:underline"
        >
          <Highlight>{marked}</Highlight>
        </Link>
      ) : (
        <Highlight>{marked}</Highlight>
      )}
      {isTitle && <SourceMatch rowId={rowId} />}
    </div>
  );
};

/**
 * One cell of the table. A cell that another person has focused gets a
 * background tint in that person's colour, a thin bar in that colour along its
 * left edge, and a `CellPresence` marker. The bar is a `before` pseudo-element,
 * because a border would take width from the cell's fixed grid track and shift
 * the text.
 */
const Column: FC<{
  rowId: RowId;
  colId: ColId;
  Content: typeof Content;
  focused?: boolean;
  invalid?: boolean;
  selected?: boolean;
  /**
   * Another person who has this cell focused: their `email` and the index of
   * their presence `colour`. `null` when nobody else has it focused.
   */
  focusedBy?: { email: string; colour: number } | null;
}> = ({
  rowId,
  colId,
  Content,
  focused = false,
  invalid = false,
  selected = false,
  focusedBy = null,
}) => {
  // `truncate` hides the overflow, which lets the cell be narrower than its
  // content, so the column's grid track keeps its width.
  return (
    <Aria.Cell
      className="
        relative px-2 py-1 text-sm truncate transition-colors
        group-hover:bg-indigo-100 error:group-hover:bg-red-100 error:focused:bg-red-100
        selected:bg-amber-100 selected:focused:error:bg-amber-100
        data-[focused-by]:before:absolute data-[focused-by]:before:inset-y-0.5 data-[focused-by]:before:left-0 data-[focused-by]:before:w-0.5 data-[focused-by]:before:rounded-full
        data-[focused-by]:bg-(--presence-tint) data-[focused-by]:before:bg-(--presence)
      "
      data-selected={selected}
      data-error={invalid}
      data-focused={focused}
      data-focused-by={focusedBy?.colour}
    >
      <Content rowId={rowId} colId={colId} />
      {focusedBy && (
        <CellPresence colour={focusedBy.colour} by={focusedBy.email} />
      )}
    </Aria.Cell>
  );
};

/**
 * A cell added after the attributes of every row. `Cell` renders it, and
 * `name`, an `attributes` message, names its column for screen readers.
 */
type TrailingColumn = {
  name: "notes" | "sources";
  Cell: FC<{ rowId: RowId }>;
};

/** No trailing columns, as one list, so that a row's props keep their identity. */
const NO_COLUMNS: TrailingColumn[] = [];

type RowProps = Omit<DivProps, "className"> & {
  rowId: RowId;
  Column: typeof Column;
  Content: typeof Content;
  SignalColumn?: typeof SignalColumn;
  /**
   * The cells after the attributes, in order. The row is memoised, so a list
   * that keeps its identity across renders lets a row skip rendering.
   */
  TrailingColumns?: TrailingColumn[];
  collapsible?: boolean;
  /**
   * Called with the row's id when the row is clicked. The row is memoised, so a
   * handler that keeps its identity across renders lets a row skip rendering
   * when only the table around it does.
   */
  onRowClick?: (id: RowId, event: MouseEvent) => void;
};

/**
 * Renders one publication's row: the signal cell, a cell per column and the
 * trailing cells. A row that is off-screen renders the same number of empty
 * cells instead. The row then stays a valid ARIA row and keeps its height in the
 * grid, without subscribing to the store.
 */
const Row = memo(
  forwardRef<HTMLDivElement, RowProps>(function Row(
    {
      rowId,
      Column,
      Content,
      SignalColumn,
      TrailingColumns = NO_COLUMNS,
      collapsible,
      onRowClick,
      ...props
    },
    ref,
  ) {
    const clickable = Boolean(onRowClick);

    const innerRef = useRef<HTMLDivElement>(null);

    const compositeRef = useMemo(
      () => mergeRefs([ref, innerRef]),
      [ref, innerRef],
    );

    const visible = useVisible(innerRef);
    const attributes = useColumns(collapsible);

    return (
      <Aria.Row
        ref={compositeRef}
        data-clickable={clickable}
        className="grid col-span-full grid-cols-subgrid min-h-9 group data-[clickable=true]:cursor-pointer"
        onClick={onRowClick && ((event) => onRowClick(rowId, event))}
        {...props}
      >
        {visible ? (
          <>
            {SignalColumn && <SignalColumn rowId={rowId} />}
            {attributes.map((attribute) => (
              <Column
                key={attribute}
                colId={attribute}
                rowId={rowId}
                Content={Content}
              />
            ))}
            {TrailingColumns.map(({ name, Cell }) => (
              <Cell key={name} rowId={rowId} />
            ))}
          </>
        ) : (
          Array.from({
            length:
              (SignalColumn ? 1 : 0) +
              attributes.length +
              TrailingColumns.length,
          }).map((_, i) => <Aria.Cell key={i} />)
        )}
      </Aria.Row>
    );
  }),
);

/**
 * The row's leading cell: its signal (invalid, focused) and its handle. Where a
 * row is selectable this is *the* place to click for it — the other cells may
 * hold a field, and a click there belongs to the field.
 */
const SignalColumn: FC<{
  rowId: RowId;
  focused?: boolean;
  invalid?: boolean;
  selected?: boolean;
  /** Clicking this cell selects the row. */
  selectsRow?: boolean;
  children?: ReactNode;
}> = ({
  focused = false,
  invalid = false,
  selected = false,
  selectsRow = false,
  children,
}) => {
  return (
    <Aria.Cell
      className="flex sticky left-0 z-10 justify-center items-center px-2 bg-gray-100 transition-colors group-hover:bg-indigo-100 error:group-hover:bg-red-100 error:focused:bg-red-100 selected:bg-amber-100 selected:focused:error:bg-amber-100"
      data-selected={selected}
      data-selects-row={selectsRow}
      data-error={invalid}
      data-focused={focused}
    >
      {children}
    </Aria.Cell>
  );
};

interface Props {
  ExtendedRow?: FC<RowProps>;
  ExtendedColumn?: typeof Column;
  ExtendedContent?: typeof Content;
  ExtendedSignalColumn?: typeof SignalColumn;
  /**
   * The cells after the attributes of every row, in order. Pass a list that
   * keeps its identity, so that rows do not re-render with the table.
   */
  ExtendedTrailingColumns?: TrailingColumn[];
  ExtraRow?: FC;
  /** Called with a row's id when the row is clicked. Pass a stable function,
   * so that rows do not re-render with the table. */
  onRowClick?: (id: RowId, event: MouseEvent) => void;
  /** Where each row's record lives, when it has an address of its own. */
  rowHref?: (id: RowId) => string;
  /** Whether the *text* in the table can be selected. Off while rows are
   * selected, so dragging across them does not highlight their content. */
  selectable?: boolean;
  /** Whether the column menu can hide columns. With false, every column shows. */
  collapsible?: boolean;
}

/**
 * The publications of the enclosing store as a table: a header row, a row per
 * publication, and `ExtraRow` at the end. It shows `EmptySearchResults` when
 * the store holds no publications and there is no `ExtraRow`. While the
 * publications have not loaded, it shows a `PublicationIndexTableSkeleton`
 * with the table's columns.
 *
 * The table is a CSS grid, not a `<table>`, with ARIA roles that give it a
 * table's semantics. Each column has a maximum width, which
 * `gridTemplateColumns` sets, and the columns align to the left. The
 * `Extended*` props replace the read-only pieces of the table.
 * `ExtendedSignalColumn` adds a cell before the attributes of every row, and
 * `ExtendedTrailingColumns` add cells after them.
 */
const PublicationIndexTable: FC<Props> = ({
  ExtendedRow = Row,
  ExtendedColumn = Column,
  ExtendedContent = Content,
  ExtendedSignalColumn,
  ExtendedTrailingColumns = NO_COLUMNS,
  ExtraRow,
  onRowClick,
  rowHref,
  selectable = true,
  collapsible = true,
}) => {
  const t = useTranslations("attributes");
  const ids = usePublicationIds();
  const hasSignal = Boolean(ExtendedSignalColumn);
  const visibleAttributes = useColumns(collapsible);
  const trailing = ExtendedTrailingColumns.length;
  const template = useMemo(
    () =>
      gridTemplateColumns({
        signal: hasSignal,
        attributes: visibleAttributes,
        trailing,
      }),
    [visibleAttributes, hasSignal, trailing],
  );

  return ids && (ids.length > 0 || ExtraRow) ? (
    <RowHref.Provider value={rowHref ?? null}>
      <Aria.Table
        aria-label={t("publications")}
        data-selectable={selectable}
        style={{ gridTemplateColumns: template }}
        className="grid relative justify-start w-full h-fit data-[selectable=false]:select-none"
      >
        <Aria.Row className="grid sticky top-(--app-header-h) z-20 col-span-full bg-gray-100 grid-cols-subgrid">
          {ExtendedSignalColumn && (
            <Aria.ColumnHeader>
              <span className="sr-only">{t("status")}</span>
            </Aria.ColumnHeader>
          )}
          {visibleAttributes.map((key) => (
            <ColumnHeader key={key} colId={key} />
          ))}
          {ExtendedTrailingColumns.map(({ name }) => (
            <Aria.ColumnHeader key={name}>
              <span className="sr-only">{t(name)}</span>
            </Aria.ColumnHeader>
          ))}
        </Aria.Row>
        {ids.map((id) => (
          <ExtendedRow
            key={id}
            rowId={id}
            Column={ExtendedColumn}
            SignalColumn={ExtendedSignalColumn}
            TrailingColumns={ExtendedTrailingColumns}
            Content={ExtendedContent}
            collapsible={collapsible}
            onRowClick={onRowClick}
          />
        ))}
        {ExtraRow && <ExtraRow />}
      </Aria.Table>
    </RowHref.Provider>
  ) : ids ? (
    <EmptySearchResults />
  ) : (
    <PublicationIndexTableSkeleton
      attributes={visibleAttributes}
      signal={hasSignal}
      trailing={trailing}
    />
  );
};

export { Column, Content, PublicationIndexTable, Row, SignalColumn };
export type { RowId, RowProps, TrailingColumn };

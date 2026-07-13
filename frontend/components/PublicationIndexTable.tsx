"use client";

import {
  Publication,
  PublicationId,
  PublicationKey,
  useHiddenAttributes,
  usePublicationField,
  usePublicationFieldError,
  useVisiblePublicationIds,
} from "modules/publication";
import {
  AriaRole,
  FC,
  HTMLProps,
  MouseEvent,
  ReactNode,
  forwardRef,
  useMemo,
  useRef,
} from "react";
import { mergeRefs } from "react-merge-refs";
import useVisible from "utils/useVisible";
import { EmptySearchResults } from "./EmptySearchResults";
import { ListSkeleton } from "./ListSkeleton";

type RowId = PublicationId;
type ColId = PublicationKey;

type DivProps = Omit<HTMLProps<HTMLDivElement>, "ref"> & {
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
};

// Thin wrappers that render a plain div carrying the ARIA role which restores the
// table semantics the CSS grid would otherwise lose — so the markup reads as
// `<Aria.Row>` / `<Aria.Cell>` rather than `<div role="row">`. Every prop (ref,
// className, data-*, …) is forwarded to the div.
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

// Max width per column. The table left-aligns and each column caps here instead of
// stretching to fill — so hiding columns leaves the rest a sensible width rather than
// ballooning. `minmax(0, …)` still lets them shrink to share the width when every
// column is shown; the maxes are generous enough to fit the titles and values, and
// only the longest outliers truncate.
const COLUMN_MAX_WIDTH: Partial<Record<ColId, string>> = {
  year: "5rem",
  originalTitle: "20rem",
  title: "24rem",
};
const DEFAULT_COLUMN_MAX_WIDTH = "14rem";

// The columns a table renders: all of them, minus the ones hidden through the
// column menu. Non-collapsible tables (the editing workspace) always show every
// column. Reading the store here means toggling a column re-renders the header and
// every row — adding or removing that column's cells — with no in-place collapse.
const useVisibleAttributes = (collapsible: boolean | undefined): ColId[] => {
  const hidden = useHiddenAttributes();
  return useMemo(
    () =>
      collapsible === false
        ? Publication.ATTRIBUTES
        : Publication.ATTRIBUTES.filter((key) => !hidden.includes(key)),
    [collapsible, hidden],
  );
};

// Rendered as a CSS grid (not a <table>) whose `grid-template-columns` caps each
// visible column at a max width and left-aligns them (see `COLUMN_MAX_WIDTH`); the
// ARIA roles above restore the table semantics the divs would otherwise lose.

// A plain column label. `toggleable` is accepted (the workspace still passes it)
// but unused — showing/hiding is driven by the column menu, not per-header buttons.
const ColumnHeader: FC<{ colId: ColId; toggleable?: boolean }> = ({
  colId,
}) => {
  const label = Publication.ATTRIBUTE_LABELS[colId];
  return (
    <Aria.ColumnHeader className="px-4 py-2 font-semibold text-left truncate">
      {label}
    </Aria.ColumnHeader>
  );
};

const Content: FC<{
  rowId: RowId;
  colId: ColId;
  error: string;
  value: string;
}> = ({ value, colId }) => {
  return (
    <div className="px-2 py-1 truncate">
      {Publication.describeValue(value, colId)}
    </div>
  );
};

const Column: FC<{
  rowId: RowId;
  colId: ColId;
  Content: typeof Content;
  focused?: boolean;
  invalid?: boolean;
  selected?: boolean;
  selectable?: boolean;
}> = ({
  rowId,
  colId,
  Content,
  focused = false,
  invalid = false,
  selected = false,
  selectable = false,
}) => {
  const value = usePublicationField(rowId, colId);
  const error = usePublicationFieldError(rowId, colId);

  // `truncate` sets overflow:hidden, which zeroes the grid item's auto min-width so
  // the fixed-width track never expands to fit the content.
  return (
    <Aria.Cell
      className="px-2 py-1 text-sm truncate transition-colors group-hover:bg-indigo-100 error:group-hover:bg-red-100 error:focused:bg-red-100 selected:bg-amber-100 selected:focused:error:bg-amber-100"
      data-selected={selected}
      data-selectable={selectable}
      data-error={invalid}
      data-focused={focused}
    >
      <Content rowId={rowId} colId={colId} value={value} error={error} />
    </Aria.Cell>
  );
};

type RowProps = DivProps & {
  rowId: RowId;
  Column: typeof Column;
  Content: typeof Content;
  SignalColumn?: typeof SignalColumn;
  collapsible?: boolean;
  onClick?: (event: MouseEvent) => void;
};

const Row = forwardRef<HTMLDivElement, RowProps>(function Row(
  {
    rowId,
    Column,
    Content,
    SignalColumn,
    collapsible,
    className = "",
    onClick,
    ...props
  },
  ref,
) {
  const clickable = Boolean(onClick);

  const innerRef = useRef<HTMLDivElement>(null);

  const compositeRef = useMemo(
    () => mergeRefs([ref, innerRef]),
    [ref, innerRef],
  );

  const visible = useVisible(innerRef);
  const attributes = useVisibleAttributes(collapsible);

  return (
    <Aria.Row
      ref={compositeRef}
      data-clickable={clickable}
      className={`
        ${className}
        grid col-span-full grid-cols-subgrid min-h-9 group
        data-[clickable=true]:cursor-pointer
      `}
      onClick={onClick}
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
        </>
      ) : (
        // Off-screen rows keep their cell structure — so the row stays a valid ARIA
        // row and reserves its grid height — without subscribing to the store (that's
        // the point of the virtualization).
        Array.from({
          length: (SignalColumn ? 1 : 0) + attributes.length,
        }).map((_, i) => <Aria.Cell key={i} />)
      )}
    </Aria.Row>
  );
});

const SignalColumn: FC<{
  rowId: RowId;
  focused?: boolean;
  invalid?: boolean;
  selected?: boolean;
  selectable?: boolean;
  children?: ReactNode;
}> = ({
  focused = false,
  invalid = false,
  selected = false,
  selectable = false,
  children,
}) => {
  return (
    <Aria.Cell
      className="flex sticky left-0 z-10 justify-center items-center px-2 bg-gray-100 group-hover:bg-indigo-100 error:group-hover:bg-red-100 error:focused:bg-red-100 selected:bg-amber-100 selected:focused:error:bg-amber-100"
      data-selected={selected}
      data-selectable={selectable}
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
  ExtendedColumnHeader?: typeof ColumnHeader;
  ExtendedContent?: typeof Content;
  ExtendedSignalColumn?: typeof SignalColumn;
  ExtraRow?: FC;
  onRowClick?: (id: RowId) => (event: MouseEvent) => void;
  selectable?: boolean;
  collapsible?: boolean;
}

const PublicationIndexTable: FC<Props> = ({
  ExtendedRow = Row,
  ExtendedColumn = Column,
  ExtendedColumnHeader = ColumnHeader,
  ExtendedContent = Content,
  ExtendedSignalColumn,
  ExtraRow,
  onRowClick,
  selectable = true,
  collapsible = true,
}) => {
  const ids = useVisiblePublicationIds();
  const hasSignal = Boolean(ExtendedSignalColumn);
  const visibleAttributes = useVisibleAttributes(collapsible);
  const gridTemplateColumns = useMemo(
    () =>
      [
        hasSignal ? "2.5rem" : null,
        ...visibleAttributes.map(
          (col) =>
            `minmax(0, ${COLUMN_MAX_WIDTH[col] ?? DEFAULT_COLUMN_MAX_WIDTH})`,
        ),
      ]
        .filter(Boolean)
        .join(" "),
    [visibleAttributes, hasSignal],
  );

  return ids && (ids.length > 0 || ExtraRow) ? (
    <Aria.Table
      aria-label="Publications"
      data-selectable={selectable}
      style={{ gridTemplateColumns }}
      className="grid relative justify-start w-full h-fit data-[selectable=false]:select-none"
    >
      <Aria.Row className="grid sticky top-0 z-20 col-span-full bg-gray-100 grid-cols-subgrid">
        {ExtendedSignalColumn && (
          <Aria.ColumnHeader>
            <span className="sr-only">Status</span>
          </Aria.ColumnHeader>
        )}
        {visibleAttributes.map((key) => (
          <ExtendedColumnHeader key={key} colId={key} />
        ))}
      </Aria.Row>
      {ids.map((id) => (
        <ExtendedRow
          key={id}
          rowId={id}
          Column={ExtendedColumn}
          SignalColumn={ExtendedSignalColumn}
          Content={ExtendedContent}
          collapsible={collapsible}
          onClick={onRowClick?.(id)}
        />
      ))}
      {ExtraRow && <ExtraRow />}
    </Aria.Table>
  ) : ids ? (
    <EmptySearchResults />
  ) : (
    <ListSkeleton rows={12} />
  );
};

export {
  Column,
  ColumnHeader,
  Content,
  PublicationIndexTable,
  Row,
  SignalColumn,
};
export type { ColId, RowId, RowProps };

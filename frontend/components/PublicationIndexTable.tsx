import VisibilityOffIcon from "assets/visibility-off.svg";
import {
  Publication,
  PublicationId,
  PublicationKey,
  setAttributesVisible,
  useHiddenAttributes,
  useIsAttributeVisible,
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
import Button from "./Button";
import { EmptySearchResults } from "./EmptySearchResults";
import { ListSkeleton } from "./ListSkeleton";
import { useColumnLayout } from "./PublicationIndexTable.Layout";
import Tooltip from "./Tooltip";

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

// Rendered as a CSS grid (not a <table>) so a hidden column can smoothly collapse
// by animating its `grid-template-columns` track. The ARIA roles above restore the
// table semantics the divs would otherwise lose; the track math and the collapse
// animation live in `useColumnLayout` (./columnLayout).

const ColumnHeader: FC<{ colId: ColId; toggleable?: boolean }> = ({
  colId,
  toggleable,
}) => {
  const isVisible = useIsAttributeVisible(colId);
  const label = Publication.ATTRIBUTE_LABELS[colId];
  const hideLabel = `Hide ${label}`;

  // A non-toggleable column is a plain label. A hidden one is an empty header kept
  // for ARIA — the restore chip (a grid-placed overlay in `PublicationIndexTable`)
  // covers the column. A visible toggleable one carries the hide button, floated
  // out of flow at the top-right over the label's trailing space so the label keeps
  // the column's full width (the `bg-gray-100` header masks any overlap).
  return !toggleable ? (
    <Aria.ColumnHeader className="px-4 py-2 font-semibold text-left truncate">
      {label}
    </Aria.ColumnHeader>
  ) : !isVisible ? (
    <Aria.ColumnHeader>
      <span className="sr-only">{label}</span>
    </Aria.ColumnHeader>
  ) : (
    <Aria.ColumnHeader className="relative font-semibold text-left">
      <span className="block px-4 py-2 truncate">{label}</span>
      <span className="flex absolute inset-y-0 right-2 items-center pl-2 bg-gray-100">
        <Tooltip variant="info" message={hideLabel}>
          <Button
            label={hideLabel}
            labelSrOnly
            width="fit"
            variant="outline"
            Icon={VisibilityOffIcon}
            onClick={() => setAttributesVisible([colId], false)}
          />
        </Tooltip>
      </span>
    </Aria.ColumnHeader>
  );
};

// The overlay for a hidden column: one button spanning the whole column, full
// table height. It's an absolutely-positioned *grid child* — placing it with
// `grid-column` makes its grid area the containing block, so `inset: 0` fills the
// column horizontally and the entire grid vertically (no measured height needed).
// A click anywhere on it restores the column; the rotated label stays put via
// `sticky` as the list scrolls.
const RestoreChip: FC<{ colId: ColId; column: number }> = ({
  colId,
  column,
}) => {
  const label = Publication.ATTRIBUTE_LABELS[colId];
  return (
    <button
      type="button"
      aria-label={`Show ${label}`}
      onClick={() => setAttributesVisible([colId], true)}
      style={{ gridColumn: `${column} / ${column + 1}` }}
      className="flex absolute inset-0 z-30 justify-center items-start text-white bg-indigo-600 rounded shadow transition-colors hover:bg-indigo-700"
    >
      <span
        aria-hidden
        className="sticky top-0 py-2 text-xs whitespace-nowrap rotate-180"
        style={{ writingMode: "vertical-lr" }}
      >
        {label}
      </span>
    </button>
  );
};

const Content: FC<{
  rowId: RowId;
  colId: ColId;
  error: string;
  value: string;
  toggleable?: boolean;
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
  visible?: boolean;
  invalid?: boolean;
  selected?: boolean;
  selectable?: boolean;
  toggleable?: boolean;
}> = ({
  rowId,
  colId,
  Content,
  focused = false,
  invalid = false,
  selected = false,
  selectable = false,
  toggleable,
}) => {
  const isVisible = useIsAttributeVisible(colId);
  const value = usePublicationField(rowId, colId);
  const error = usePublicationFieldError(rowId, colId);

  const hidden = toggleable && !isVisible;

  // Hidden column: an empty placeholder cell — the grid-placed restore chip covers
  // the whole column. Visible cell: the truncated content (`truncate` sets
  // overflow:hidden, which zeroes the grid item's auto min-width so the fixed-width
  // track never expands to fit it).
  return hidden ? (
    <Aria.Cell />
  ) : (
    <Aria.Cell
      className="px-2 py-1 text-sm truncate transition-colors group-hover:bg-indigo-100 error:group-hover:bg-red-100 error:focused:bg-red-100 selected:bg-amber-100 selected:focused:error:bg-amber-100"
      data-selected={selected}
      data-selectable={selectable}
      data-error={invalid}
      data-focused={focused}
    >
      <Content
        rowId={rowId}
        colId={colId}
        value={value}
        error={error}
        toggleable={toggleable}
      />
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
          {Publication.ATTRIBUTES.map((attribute) => (
            <Column
              key={attribute}
              colId={attribute}
              rowId={rowId}
              Content={Content}
              toggleable={collapsible !== false}
            />
          ))}
        </>
      ) : (
        // Off-screen rows keep their cell structure — so the row stays a valid
        // ARIA row and reserves its grid height — without subscribing to the
        // store (that's the point of the virtualization).
        Array.from({
          length: (SignalColumn ? 1 : 0) + Publication.ATTRIBUTES.length,
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
  const hidden = useHiddenAttributes();
  const hasSignal = Boolean(ExtendedSignalColumn);

  const isCollapsed = (key: ColId) =>
    collapsible &&
    Publication.ATTRIBUTE_IS_TOGGLEABLE[key] &&
    hidden.includes(key);

  // The collapse animation is driven by `data-phase` + Tailwind: `useColumnLayout`
  // returns the phase and the CSS variables holding each stage's track sizes; the
  // `collapsing:`/`settled:` variants below pick the live one and the transition
  // class animates between them (see `useColumnLayout` for the two-stage logic).
  const { vars, phase, onSettle } = useColumnLayout(
    hidden,
    hasSignal,
    collapsible,
  );

  return ids && (ids.length > 0 || ExtraRow) ? (
    <Aria.Table
      aria-label="Publications"
      data-phase={phase}
      data-selectable={selectable}
      style={vars}
      onTransitionEnd={onSettle}
      className={`
        grid relative w-full h-fit
        duration-300 ease-in-out transition-[grid-template-columns]
        collapsing:grid-cols-(--rb-cols-collapsing)
        settled:grid-cols-(--rb-cols-settled)
        data-[selectable=false]:select-none
      `}
    >
      <Aria.Row className="grid sticky top-0 z-20 col-span-full bg-gray-100 grid-cols-subgrid">
        {ExtendedSignalColumn && (
          <Aria.ColumnHeader>
            <span className="sr-only">Status</span>
          </Aria.ColumnHeader>
        )}
        {Publication.ATTRIBUTES.map((key) => (
          <ExtendedColumnHeader
            key={key}
            colId={key}
            toggleable={collapsible && Publication.ATTRIBUTE_IS_TOGGLEABLE[key]}
          />
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
      {Publication.ATTRIBUTES.map((key, i) =>
        isCollapsed(key) ? (
          <RestoreChip
            key={`chip-${key}`}
            colId={key}
            column={(hasSignal ? 2 : 1) + i}
          />
        ) : null,
      )}
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

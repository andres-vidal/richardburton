import VisibilityOffIcon from "assets/visibility-off.svg";
import c from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import {
  Publication,
  PublicationId,
  PublicationKey,
  setAttributesVisible,
  useIsAttributeVisible,
  usePublicationField,
  usePublicationFieldError,
  useVisiblePublicationIds,
} from "modules/publication";
import {
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
import Tooltip from "./Tooltip";

type RowId = PublicationId;
type ColId = PublicationKey;

type HTMLTableRowProps = HTMLProps<HTMLTableRowElement>;

const ColumnHeader: FC<{ colId: ColId; toggleable?: boolean }> = ({
  colId,
  toggleable,
}) => {
  const isVisible = useIsAttributeVisible(colId);

  const TableHeader = toggleable ? motion.th : "th";
  const TableHeaderContent = toggleable ? motion.div : "div";

  const hideLabel = `Hide ${Publication.ATTRIBUTE_LABELS[colId]}`;

  return (
    <AnimatePresence initial={false}>
      {isVisible && (
        <TableHeader
          layout={toggleable ? true : undefined}
          className="px-4 pb-4 text-left whitespace-nowrap"
          initial={{ width: 0 }}
          animate={{ width: "auto" }}
          exit={{ width: 0 }}
        >
          <TableHeaderContent
            layout={toggleable ? true : undefined}
            className="flex items-center justify-between gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {Publication.ATTRIBUTE_LABELS[colId]}
            {toggleable && (
              <Tooltip info message={hideLabel}>
                <Button
                  label={hideLabel}
                  labelSrOnly
                  width="fit"
                  variant="outline"
                  Icon={VisibilityOffIcon}
                  onClick={() => setAttributesVisible([colId], false)}
                />
              </Tooltip>
            )}
          </TableHeaderContent>
        </TableHeader>
      )}
    </AnimatePresence>
  );
};

const Content: FC<{
  rowId: RowId;
  colId: ColId;
  error: string;
  value: string;
  toggleable?: boolean;
}> = ({ value, colId, toggleable }) => {
  const TableContent = toggleable ? motion.div : "div";

  return (
    <TableContent
      layout
      className="px-2 py-1 truncate"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {Publication.describeValue(value, colId)}
    </TableContent>
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

  const TableData = toggleable ? motion.td : "td";

  return (
    <AnimatePresence initial={false}>
      {isVisible && (
        <TableData
          layout
          className={c(
            "px-2 py-1 text-sm truncate justify",
            "group-hover:bg-indigo-100",
            "error:group-hover:bg-red-100 error:focused:bg-red-100",
            "selected:bg-amber-100 selected:focused:error:bg-amber-100",
          )}
          data-selected={selected}
          data-selectable={selectable}
          data-error={invalid}
          data-focused={focused}
          initial={{ width: 0 }}
          animate={{ width: "auto" }}
          exit={{ width: 0 }}
        >
          <Content
            rowId={rowId}
            colId={colId}
            value={value}
            error={error}
            toggleable={toggleable}
          />
        </TableData>
      )}
    </AnimatePresence>
  );
};

type RowProps = Omit<HTMLTableRowProps, "ref"> & {
  rowId: RowId;
  Column: typeof Column;
  Content: typeof Content;
  SignalColumn?: typeof SignalColumn;
  onClick?: (event: MouseEvent) => void;
};

const Row = forwardRef<HTMLTableRowElement, RowProps>(function Row(
  { rowId, Column, Content, SignalColumn, className, onClick, ...props },
  ref,
) {
  const clickable = Boolean(onClick);

  const innerRef = useRef(null);

  const compositeRef = useMemo(
    () => mergeRefs([ref, innerRef]),
    [ref, innerRef],
  );

  const visible = useVisible(innerRef);

  return (
    <tr
      ref={compositeRef}
      className={c(className, "relative group h-9", {
        "cursor-pointer": clickable,
      })}
      onClick={onClick}
      {...props}
    >
      {visible && (
        <>
          {SignalColumn && <SignalColumn rowId={rowId} />}
          {Publication.ATTRIBUTES.map((attribute) => (
            <Column
              key={attribute}
              colId={attribute}
              rowId={rowId}
              Content={Content}
              toggleable
            />
          ))}
        </>
      )}
    </tr>
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
    <td
      className={c(
        "sticky left-0 flex items-center justify-center h-full px-2 truncate bg-gray-100",
        "group-hover:bg-indigo-100",
        "error:group-hover:bg-red-100 error:focused:bg-red-100",
        "selected:bg-amber-100 selected:focused:error:bg-amber-100",
      )}
      data-selected={selected}
      data-selectable={selectable}
      data-error={invalid}
      data-focused={focused}
    >
      {children}
    </td>
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
}) => {
  const ids = useVisiblePublicationIds();

  return ids && (ids.length > 0 || ExtraRow) ? (
    <table
      className={c("h-fit w-full table-fixed", { "select-none": !selectable })}
    >
      <thead className="sticky top-0 z-10 bg-gray-100">
        <tr>
          {ExtendedSignalColumn && <th className="w-10" />}
          {Publication.ATTRIBUTES.map((key) => (
            <ExtendedColumnHeader
              key={key}
              colId={key}
              toggleable={Publication.ATTRIBUTE_IS_TOGGLEABLE[key]}
            />
          ))}
        </tr>
      </thead>
      <tbody>
        {ids.map((id) => (
          <ExtendedRow
            key={id}
            rowId={id}
            Column={ExtendedColumn}
            SignalColumn={ExtendedSignalColumn}
            Content={ExtendedContent}
            onClick={onRowClick?.(id)}
          />
        ))}
        {ExtraRow && <ExtraRow />}
      </tbody>
    </table>
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

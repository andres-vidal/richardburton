"use client";

import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
} from "@floating-ui/react";
import { isString } from "lodash";
import { cloneElement, ReactElement, Ref, useMemo, useRef } from "react";
import { mergeRefs } from "react-merge-refs";
import Menu from "./Menu";
import MenuItem from "./MenuItem";

type Option = { id: string; label: string };

type Props<OptionType extends Option | string> = {
  children: ReactElement;
  options: OptionType[];
  isOpen: boolean;
  activeIndex: number | null;
  bordered?: boolean;
  setIsOpen: (value: boolean) => void;
  setActiveIndex: (value: number | null) => void;
  onSelect: (option: OptionType) => void;
  /** Shown in place of the list when there is nothing to offer. */
  emptyMessage?: string;
};

const MenuProvider = <OptionType extends Option | string>({
  children,
  options,
  isOpen,
  activeIndex,
  setIsOpen,
  setActiveIndex,
  onSelect,
  bordered,
  emptyMessage,
}: Props<OptionType>) => {
  const listRef = useRef<(HTMLLIElement | null)[]>([]);

  const { refs, floatingStyles, context } = useFloating<HTMLDivElement>({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements, availableHeight }) {
          elements.floating.style.width = `${rects.reference.width}px`;
          elements.floating.style.maxHeight = `${Math.max(availableHeight, 96)}px`;
        },
        padding: 10,
      }),
    ],
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [
      useRole(context, { role: "listbox" }),
      useDismiss(context),
      useListNavigation(context, {
        listRef,
        activeIndex,
        onNavigate: setActiveIndex,
        virtual: true,
        loop: true,
      }),
    ],
  );

  // React 19 exposes a child's ref as a regular prop (children.props.ref).
  // Merge it with floating-ui's ref, and spread the child props first so the
  // merged ref wins over the incoming one.
  const childProps = children.props as Record<string, unknown> & {
    ref?: Ref<unknown>;
  };

  const ref = useMemo(
    () => mergeRefs([refs.setReference, childProps.ref]),
    [refs.setReference, childProps.ref],
  );

  return (
    <>
      {cloneElement(
        children,
        getReferenceProps({
          ...childProps,
          ref: ref as Ref<Element>,
        }),
      )}
      <FloatingPortal>
        {isOpen && (
          <FloatingFocusManager
            context={context}
            modal={false}
            initialFocus={-1}
            visuallyHiddenDismiss
          >
            <Menu
              ref={refs.setFloating}
              bordered={bordered}
              {...getFloatingProps({ style: floatingStyles })}
            >
              {options.length === 0 && emptyMessage ? (
                <li
                  role="option"
                  aria-disabled="true"
                  aria-selected="false"
                  className="px-3 py-2 text-sm text-gray-600"
                >
                  {emptyMessage}
                </li>
              ) : (
                options.map((option, index) => (
                  <MenuItem
                    key={isString(option) ? option : option.id}
                    ref={(node) => {
                      listRef.current[index] = node;
                    }}
                    selected={activeIndex === index}
                    {...getItemProps({
                      onClick: () => {
                        setIsOpen(false);
                        onSelect(option);
                      },
                    })}
                  >
                    {isString(option) ? option : option.label}
                  </MenuItem>
                ))
              )}
            </Menu>
          </FloatingFocusManager>
        )}
      </FloatingPortal>
    </>
  );
};

export type { Option as MenuOption };
export default MenuProvider;

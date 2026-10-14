"use client";

import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  Placement,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import {
  cloneElement,
  FC,
  FocusEvent,
  ReactElement,
  Ref,
  useMemo,
  useState,
} from "react";
import { mergeRefs } from "react-merge-refs";

// Adapted from https://floating-ui.com/docs/tooltip

type TooltipOptions = {
  /** Where the tooltip goes relative to its child. Defaults to `top`. */
  placement?: Placement;
  /** With `main`, the tooltip stays inside the page's `<main>` element. */
  boundary?: "main";
  /** Centres the tooltip horizontally in the viewport instead of on its child. */
  absoluteCenter?: boolean;
};

/**
 * Returns the floating-ui state and prop getters for a tooltip that opens while
 * its reference is hovered or focused. The tooltip closes when the pointer
 * leaves, when the reference loses focus, and on Escape or a click outside.
 * With `boundary: "main"`, the tooltip flips and shifts to stay inside the
 * page's `<main>` element.
 */
function useTooltip(options: TooltipOptions = {}) {
  const { placement = "top" } = options;

  const boundary =
    options.boundary === "main"
      ? document.getElementsByTagName("main")[0]
      : undefined;

  const [open, setOpen] = useState(false);

  const data = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [offset(5), flip({ boundary }), shift({ boundary })],
  });

  const context = data.context;

  const interactions = useInteractions([
    useHover(context, { move: false }),
    useFocus(context),
    useDismiss(context),
    useRole(context, { role: "tooltip" }),
  ]);

  return useMemo(
    () => ({
      open,
      setOpen,
      ...interactions,
      ...data,
    }),
    [open, setOpen, interactions, data],
  );
}

type Props = {
  children: ReactElement;
  content: ReactElement;
} & TooltipOptions;

/**
 * Shows `content` in a portal next to its only child while the child is
 * hovered or focused, with the `tooltip` role. The tooltip closes when the
 * pointer leaves, when the child loses focus, and on Escape or a click outside.
 * It flips and shifts to stay in view. The child must take a ref.
 */
const TooltipProvider: FC<Props> = ({
  children,
  content,
  absoluteCenter,
  ...options
}) => {
  const state = useTooltip(options);

  // React 19 exposes a child's ref as a regular prop (children.props.ref).
  const childProps = children.props as Record<string, unknown> & {
    ref?: Ref<unknown>;
    onBlur?: (event: FocusEvent<Element>) => void;
  };
  const ref = useMemo(
    () => mergeRefs([state.refs.setReference, childProps.ref]),
    [state.refs.setReference, childProps.ref],
  );

  // The child's props, merged with the tooltip's, are built again only when the
  // child or the tooltip's handlers change, not each time the tooltip opens or
  // closes, so a memoised child does not render again for it.
  const { getReferenceProps, setOpen } = state;
  const referenceProps = useMemo(
    () =>
      getReferenceProps({
        ...childProps,
        ref: ref as Ref<Element>,
        onBlur(event: FocusEvent<Element>) {
          childProps.onBlur?.(event);
          setOpen(false);
        },
      }),
    [getReferenceProps, setOpen, childProps, ref],
  );

  return (
    <>
      {cloneElement(children, referenceProps)}
      <FloatingPortal>
        {state.open && (
          <div
            ref={state.refs.setFloating}
            data-center={Boolean(absoluteCenter)}
            {...state.getFloatingProps({
              className: `
                z-50
                data-[center=true]:left-1/2 data-[center=true]:-translate-x-1/2
              `,
              style: {
                position: state.strategy,
                top: state.y ?? 0,
                left: absoluteCenter ? undefined : (state.x ?? 0),
                visibility: state.x == null ? "hidden" : "visible",
              },
            })}
          >
            {content}
          </div>
        )}
      </FloatingPortal>
    </>
  );
};

export default TooltipProvider;
export type { Props as TooltipProps };

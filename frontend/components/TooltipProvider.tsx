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
  initialOpen?: boolean;
  placement?: Placement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  portalRoot?: "main";
  boundary?: "main";
  absoluteCenter?: boolean;
};

function useTooltip(options: TooltipOptions = {}) {
  const {
    initialOpen = false,
    placement = "top",
    open: controlledOpen,
    onOpenChange: setControlledOpen,
  } = options;

  const boundary =
    options.boundary === "main"
      ? document.getElementsByTagName("main")[0]
      : undefined;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(initialOpen);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = setControlledOpen ?? setUncontrolledOpen;

  const data = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    middleware: [offset(5), flip({ boundary }), shift({ boundary })],
  });

  const context = data.context;

  const interactions = useInteractions([
    useHover(context, { move: false, enabled: controlledOpen == null }),
    useFocus(context, { enabled: controlledOpen == null }),
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

  return (
    <>
      {cloneElement(
        children,
        state.getReferenceProps({
          ...childProps,
          ...{ "data-state": state.open ? "open" : "closed" },
          ref: ref as Ref<Element>,
          onBlur(event: FocusEvent<Element>) {
            childProps.onBlur?.(event);
            state.setOpen(false);
          },
        }),
      )}
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
                left: absoluteCenter ? undefined : state.x ?? 0,
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

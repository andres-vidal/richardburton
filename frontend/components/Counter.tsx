import { useMotionValue, useSpring } from "framer-motion";
import { FC, useEffect, useRef } from "react";

interface Props {
  value: number;
  direction?: "up" | "down";
}

const Counter: FC<Props> = ({ value, direction = "up" }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? value : 0);
  const springValue = useSpring(motionValue, {
    damping: 100,
    stiffness: 100,
  });

  useEffect(() => {
    motionValue.set(direction === "down" ? 0 : value);
  }, [motionValue, direction, value]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat("en-US").format(
            Math.round(latest),
          );
        }
      }),
    [springValue],
  );

  return <span ref={ref} />;
};

export { Counter };

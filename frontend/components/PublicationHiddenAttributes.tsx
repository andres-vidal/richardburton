import VisibilityOnIcon from "assets/visibility-on.svg";
import c from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import {
  Publication,
  setAttributesVisible,
  useHiddenAttributes,
} from "modules/publication";
import { FC } from "react";
import Tooltip from "./Tooltip";

const PublicationHiddenAttributes: FC = () => {
  const hiddenAttributes = useHiddenAttributes();

  return (
    <ol className="flex h-full shadow">
      <AnimatePresence>
        {hiddenAttributes.map((key) => {
          const label = `Show ${Publication.ATTRIBUTE_LABELS[key]}`;
          return (
            <motion.li
              key={key}
              className={c(
                "relative origin-top-left overflow-clip shadow shadow-indigo-900 text-xs first:rounded-l last:rounded-r",
                "text-white bg-indigo-600 hover:bg-indigo-700 transition-colors ",
              )}
              initial={{ width: 0 }}
              animate={{ width: "2rem" }}
              exit={{ width: 0 }}
            >
              <Tooltip message={label} info>
                <button
                  className="flex items-start justify-center w-full h-full p-1 group"
                  onClick={() => setAttributesVisible([key])}
                  aria-label={label}
                >
                  <VisibilityOnIcon
                    role="presentation"
                    className="invisible w-5 h-5 group-hover:visible"
                  />
                  <motion.div
                    className="absolute z-20 text-center rotate-180 translate-x-1/2 top-10 whitespace-nowrap"
                    style={{ writingMode: "vertical-lr" }}
                    initial={{ left: "-2rem" }}
                    animate={{ left: 0 }}
                    exit={{ left: "-2rem" }}
                  >
                    {Publication.ATTRIBUTE_LABELS[key]}
                  </motion.div>
                </button>
              </Tooltip>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
};

export default PublicationHiddenAttributes;

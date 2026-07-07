import { FC } from "react";
import Tooltip from "./Tooltip";
import {
  useAreRowIdsVisible,
  useVisiblePublicationCount,
} from "modules/publication";
import NumberedListIcon from "assets/numbered-list.svg";
import Toggle from "./Toggle";

const RowIdToggle: FC = () => {
  const publicationCount = useVisiblePublicationCount();
  const [active, set] = useAreRowIdsVisible();

  return publicationCount !== 0 ? (
    <Tooltip info message={active ? "Hide row numbers" : "Show row numbers"}>
      <Toggle
        label="Row Ids"
        checked={active}
        onClick={() => set((active) => !active)}
        width="fit"
        labelSrOnly
        CheckedIcon={NumberedListIcon}
        UncheckedIcon={NumberedListIcon}
      />
    </Tooltip>
  ) : null;
};

export default RowIdToggle;

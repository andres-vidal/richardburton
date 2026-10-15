import { FC } from "react";

/**
 * The name of a group on a chart: its `label`, followed by its `detail` in
 * grey after a middle dot when there is one, as in "Dom Casmurro · Machado de
 * Assis". The component renders only text and the span around the detail, so
 * the element it is placed in sets the label's size and colour.
 */
const InsightName: FC<{
  label: string;
  /** Extra text shown after the label, such as a work's authors. */
  detail?: string;
}> = ({ label, detail }) => (
  <>
    {label}
    {detail ? <span className="text-gray-600"> · {detail}</span> : null}
  </>
);

export default InsightName;

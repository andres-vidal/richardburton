import { FC } from "react";

const StrikeHeading: FC<{ label: string }> = ({ label }) => (
  <h3 className="flex items-center my-4 space-x-2 text-sm">
    <span className="border-b grow h-fit" />
    <span className="text-gray-600">{label}</span>
    <span className="border-b grow h-fit" />
  </h3>
);

export default StrikeHeading;

"use client";

import CopyIcon from "assets/copy.svg";
import { notify } from "components/Notifications";
import { FC, useState } from "react";
import Button from "./Button";

/**
 * Copy a link to the current record, absolute so it can be sent to someone
 * else. For places where the address is not on screen — inside an overlay, the
 * URL bar still shows the page underneath.
 */
const CopyLink: FC<{ href: string; label?: string }> = ({
  href,
  label = "Copy link",
}) => {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = new URL(href, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify({ message: "Link copied", detail: url, level: "success" });
    } catch {
      notify({
        message: "Could not copy the link",
        detail: "Your browser did not allow it — the address is " + url,
        level: "warning",
      });
    }
  }

  return (
    <Button
      label={copied ? "Copied" : label}
      variant="outline"
      width="fit"
      size="medium"
      Icon={CopyIcon}
      onClick={handleCopy}
    />
  );
};

export default CopyLink;

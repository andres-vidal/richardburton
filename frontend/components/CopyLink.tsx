"use client";

import CopyIcon from "assets/copy.svg";
import { notify } from "components/Notifications";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import Tooltip from "./Tooltip";

/**
 * Copy a link to the current record, absolute so it can be sent to someone
 * else. For places where the address is not on screen — inside an overlay, the
 * URL bar still shows the page underneath.
 */
const CopyLink: FC<{ href: string; label?: string }> = ({ href, label }) => {
  const t = useTranslations("link");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = new URL(href, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify({ message: t("copiedMessage"), detail: url, level: "success" });
    } catch {
      notify({
        message: t("failed"),
        detail: t("failedDetail", { url }),
        level: "warning",
      });
    }
  }

  return (
    <Tooltip
      variant="info"
      message={copied ? t("copied") : (label ?? t("copy"))}
    >
      <button
        type="button"
        aria-label={copied ? t("copied") : (label ?? t("copy"))}
        data-copied={copied}
        className="
          flex p-1.5 rounded transition-colors shrink-0 focus-ring
          text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
          data-[copied=true]:text-emerald-600
        "
        onClick={handleCopy}
      >
        <CopyIcon className="w-4 aspect-square" />
      </button>
    </Tooltip>
  );
};

export default CopyLink;

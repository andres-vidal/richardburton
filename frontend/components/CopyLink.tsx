"use client";

import CopyIcon from "assets/copy.svg";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import { notify } from "./Notifications";
import Tooltip from "./Tooltip";

/**
 * An icon button that copies `href` to the clipboard as an absolute URL, so it
 * can be sent to someone else. Its accessible name and tooltip say "Copy link",
 * and "Copied" for two seconds after a copy. A notification shows the URL that
 * was copied, or says that the browser refused the clipboard.
 */
const CopyLink: FC<{ href: string }> = ({ href }) => {
  const t = useTranslations("link");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = new URL(href, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify({
        message: "link.copiedMessage",
        detail: "link.copiedDetail",
        values: { url },
        level: "success",
      });
    } catch {
      notify({
        message: "link.failed",
        detail: "link.failedDetail",
        values: { url },
        level: "warning",
      });
    }
  }

  return (
    <Tooltip variant="info" message={t("action", { copied: String(copied) })}>
      <button
        type="button"
        aria-label={t("action", { copied: String(copied) })}
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

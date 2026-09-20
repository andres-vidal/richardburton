"use client";

import Image from "next/image";
import { Link } from "i18n/navigation";
import { FC, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Article } from "./Article";
import { Modal, useURLQueryModal } from "./Modal";

const LEARN_MORE_MODAL_KEY = "learn-more";

const IRACEMA_URL =
  "https://archive.org/details/iramahoneylipsle00alen/mode/2up?view=theater";
const BURTONIANA_URL = "https://burtoniana.org";
const BURTON_MUSEUM_URL = "http://www.sirrichardburtonmuseum.co.uk";
const IFRS_URL = "https://ifrs.edu.br/";
const FAPERGS_URL = "https://fapergs.rs.gov.br/";
const WYEWORKS_URL = "https://wyeworks.com";

/**
 * A link out of the prose, for the rich-text tags below. Every one of these
 * leaves the platform, so they all open away from it.
 */
function outward(href: string) {
  return function OutwardLink(chunks: ReactNode) {
    return (
      <a className="anchor" target="__blank" href={href}>
        {chunks}
      </a>
    );
  };
}

const emphasised = (chunks: ReactNode) => (
  <em className="italic font-normal">{chunks}</em>
);

const named = (chunks: ReactNode) => (
  <strong className="font-normal">{chunks}</strong>
);

const AboutRichardBurtonHeading: FC = () => {
  const t = useTranslations("about");

  return <h2>{t.rich("asideHeading", { name: named })}</h2>;
};

const AboutRichardBurton: FC = () => {
  const t = useTranslations("about");
  const { close } = useURLQueryModal(LEARN_MORE_MODAL_KEY);

  return (
    <div>
      <div className="space-y-4">
        <div className="relative sm:w-1/2 aspect-[0.7] sm:float-right m-1 sm:ml-4">
          <Image
            fill
            alt={t("portraitAlt")}
            src="/iracema.jpeg"
            sizes="(max-width: 300px)"
          />
        </div>
        <p>{t.rich("burtons", { iracema: outward(IRACEMA_URL) })}</p>

        <ol className="ml-5 space-y-2 list-disc">
          <li>
            {t.rich("readMore", {
              burtoniana: outward(BURTONIANA_URL),
              museum: outward(BURTON_MUSEUM_URL),
            })}
          </li>
          <li>
            {t.rich("browse", {
              here: (chunks) => (
                <Link
                  href="/?search=Richard+Burton"
                  className="anchor"
                  onClick={close}
                >
                  {chunks}
                </Link>
              ),
            })}
          </li>
        </ol>
      </div>
    </div>
  );
};

const AboutRichardBurtonPlatform: FC = () => {
  const t = useTranslations("about");

  return (
    <div className="space-y-4">
      <p>{t.rich("platform", { name: emphasised })}</p>
      <p>
        {t.rich("registered", {
          ifrs: outward(IFRS_URL),
          project: emphasised,
        })}
      </p>
      <p>
        {t.rich("current", {
          project: emphasised,
          fapergs: outward(FAPERGS_URL),
          wyeworks: outward(WYEWORKS_URL),
        })}
      </p>
      <p>{t.rich("scope", { name: emphasised })}</p>
    </div>
  );
};

const LearnMoreHeading: FC = () => {
  const t = useTranslations("about");

  return (
    <div className="font-light">
      {t.rich("heading", {
        break: () => <br className="sm:hidden" />,
        name: named,
      })}
    </div>
  );
};

const LearnMoreModal: FC = () => {
  const t = useTranslations("about");
  const { isOpen, close } = useURLQueryModal(LEARN_MORE_MODAL_KEY);

  return (
    <Modal isOpen={isOpen} onClose={close} label={t("label")}>
      <Article
        heading={<LearnMoreHeading />}
        content={<AboutRichardBurtonPlatform />}
        aside={<AboutRichardBurton />}
        asideHeading={<AboutRichardBurtonHeading />}
      />
    </Modal>
  );
};

export { LEARN_MORE_MODAL_KEY, LearnMoreModal };

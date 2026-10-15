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
 * Returns a rich-text tag that renders its text as a link to `href`, a site
 * outside the platform, opened in a new tab that gets no access to this one.
 */
function outward(href: string) {
  return function OutwardLink(chunks: ReactNode) {
    return (
      <a
        className="anchor"
        target="_blank"
        rel="noopener noreferrer"
        href={href}
      >
        {chunks}
      </a>
    );
  };
}

/** A rich-text tag that renders its text in italics, for a title. */
const emphasised = (chunks: ReactNode) => (
  <em className="italic font-normal">{chunks}</em>
);

/** A rich-text tag that marks its text as a name, without making it bold. */
const named = (chunks: ReactNode) => (
  <strong className="font-normal">{chunks}</strong>
);

/** The heading of the aside about Richard and Isabel Burton. */
const AboutRichardBurtonHeading: FC = () => {
  const t = useTranslations("about");

  return <h2>{t.rich("asideHeading", { name: named })}</h2>;
};

/**
 * The aside about Richard and Isabel Burton: who they were, with an image
 * beside the text, and links to read more about them and to search the database
 * for their books. Following the search link closes the modal.
 */
const AboutRichardBurton: FC = () => {
  const t = useTranslations("about");
  const { close } = useURLQueryModal(LEARN_MORE_MODAL_KEY);

  return (
    <div className="space-y-4">
      <div className="relative sm:w-1/2 aspect-[0.7] sm:float-right m-1 sm:ml-4">
        <Image
          fill
          alt={t("portraitAlt")}
          src="/iracema.jpeg"
          sizes="(min-width: 640px) 25vw, 100vw"
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
  );
};

/** What the platform is, who registered it, who develops it, and what it holds. */
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

/**
 * The heading of the modal, which breaks before the platform's name on a small
 * screen.
 */
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

/**
 * A modal about the platform and about Richard and Isabel Burton. It is open
 * while the URL has a `learn-more` query parameter, such as `?learn-more=true`.
 */
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

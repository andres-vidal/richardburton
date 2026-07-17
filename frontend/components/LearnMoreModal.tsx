"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { FC } from "react";
import { Article } from "./Article";
import { Modal, useURLQueryModal } from "./Modal";

const LEARN_MORE_MODAL_KEY = "learn-more";

const AboutRichardBurton: FC = () => {
  const t = useTranslations("about.richardBurton");
  const { close } = useURLQueryModal(LEARN_MORE_MODAL_KEY);

  return (
    <div className="space-y-6">
      <header className="sticky z-30 px-1 py-2 bg-white top-10 sm:top-4">
        <h2 className="text-lg">
          {t("heading.prefix")}
          <strong className="font-normal"> {t("heading.name")}</strong>
        </h2>
      </header>

      <div className="space-y-4">
        <div className="relative sm:w-1/2 aspect-[0.7] sm:float-right m-1 sm:ml-4">
          <Image
            fill
            alt={t("imageAlt")}
            src="/iracema.jpeg"
            sizes="(max-width: 300px)"
          />
        </div>

        <p>
          {t.rich("description", {
            iracema: (chunks) => (
              <a
                className="anchor"
                target="__blank"
                href="https://archive.org/details/iramahoneylipsle00alen/mode/2up?view=theater"
              >
                {chunks}
              </a>
            ),
          })}
        </p>

        <ol className="ml-5 space-y-2 list-disc">
          <li>
            {t.rich("readMore", {
              burtoniana: (chunks) => (
                <a
                  href="https://burtoniana.org"
                  target="__blank"
                  className="anchor"
                >
                  {chunks}
                </a>
              ),
              museum: (chunks) => (
                <a
                  href="http://www.sirrichardburtonmuseum.co.uk"
                  target="__blank"
                  className="anchor"
                >
                  {chunks}
                </a>
              ),
            })}
          </li>

          <li>
            {t.rich("browseBooks", {
              link: (chunks) => (
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
  const t = useTranslations("about.platform");

  return (
    <div className="space-y-4">
      <p>
        {t.rich("introduction", {
          platform: (chunks) => (
            <em className="italic font-normal">{chunks}</em>
          ),
        })}
      </p>

      <p>
        {t.rich("firstVersion", {
          ifrs: (chunks) => (
            <a
              href="https://ifrs.edu.br/"
              target="__blank"
              className="anchor"
            >
              {chunks}
            </a>
          ),
          project: (chunks) => (
            <em className="italic font-normal">{chunks}</em>
          ),
        })}
      </p>

      <p>
        {t.rich("currentVersion", {
          project: (chunks) => (
            <em className="italic font-normal">{chunks}</em>
          ),
          fapergs: (chunks) => (
            <a
              className="anchor"
              target="__blank"
              href="https://fapergs.rs.gov.br/"
            >
              {chunks}
            </a>
          ),
          wyeworks: (chunks) => (
            <a
              className="anchor"
              target="__blank"
              href="https://wyeworks.com"
            >
              {chunks}
            </a>
          ),
        })}
      </p>

      <p>{t("dataCollection")}</p>
    </div>
  );
};

const LearnMoreHeading: FC = () => {
  const t = useTranslations("about");

  return (
    <div className="font-light">
      {t("heading.prefix")} <br className="sm:hidden" />
      <strong className="font-normal">{t("heading.platformName")}</strong>
    </div>
  );
};

const LearnMoreModal: FC = () => {
  const t = useTranslations("about");
  const { isOpen, close } = useURLQueryModal(LEARN_MORE_MODAL_KEY);

  return (
    <Modal isOpen={isOpen} onClose={close} label={t("modalLabel")}>
      <Article
        heading={<LearnMoreHeading />}
        content={<AboutRichardBurtonPlatform />}
        aside={<AboutRichardBurton />}
        noSeparator
      />
    </Modal>
  );
};

export { LEARN_MORE_MODAL_KEY, LearnMoreModal };

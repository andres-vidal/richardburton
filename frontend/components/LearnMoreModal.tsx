import Image from "next/image";
import Link from "next/link";
import { FC } from "react";
import { Article } from "./Article";
import { Modal, useURLQueryModal } from "./Modal";

const LEARN_MORE_MODAL_KEY = "learn-more";

const AboutRichardBurton: FC = () => {
  const { close } = useURLQueryModal(LEARN_MORE_MODAL_KEY);

  return (
    <div className="space-y-6">
      <header className="sticky z-30 px-1 py-2 bg-white top-10 sm:top-4">
        <h2 className="text-lg">
          About
          <strong className="font-normal"> Richard & Isabel Burton</strong>
        </h2>
      </header>
      <div className="space-y-4">
        <div className="relative sm:w-1/2 aspect-[0.7] sm:float-right m-1 sm:ml-4">
          <Image
            fill
            alt="Portrait of Sir Richard Burton"
            src="/iracema.jpeg"
            sizes="(max-width: 300px)"
          />
        </div>
        <p>
          The platform is named after the first known translators of a book of
          Brazilian literature into English. Sir Richard Francis Burton
          (1821-1890), and his wife Isabel Burton (1831-1896) are considered the
          pioneers in translating Brazilian literature into English. They had
          contact with author José de Alencar and his literary works while Sir
          Burton served as British consul in Santos, Brazil (1865-1868). The
          English translation for{" "}
          <a
            className="anchor"
            target="__blank"
            href="https://archive.org/details/iramahoneylipsle00alen/mode/2up?view=theater"
          >
            Iracema, The Honey-lips: A legend of Brazil
          </a>
          (1886), by José de Alencar, was first published by Bickers and Son
          publishing house, in London. After this first step, hundreds of books
          of literature have been translated into English with the efforts of
          independent translators, literary agents, publishing houses, and
          universities, making Brazilian literature available to the Anglophone
          readership.
        </p>

        <ol className="ml-5 space-y-2 list-disc">
          <li>
            Read more about Richard & Isabel Burton at{" "}
            <a
              href="https://burtoniana.org"
              target="__blank"
              className="anchor"
            >
              burtoniana.org
            </a>
            and{" "}
            <a
              href="http://www.sirrichardburtonmuseum.co.uk"
              target="__blank"
              className="anchor"
            >
              sir richard burton museum.co.uk
            </a>
            .
          </li>
          <li>
            Browse books translated by Richard & Isabel Burton{" "}
            <Link
              href={`/?search=Richard+Burton`}
              className="anchor"
              onClick={close}
            >
              here
            </Link>
          </li>
        </ol>
      </div>
    </div>
  );
};

const AboutRichardBurtonPlatform: FC = () => (
  <div className="space-y-4">
    <p>
      The{" "}
      <em className="italic font-normal">Richard & Isabel Burton Platform</em>{" "}
      is an open access online repository with reliable data about Brazilian
      literature in translation to English, stemmed from the need to preserve
      the Brazilian cultural and historical heritage as well as its
      international dissemination. The platform intends to contribute to
      translation flows worldwide, facilitating the access of Brazilian
      literature to Anglophone readers and researchers.
    </p>
    <p>
      The first version of the platform was registered by the{" "}
      <a href="https://ifrs.edu.br/" target="__blank" className="anchor">
        Federal Institute of Education, Science and Technology of Rio Grande do
        Sul (IFRS)
      </a>{" "}
      in 2016, linked to the project{" "}
      <em className="italic font-normal">
        &quot;Brazilian Literature and Transnationalities: Displacements,
        Identities and Technological Experiments&quot;
      </em>
      , with the goal of serving as a tool for readers, researchers, academic
      and governmental institutions interested in accessing data on works of
      Brazilian literature translated into English. Furthermore, the platform
      intends to contribute to translation flows worldwide, and the promotion of
      Brazilian cultural heritage in Brazil and abroad, facilitating its access
      to Anglophone readers and researchers.
    </p>
    <p>
      The current version has been developed since 2022, through the research
      project{" "}
      <em className="italic font-normal">
        &quot;Brazilian Literature in Translation: Solutions in Science and
        Technology&quot;
      </em>
      , with support of the{" "}
      <a className="anchor" target="__blank" href="https://fapergs.rs.gov.br/">
        Foundation of Research Support of the Rio Grande do Sul State (Fapergs)
      </a>{" "}
      and{" "}
      <a className="anchor" target="__blank" href="https://wyeworks.com">
        WyeWorks
      </a>
      &apos;s collaboration.{" "}
    </p>
    <p>
      The R&I platform&apos;s data collection includes titles of books from
      Brazilian literature translated into English. It doesn&apos;t include
      titles of anthologies, collections or works published in magazines,
      newspapers and/or electronic media.
    </p>
  </div>
);

const LearnMoreHeading: FC = () => (
  <div className="font-light">
    About the <br className="sm:hidden" />
    <strong className="font-normal">Richard & Isabel Burton Platform</strong>
  </div>
);

const LearnMoreModal: FC = () => {
  const { isOpen, close } = useURLQueryModal(LEARN_MORE_MODAL_KEY);

  return (
    <Modal isOpen={isOpen} onClose={close} label="About the platform">
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

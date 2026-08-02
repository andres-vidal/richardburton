"use client";

import { FC, ReactNode } from "react";
import { Modal, useURLQueryModal } from "./Modal";

const SEARCH_HELP_MODAL_KEY = "search-help";

/** One example, against what it returns. */
const Row: FC<{ type: string; children: ReactNode }> = ({ type, children }) => (
  <tr className="border-b border-gray-100 last:border-0">
    <td className="py-1.5 pr-4 align-top">
      <code className="px-1.5 py-0.5 font-mono text-xs text-indigo-800 whitespace-nowrap bg-indigo-50 rounded">
        {type}
      </code>
    </td>
    <td className="py-1.5 text-sm text-gray-600 align-top">{children}</td>
  </tr>
);

/** A named run of rows: the tables read as one, grouped by what is being asked. */
const Group: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <tbody>
    <tr>
      <th
        colSpan={2}
        scope="colgroup"
        className="pt-5 pb-1 text-xs font-medium tracking-wide text-left text-gray-500 uppercase"
      >
        {title}
      </th>
    </tr>
    {children}
  </tbody>
);

/**
 * How to search, for the person searching.
 *
 * The search does a good deal that is not obvious from a text box — it forgives
 * accents and misspellings, it narrows on every word, and it takes operators —
 * and none of that is worth anything to a reader who cannot discover it. This
 * states what to enter and what it returns: nothing here describes how the
 * search works underneath, and every line is something a reader could want.
 */
const SearchHelp: FC = () => (
  <div className="p-8 space-y-6 w-full">
    <header className="space-y-1">
      <h2 className="text-2xl font-normal">How to search</h2>
      <p className="text-sm text-gray-600">
        Enter any details of a publication — a title, a name, a year. Each
        additional word narrows the results, so a record must match all of them.
      </p>
    </header>

    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-gray-300">
          <th
            scope="col"
            className="py-1 pr-4 w-1/3 text-xs font-medium text-left text-gray-500"
          >
            Example
          </th>
          <th
            scope="col"
            className="py-1 text-xs font-medium text-left text-gray-500"
          >
            What it returns
          </th>
        </tr>
      </thead>

      <Group title="Spelling and accents">
        <Row type="angustia">
          Accents may be omitted or included; this returns <em>Angústia</em>.
        </Row>
        <Row type="casmuro">
          Minor misspellings are tolerated when no exact match is found, here
          and within an operator alike.
        </Row>
        <Row type="mach">
          An incomplete word matches any word beginning with it, such as{" "}
          <em>Machado</em>.
        </Row>
      </Group>

      <Group title="Searching a single field">
        <Row type="title:iracema">
          Restricts the search to the title, excluding matches elsewhere in the
          record.
        </Row>
        <Row type="author:machado">The author of the original work.</Row>
        <Row type="translator:caldwell">The person who translated it.</Row>
        <Row type="publisher:knopf">
          Also <code className="font-mono text-xs">country:</code>,{" "}
          <code className="font-mono text-xs">original:</code> for the original
          title, and <code className="font-mono text-xs">source:</code> for the
          sources a record cites.
        </Row>
        <Row type="year:1962">A single year.</Row>
        <Row type="year:1950-1960">
          A range. <code className="font-mono text-xs">year:2000-</code> runs
          from that year onwards, and{" "}
          <code className="font-mono text-xs">year:-1900</code> up to it.
        </Row>
      </Group>

      <Group title="Refining a search">
        <Row type={'title:"dom casmurro"'}>
          Quotation marks match the words in the order given.
        </Row>
        <Row type="title:(dom casmurro)">
          Parentheses match all the words, in any order — and, like any other
          word, allowing for a misspelling.
        </Row>
        <Row type="-country:US">
          A leading minus sign excludes matching records.
        </Row>
        <Row type="author:machado author:assis">
          Repeating an operator requires both conditions to hold.
        </Row>
      </Group>

      <Group title="Broadening a search">
        <Row type="amado :or lispector">
          Returns records matching either side, rather than both.
        </Row>
      </Group>

      <Group title="Operators in Portuguese">
        <Row type="titulo: autor: tradutor:">
          The same as <code className="font-mono text-xs">title:</code>,{" "}
          <code className="font-mono text-xs">author:</code> and{" "}
          <code className="font-mono text-xs">translator:</code>.
        </Row>
        <Row type="editora: pais: ano: fonte:">
          The same as <code className="font-mono text-xs">publisher:</code>,{" "}
          <code className="font-mono text-xs">country:</code>,{" "}
          <code className="font-mono text-xs">year:</code> and{" "}
          <code className="font-mono text-xs">source:</code>.
        </Row>
        <Row type=":ou">
          The same as <code className="font-mono text-xs">:or</code>.
        </Row>
      </Group>
    </table>
  </div>
);

const SearchHelpModal: FC = () => {
  const { isOpen, close } = useURLQueryModal(SEARCH_HELP_MODAL_KEY);

  return (
    <Modal isOpen={isOpen} onClose={close} label="How to search">
      <SearchHelp />
    </Modal>
  );
};

export { SEARCH_HELP_MODAL_KEY, SearchHelpModal };

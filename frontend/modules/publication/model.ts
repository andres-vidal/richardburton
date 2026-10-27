import { isEqual, uniqWith } from "lodash";
import type { CountryNaming } from "modules/country-names";
import { isBlank, type RichTextValue } from "modules/rich-text";

/**
 * A language a publication's notes and sources are written in: `pt`,
 * Brazilian Portuguese, or `en`, English. The codes are the interface's
 * locales.
 *
 * A publication holds its notes in each language as a version of its own, and
 * each of its sources has a text in each language. Neither language is the
 * original: either version can exist without the other.
 */
type Language = "pt" | "en";

/** Both languages, Portuguese first. */
const LANGUAGES: Language[] = ["pt", "en"];

/**
 * A source of a publication: its text in each language, or null in a language
 * it has no text in. A source the API returns has text in at least one of
 * them.
 */
type Source = Record<Language, string | null>;

/** The field of a publication that holds its notes in one language. */
type NotesKey = "notesPt" | "notesEn";

/** The field that holds the notes in each language. */
const NOTES_KEYS: Record<Language, NotesKey> = { pt: "notesPt", en: "notesEn" };

/** A publication as the API sends and takes it, one field per attribute. */
type Publication = {
  title: string;
  countries: string[];
  year: string;
  publishers: string[];
  authors: string[];
  originalTitle: string;
  originalAuthors: string[];
  sources: Source[];
  /**
   * The publication's notes in Portuguese as a rich-text value (see
   * `modules/rich-text`), or null when it has none. A page of the index leaves
   * the notes out, so a record read from one has no `notesPt` key, and neither
   * has a new row nobody has written notes on. A request without the key keeps
   * the stored notes, and a null clears them.
   */
  notesPt?: RichTextValue | null;
  /** The publication's notes in English, read and written as `notesPt` is. */
  notesEn?: RichTextValue | null;
  /**
   * The stored publication's id, or null for a row that is not stored. The
   * server never takes it from a request body.
   */
  id: number | null;
  /**
   * The matching text of each field, with the matched words wrapped in
   * `[[ ]]`, or null for a field the search did not match. Only search results
   * carry it, and never for `countries` or `year`. The excerpt of `sources`
   * draws on the texts of both languages.
   */
  excerpts?: Partial<Record<PublicationKey | "sources", string | null>>;
  /**
   * What a search matched, value by value: for each list field, a list lined up
   * with the field's values that holds each value's matching text, or null
   * where that value did not match. Only a record read with a search carries
   * it, and `sources` only where the whole list of sources is shown.
   *
   * `countries` holds the matched country's code rather than marked text,
   * since naming a country needs a locale the index does not have. `sources`
   * holds a source for each source, with the marked text of each language, or
   * null in a language the search did not match or the source has no text in.
   */
  marked?: Partial<Record<PublicationListKey, (string | null)[]>> & {
    sources?: (Partial<Source> | null)[];
  };
};

/**
 * The name of an attribute: a field of a publication other than its id, its
 * sources, its notes and its search marks.
 */
type PublicationKey = keyof Omit<
  Publication,
  "id" | "sources" | NotesKey | "excerpts" | "marked"
>;

/**
 * One word the search matched with something other than what was typed.
 *
 * Holds the word as typed, the indexed words it actually matched, and the field
 * it was searched in. The field is `null` for a free word, which is searched in
 * every field.
 *
 * Words matched exactly are not included, so this is empty for most searches.
 * `field` is the name used to write an operator, so every entry can be read back
 * as a search term.
 */
type Matched = {
  field: string | null;
  /** The word exactly as the reader typed it. */
  typed: string;
  /** The indexed words it matched, when those were not simply the word itself. */
  words: string[];
};

/** What an attribute holds: one value, or several. */
type PublicationValue = Publication[PublicationKey];

/** The attributes that hold several values, for readers that need all of them. */
type PublicationListKey = {
  [K in PublicationKey]: Publication[K] extends string[] ? K : never;
}[PublicationKey];

/**
 * What is wrong with a row: null when nothing is, the code of an error with the
 * whole row, or the code of an error with each field that has one, the notes
 * in each language and the sources included.
 */
type PublicationError =
  | null
  | string
  | (Record<PublicationKey, string> &
      Partial<Record<NotesKey | "sources", string>>);

/**
 * A field that can have an error of its own: an attribute, the notes in one
 * language, or the sources.
 */
type ErrorScope = PublicationKey | NotesKey | "sources";

/**
 * What the look-alike check found for a row: the stored records it resembles,
 * the other rows it resembles, and `repeats`, the first earlier row with the
 * same composite key, or null when there is none.
 */
type Resemblance = {
  stored: Publication[];
  others: PublicationId[];
  repeats: PublicationId | null;
};

/** A publication and what validation found wrong with it. */
type ValidationResult = { publication: Publication; errors: PublicationError };

/** A validation result for the row with the key `id`. */
type PublicationEntry = ValidationResult & { id: PublicationId };

/**
 * The key the store uses for a row.
 *
 * A row the server has saved is keyed by its publication id, a number. A row
 * being worked on in a workspace is keyed by a UUID created in the browser.
 * UUIDs are unique across browsers, so two people editing the same row use the
 * same key for it. The draft row has the fixed key `DRAFT_ID`.
 *
 * A number never equals a string, so one store can hold both kinds of row. Use
 * `Publication["id"]` rather than this type where a saved record is meant,
 * since an endpoint for a stored publication takes a publication id, not a row
 * key.
 */
type PublicationId = number | string;

/** The kind of input an attribute is edited with. */
type PublicationKeyType = "array" | "text" | "enumArray" | "number" | "book";

/**
 * Where a publication stands among the publications of its work, compared by
 * year only. A publication of the year the work was first translated is a
 * `first_translation`. A publication of the first year of a later translation
 * of the work is a `retranslation`. A publication of a later year than its
 * translation's first year is a `reissue`.
 *
 * Publications of the same year count as published at the same time, so a
 * work can have several first translations, and a translation several first
 * editions. The server judges the kind over every publication in the
 * database.
 */
type PublicationKind = "first_translation" | "retranslation" | "reissue";

/**
 * An earlier publication that a retranslation or a reissue follows, with its
 * translators as `authors` and its countries as codes. A retranslation
 * follows every publication of the year its work was first translated. A
 * reissue follows every publication of its translation's first year.
 */
type FollowedPublication = {
  id: number;
  title: string;
  year: number;
  authors: string[];
  publishers: string[];
  countries: string[];
};

/** Every act the log records, in the order a reader meets them. */
const HISTORY_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "restored",
  "merged",
  "unmerged",
  "renamed",
  "distinguished",
  "reconsidered",
] as const;

/** An act the log records. */
type PublicationHistoryAction = (typeof HISTORY_ACTIONS)[number];

/**
 * What an entry of the log changed: the old and new value of each field that
 * changed, the notes in each language included, and the sources added,
 * removed or reordered, or null when the sources did not change. A source
 * whose text changed in one language is one source removed and one added.
 */
type SnapshotDiff = {
  fields: Partial<
    Record<PublicationKey, { from: unknown; to: unknown }> &
      Record<NotesKey, { from: RichTextValue | null; to: RichTextValue | null }>
  >;
  sources: { added: Source[]; removed: Source[]; reordered: boolean } | null;
};

/** The fields of a publication that hold the names a rename changes. */
type NameField = "authors" | "originalAuthors" | "publishers";

/**
 * What a rename changed in the fields that hold names: for each of those fields
 * that changed, the names the rename removed (`from`) and the names it added
 * (`to`). A rename onto a free name removes the old name and adds the new one.
 * A fold into a name that a publication already credits only removes the old
 * name, so `to` is empty for that publication.
 */
type NameChange = Partial<Record<NameField, { from: string[]; to: string[] }>>;

/**
 * A publication as the log keeps it: the record's own fields, without the
 * surrogate id and the notes, and with the year as the number it is stored as.
 * A change to the notes is in the entry's `diff`.
 */
type PublicationSnapshot = Omit<Publication, "id" | "year" | NotesKey> & {
  year: number;
};

/**
 * A publication an entry of the log names besides its own, as it stood when
 * the entry was recorded, its notes in each language included. Identified,
 * unlike a snapshot: an entry names several of these at once, and two records
 * that were merged may well share a title.
 */
type OtherPublication = PublicationSnapshot &
  Partial<Record<NotesKey, RichTextValue | null>> & { id: number };

/**
 * One entry of a publication's log: the act, who did it and when, the record as
 * it stood afterwards, what changed, and whether the act can be undone.
 */
type PublicationHistoryEntry = {
  version: number;
  action: PublicationHistoryAction;
  actor: string;
  timestamp: string;
  snapshot: PublicationSnapshot;
  diff: SnapshotDiff | null;
  undoable: boolean;
  /**
   * The other publications this entry is about. The action says how: a merge
   * took them in (`merged`), an un-merge gave them back (`unmerged`), a
   * duplicate reviewer's decision ruled them not to be the same record
   * (`distinguished`) or put them back among the possible duplicates
   * (`reconsidered`), or the same rename changed them too (`renamed`).
   * Empty or absent on entries of any other action.
   */
  others?: OtherPublication[] | null;
  /**
   * What a `renamed` entry changed in the names. It is null on a rename whose
   * diff is null or changed no field that holds names, and null or absent on
   * entries of any other action.
   *
   * The log of the whole database lists each rename as one entry, whose
   * `others` are every other publication the rename changed, and whose name
   * change covers all of them.
   */
  nameChange?: NameChange | null;
};

/** An entry of the log of the whole database, with its publication's id. */
type FullHistoryEntry = PublicationHistoryEntry & { publicationId: number };

/** A publication that is deleted now, and when it was deleted. */
type DeletedPublicationEntry = { publication: Publication; deletedAt: string };

/** Every attribute, in the order the columns are shown. */
const ATTRIBUTES: PublicationKey[] = [
  "title",
  "originalTitle",
  "authors",
  "originalAuthors",
  "year",
  "countries",
  "publishers",
];

/** The kind of input each attribute is edited with. */
const ATTRIBUTE_TYPES: Record<PublicationKey, PublicationKeyType> = {
  authors: "array",
  originalAuthors: "array",
  originalTitle: "book",
  countries: "enumArray",
  publishers: "array",
  title: "text",
  year: "number",
};

/** Whether each attribute's column can be hidden. */
const ATTRIBUTE_IS_TOGGLEABLE: Record<PublicationKey, boolean> = {
  authors: true,
  originalAuthors: true,
  originalTitle: false,
  countries: true,
  publishers: true,
  title: false,
  year: true,
};

/** Whether each attribute's column is shown before anyone changes it. */
const DEFAULT_ATTRIBUTE_VISIBILITY: Record<PublicationKey, boolean> = {
  title: true,
  countries: true,
  year: true,
  publishers: true,
  authors: true,
  originalTitle: true,
  originalAuthors: true,
};

/**
 * The most characters the notes of a publication can hold in each language,
 * counted by `textLength`. The server refuses longer notes with the code
 * `too_long`.
 */
const NOTES_MAX_LENGTH = 10_000;

/** Returns the language that is not `language`. */
function otherLanguage(language: Language): Language {
  return language === "pt" ? "en" : "pt";
}

/** Returns whether a text is missing or holds nothing but white space. */
function isBlankText(text: string | null | undefined): boolean {
  return (text ?? "").trim() === "";
}

/** Returns a source with no text in either language. */
function emptySource(): Source {
  return { pt: null, en: null };
}

/**
 * Reads a source as the current shape: a source with its text in each
 * language. A string, the shape a source had before it had two languages, is
 * a source in Portuguese.
 */
function sourceOf(value: unknown): Source {
  if (typeof value === "string") return { pt: value, en: null };

  const held = (value ?? {}) as Partial<Record<Language, unknown>>;
  const text = (language: Language) =>
    typeof held[language] === "string" ? (held[language] as string) : null;

  return { pt: text("pt"), en: text("en") };
}

/** Returns whether a source has no text in either language. */
function isBlankSource(source: Source): boolean {
  return LANGUAGES.every((language) => isBlankText(source[language]));
}

/**
 * Returns the language a source is shown in to a reader of `language`: that
 * language when the source has text in it, and the other one otherwise.
 */
function shownLanguage(source: Source, language: Language): Language {
  return isBlankText(source[language]) ? otherLanguage(language) : language;
}

/** A text as it is shown, and the language it is written in. */
type ShownText = { language: Language; text: string };

/**
 * Returns each text a source has, with its language, Portuguese first. A
 * language the source has no text in is left out.
 */
function sourceTexts(source: Source): ShownText[] {
  return LANGUAGES.flatMap((language) =>
    isBlankText(source[language])
      ? []
      : [{ language, text: source[language]! }],
  );
}

/**
 * Returns a source as one line: each text it has, Portuguese first, joined by
 * a slash.
 */
function sourceLine(source: Source): string {
  return sourceTexts(source)
    .map(({ text }) => text)
    .join(" / ");
}

/**
 * The notes a reader of `language` is shown: the notes in that language when
 * they are not blank, the notes in the other language otherwise, or null when
 * both are blank or missing. Each comes with the language it is written in.
 */
function shownNotes(
  publication: Pick<Publication, NotesKey>,
  language: Language,
): { language: Language; value: RichTextValue } | null {
  const shown = [language, otherLanguage(language)].find(
    (candidate) => !isBlank(publication[NOTES_KEYS[candidate]]),
  );

  return shown
    ? { language: shown, value: publication[NOTES_KEYS[shown]]! }
    : null;
}

/**
 * Returns a publication with no id, an empty text in each text field and an
 * empty list in each list field. It has no notes keys, which saves as no
 * notes.
 */
function empty(): Publication {
  return {
    id: null,
    authors: [],
    countries: [],
    originalAuthors: [],
    originalTitle: "",
    publishers: [],
    title: "",
    year: "",
    sources: [],
  };
}

/**
 * Converts a row key written as text back into a `PublicationId`.
 *
 * Text made only of digits is a server id and becomes a number. Any other text
 * is returned unchanged. The store compares keys with `===`, so a server id
 * must come back as a number.
 */
function idFromText(text: string): PublicationId {
  return /^\d+$/.test(text) ? Number(text) : text;
}

/**
 * Returns whether `source` repeats `kept`: they have the same text in at least
 * one language, and no language in which both have text that differs.
 */
function repeats(source: Source, kept: Source): boolean {
  const shared = LANGUAGES.filter(
    (language) =>
      !isBlankText(source[language]) && !isBlankText(kept[language]),
  );

  return (
    shared.length > 0 &&
    shared.every((language) => source[language] === kept[language])
  );
}

/**
 * Returns `sources` in order, without a source that repeats one before it
 * (see `repeats`). The source kept takes the text of each language it lacks
 * from the sources left out.
 */
function joinedSources(sources: Source[]): Source[] {
  return sources.reduce<Source[]>((kept, source) => {
    const at = kept.findIndex((earlier) => repeats(source, earlier));

    return at < 0
      ? [...kept, source]
      : kept.map((earlier, index) =>
          index === at
            ? {
                pt: isBlankText(earlier.pt) ? source.pt : earlier.pt,
                en: isBlankText(earlier.en) ? source.en : earlier.en,
              }
            : earlier,
        );
  }, []);
}

/**
 * What one record would look like with others folded into it: the survivor's
 * own fields, the countries and publishers of all of them, their sources
 * joined, and their notes joined in each language.
 *
 * The sources are the survivor's, then each other record's, in order. A source
 * is left out when it repeats one already kept, meaning that they have the
 * same text in one language and no text that differs in the other. The source
 * kept takes the text of each language it lacked from the one left out.
 *
 * The notes in each language are the survivor's followed by each other
 * record's, as further blocks. Notes that are null or blank, or that equal
 * earlier ones, are left out. Two notes are equal when lodash's `isEqual`
 * finds them equal, which ignores the order of their objects' keys. When no
 * record has notes in a language, the result has the survivor's. A record read
 * from a page of the index has no notes to add.
 *
 * The server merges the records itself and decides the result. This function
 * repeats its rules, so the result can be shown before the merge is asked for.
 */
function merged(winner: Publication, losers: Publication[]): Publication {
  const all = [winner, ...losers];

  const union = (attribute: "countries" | "publishers") =>
    Array.from(new Set(all.flatMap((p) => p[attribute]))).sort();

  const notes = (key: NotesKey) => {
    const joined = uniqWith(
      all
        .map((p) => p[key])
        .filter((value): value is RichTextValue => !isBlank(value)),
      isEqual,
    );

    return joined.length > 0 ? joined.flat() : winner[key];
  };

  return {
    ...winner,
    countries: union("countries"),
    publishers: union("publishers"),
    sources: joinedSources(all.flatMap((p) => p.sources ?? [])),
    notesPt: notes("notesPt"),
    notesEn: notes("notesEn"),
  };
}

/** A field `contrast` compares: any attribute, or the sources. */
type ContrastedKey = PublicationKey | "sources";

/** A run of a value's text, and whether it differs from the other records. */
type Stretch = { text: string; differs: boolean };

/** One field of a record, compared with the same field of other records. */
type Contrast = {
  /** Each value the field holds, as the stretches its text splits into. */
  values: Stretch[][];
  /** True when the field is empty and at least one other record fills it. */
  lacking: boolean;
};

/**
 * The fields compared value by value. Every other field is compared word by
 * word.
 *
 * A year or a country code has no words to tell apart, and a source is a
 * citation that is either given or not.
 */
const WHOLE_VALUES: ContrastedKey[] = ["year", "countries", "sources"];

/**
 * Compares one field of `publication` with the same field of `others`, and
 * returns the field's values split into stretches that do or do not differ.
 *
 * A word differs when at least one of the other records lacks it anywhere in
 * that field. The comparison is exact, so a change of case or accent counts.
 * Consecutive words that differ form one stretch together with the spaces
 * between them. In the fields listed in `WHOLE_VALUES`, each value is one
 * stretch, and it differs when at least one of the other records lacks that
 * value.
 *
 * With no other records, nothing differs.
 */
function contrast(
  publication: Publication,
  others: Publication[],
  attribute: ContrastedKey,
): Contrast {
  const whole = WHOLE_VALUES.includes(attribute);
  const units = (values: string[]) =>
    new Set(whole ? values : values.flatMap((value) => value.split(/\s+/)));

  const own = valuesOf(publication, attribute);
  const theirs = others.map((other) => valuesOf(other, attribute));
  const held = theirs.map(units);
  const differs = (unit: string) => held.some((units) => !units.has(unit));

  return {
    values: own.map((value) =>
      whole
        ? [{ text: value, differs: differs(value) }]
        : stretches(value, differs),
    ),
    lacking: own.length === 0 && theirs.some((values) => values.length > 0),
  };
}

// Returns a field's values as trimmed text, leaving out empty ones. A year can
// arrive as a number, so every value is converted to text. The values of the
// sources are the texts of each source, its Portuguese text first.
function valuesOf(
  publication: Publication,
  attribute: ContrastedKey,
): string[] {
  const value =
    attribute === "sources"
      ? (publication.sources ?? []).flatMap((source) =>
          LANGUAGES.map((language) => source[language]),
        )
      : publication[attribute];

  return (Array.isArray(value) ? value : [value])
    .map((item) => String(item ?? "").trim())
    .filter((item) => item !== "");
}

// Splits `value` into stretches of words that do or do not differ. A space
// differs only when the words on both sides of it do, so a stretch that differs
// starts and ends with a word.
function stretches(
  value: string,
  differs: (word: string) => boolean,
): Stretch[] {
  // Words sit at even indices and the spaces between them at odd ones.
  const tokens = value.split(/(\s+)/);
  const flags = tokens.map((token, index) =>
    index % 2 === 0
      ? differs(token)
      : differs(tokens[index - 1]) && differs(tokens[index + 1]),
  );

  return tokens.reduce<Stretch[]>((result, text, index) => {
    const last = result[result.length - 1];

    return last?.differs === flags[index]
      ? [
          ...result.slice(0, -1),
          { text: last.text + text, differs: last.differs },
        ]
      : [...result, { text, differs: flags[index] }];
  }, []);
}

/**
 * An attribute's values as a reader sees them: each value's marked text where
 * the search matched it, and the value itself where it did not.
 *
 * Takes unknowns rather than strings because the wire does not always agree
 * with the model. `year` is an integer on the backend and text in a form, so it
 * arrives here as either.
 *
 * Countries are stored as codes and read as names, and `marked.countries` holds
 * a code rather than marked text. So a country that matched has its whole name
 * wrapped here, because the word that matched is often not in the name shown:
 * "Holanda" matches a name neither language shows.
 */
function shown(
  values: unknown[],
  attribute: PublicationKey,
  country: CountryNaming,
  marked?: Publication["marked"],
): string[] {
  const per = marked?.[attribute as PublicationListKey];

  if (attribute !== "countries") {
    return values.map((value, index) => per?.[index] ?? String(value ?? ""));
  }

  return values.map((value, index) => {
    const name = country.name(String(value ?? ""));

    return per?.[index] ? `[[${name}]]` : name;
  });
}

/**
 * A field as the index marked it, or as it is stored when the search did not
 * match it. The marks are the index's own, so what a reader is shown as the
 * answer is what was actually searched.
 */
function markedValue(
  publication: Publication,
  attribute: PublicationKey,
  locale: string,
  country: CountryNaming,
): string {
  const excerpt = publication.excerpts?.[attribute];
  if (excerpt) return excerpt;

  const value = publication[attribute];
  const values = shown(
    Array.isArray(value) ? value : [value],
    attribute,
    country,
    publication.marked,
  );

  return Array.isArray(value)
    ? new Intl.ListFormat(locale, { style: "long", type: "unit" }).format(
        values,
      )
    : values[0];
}

/**
 * Each value a field holds, paired with that value as the index marked it. The
 * value is what a term would search for, the label what is shown.
 *
 * The index marks each value separately, so a value carrying a comma is no
 * trouble. A value the search did not match reads as it is stored.
 *
 * Countries are the exception: `marked.countries` holds a code rather than
 * marked text, so `shown` is what wraps their names.
 */
function markedItems(
  publication: Publication,
  attribute: PublicationKey,
  locale: string,
  country: CountryNaming,
): { value: string; label: string }[] {
  const values = (publication[attribute] ?? []) as string[];
  const labels = shown(values, attribute, country, publication.marked);

  return values.map((value, index) => ({ value, label: labels[index] }));
}

/** How a publication's fields read to one reader. See `marking`. */
type Marking = {
  /** A whole field, its values joined as that reader's language joins a list. */
  value(publication: Publication, attribute: PublicationKey): string;
  /** Each of a field's values on its own, paired with how it reads. */
  items(
    publication: Publication,
    attribute: PublicationKey,
  ): { value: string; label: string }[];
};

/**
 * How a publication reads to one reader: their language, and how they name a
 * country.
 *
 * The functions it returns take only a publication and an attribute, so the
 * locale and the country naming are passed once, and code outside React can
 * use them too.
 */
function marking(locale: string, country: CountryNaming): Marking {
  return {
    value: (publication, attribute) =>
      markedValue(publication, attribute, locale, country),
    items: (publication, attribute) =>
      markedItems(publication, attribute, locale, country),
  };
}

/**
 * Each of a publication's sources as a reader of `language` is shown it: its
 * text in that language, or in the other language when it has none in that
 * one (see `shownLanguage`), with the language it is written in. The text is
 * the one the index marked where the search matched it, and the stored text
 * otherwise. A source with no text in either language is left out.
 */
function markedSources(
  publication: Publication,
  language: Language,
): ShownText[] {
  const marked = publication.marked?.sources;

  return (publication.sources ?? []).flatMap((source, index) => {
    const shown = shownLanguage(source, language);
    const text = source[shown];

    return isBlankText(text)
      ? []
      : [{ language: shown, text: marked?.[index]?.[shown] ?? text! }];
  });
}

/**
 * Returns the code of what is wrong, or an empty string when nothing is.
 *
 * Without `scope`, it returns the code of an error with the whole row. With
 * `scope`, it returns the code of the error with that field. A row has one kind
 * of error or the other, so asking for the kind it does not have returns an
 * empty string.
 *
 * The sentence for each code is in the `publicationError` messages. This module
 * runs outside React, where there is no locale to write a sentence in.
 */
function errorCode(error: PublicationError, scope?: ErrorScope): string {
  if (!error) {
    return "";
  } else if (!scope) {
    return typeof error === "string" ? error : "";
  } else {
    return typeof error === "string" ? "" : (error[scope] ?? "");
  }
}

/**
 * Returns the bounds an attribute's input takes: for the year, from 0 to the
 * current year. Other attributes have none.
 */
function define(attribute: PublicationKey): Record<string, unknown> {
  if (attribute === "year") {
    return { min: 0, max: new Date().getFullYear() };
  }
  return {};
}

/**
 * Returns a link to `path` that searches the publications for `term`. The link
 * carries `params` first and `term` as the `search` parameter after them, all
 * URL-encoded. It is `path` alone when there is no term and no other parameter.
 * An empty `path` gives only the query string, which a link resolves against
 * the current page.
 */
function searchHref(
  term: string | null | undefined,
  path = "/",
  params: Record<string, string> = {},
): string {
  const query = new URLSearchParams(params);
  if (term) query.set("search", term);

  const string = query.toString();
  return string ? `${path}?${string}` : path;
}

/**
 * The constants and helpers of the model, read as `Publication.X`. The value
 * shares its name with the `Publication` type.
 */
const Publication = {
  ATTRIBUTES,
  ATTRIBUTE_TYPES,
  ATTRIBUTE_IS_TOGGLEABLE,
  define,
  errorCode,
  marking,
  markedSources,
  empty,
  merged,
};

export {
  ATTRIBUTES,
  contrast,
  DEFAULT_ATTRIBUTE_VISIBILITY,
  define,
  emptySource,
  errorCode,
  empty,
  HISTORY_ACTIONS,
  idFromText,
  isBlankSource,
  isBlankText,
  LANGUAGES,
  marking,
  markedSources,
  merged,
  NOTES_KEYS,
  NOTES_MAX_LENGTH,
  otherLanguage,
  Publication,
  searchHref,
  shownLanguage,
  shownNotes,
  sourceLine,
  sourceOf,
  sourceTexts,
};
export type {
  Contrast,
  ErrorScope,
  ContrastedKey,
  DeletedPublicationEntry,
  FollowedPublication,
  PublicationValue,
  FullHistoryEntry,
  Language,
  NameChange,
  NameField,
  NotesKey,
  PublicationEntry,
  PublicationError,
  PublicationHistoryAction,
  PublicationHistoryEntry,
  PublicationId,
  Marking,
  Matched,
  PublicationKey,
  PublicationKeyType,
  PublicationKind,
  PublicationListKey,
  Resemblance,
  ShownText,
  SnapshotDiff,
  Source,
  ValidationResult,
};

import { isString } from "lodash";
import { Author } from "modules/author";
import { COUNTRIES, Country } from "modules/country";
import { Publisher } from "modules/publisher";

type Publication = {
  title: string;
  countries: string;
  year: string;
  publishers: string;
  authors: string;
  originalTitle: string;
  originalAuthors: string;
};

type PublicationKey = keyof Publication;
type PublicationError = null | string | Record<PublicationKey, string>;
type ValidationResult = { publication: Publication; errors: PublicationError };
type PublicationEntry = ValidationResult & { id: number };
type PublicationId = number;
type PublicationKeyType = "array" | "text" | "enum" | "enumArray" | "number";

const ATTRIBUTES: PublicationKey[] = [
  "originalTitle",
  "originalAuthors",
  "title",
  "authors",
  "year",
  "countries",
  "publishers",
];

const ATTRIBUTE_LABELS: Record<PublicationKey, string> = {
  authors: "Translators",
  originalAuthors: "Original Authors",
  originalTitle: "Original Title",
  countries: "Countries",
  publishers: "Publishers",
  title: "Title",
  year: "Year",
};

const ATTRIBUTE_TYPES: Record<PublicationKey, PublicationKeyType> = {
  authors: "array",
  originalAuthors: "array",
  originalTitle: "text",
  countries: "enumArray",
  publishers: "array",
  title: "text",
  year: "number",
};

const ATTRIBUTE_IS_TOGGLEABLE: Record<PublicationKey, boolean> = {
  authors: true,
  originalAuthors: true,
  originalTitle: false,
  countries: true,
  publishers: true,
  title: false,
  year: true,
};

const DEFAULT_ATTRIBUTE_VISIBILITY: Record<PublicationKey, boolean> = {
  title: true,
  countries: true,
  year: true,
  publishers: true,
  authors: true,
  originalTitle: true,
  originalAuthors: true,
};

const ERROR_MESSAGES: Record<string, string> = {
  conflict: "A publication with this data already exists",
  required: "This field is required and cannot be blank",
  integer: "This field should be an integer",
  incorrect_row_length: "Expected a different number of columns in csv",
  invalid_format: "Could not parse publications from the provided file",
  alpha2: "This field should be a valid ISO 3166-1 alpha 2 country code",
};

function empty(): Publication {
  return {
    authors: "",
    countries: "",
    originalAuthors: "",
    originalTitle: "",
    publishers: "",
    title: "",
    year: "",
  };
}

function describeValue(value: string, attribute: PublicationKey): string {
  if (attribute === "countries") {
    const country = COUNTRIES[value];
    if (country) {
      return value
        .split(",")
        .map((v) => COUNTRIES[v.trim()].label)
        .join(", ");
    } else {
      console.warn("Unknown country code: ", value);
      return value;
    }
  }
  return value;
}

function describeError(error: PublicationError, scope?: PublicationKey): string {
  if (!error) {
    return "";
  } else if (!scope) {
    if (isString(error)) {
      return ERROR_MESSAGES[error] || error;
    } else {
      return "";
    }
  } else {
    if (isString(error)) {
      return "";
    } else {
      return ERROR_MESSAGES[error[scope]] || error[scope];
    }
  }
}

function define(attribute: PublicationKey): Record<string, unknown> {
  if (attribute === "year") {
    return { min: 0, max: new Date().getFullYear() };
  }
  return {};
}

function autocomplete(value: string, attribute: "countries"): Promise<Country[]>;
function autocomplete(
  value: string,
  attribute: "originalAuthors",
): Promise<Author[]>;
function autocomplete(value: string, attribute: "authors"): Promise<Author[]>;
function autocomplete(value: string, attribute: "publishers"): Promise<[]>;
function autocomplete(value: string, attribute: string): Promise<[]>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function autocomplete(value: string, attribute: string): Promise<any> {
  switch (attribute) {
    case "authors":
    case "originalAuthors":
      return Author.REMOTE.search(value);
    case "publishers":
      return Publisher.REMOTE.search(value);

    case "countries": {
      const all = Object.values(COUNTRIES);
      const countries = value
        ? Object.values(COUNTRIES).filter((opt) =>
            opt.label.toLowerCase().startsWith(value.toLowerCase()),
          )
        : all;

      return new Promise<Country[]>((resolve) => resolve(countries));
    }
    default:
      return new Promise<[]>((resolve) => resolve([]));
  }
}

// Model namespace — constants + pure helpers. Same `Publication.X` shape the
// components already use (a type and a value can share the name in TS).
const Publication = {
  ATTRIBUTES,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_TYPES,
  ATTRIBUTE_IS_TOGGLEABLE,
  autocomplete,
  define,
  describeError,
  describeValue,
  empty,
};

export {
  ATTRIBUTES,
  ATTRIBUTE_IS_TOGGLEABLE,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_TYPES,
  COUNTRIES,
  DEFAULT_ATTRIBUTE_VISIBILITY,
  Publication,
  autocomplete,
  define,
  describeError,
  describeValue,
  empty,
};
export type {
  PublicationEntry,
  PublicationError,
  PublicationId,
  PublicationKey,
  PublicationKeyType,
  ValidationResult,
};

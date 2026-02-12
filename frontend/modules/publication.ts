import { request } from "app";
import { AxiosInstance } from "axios";
import { _NOTIFICATIONS, _notify } from "components/Notifications";
import { isString, range } from "lodash";
import hash from "object-hash";
import { atom, useAtomValue, useAtom } from "jotai";
import { atomFamily } from "jotai-family";
import { useStore } from "jotai";
import { useCallback } from "react";
import useDebounce from "utils/useDebounce";
import { Author } from "./author";
import { COUNTRIES, Country } from "./country";
import { Publisher } from "./publisher";
import store from "store";

type Publication = {
  title: string;
  countries: string;
  year: string;
  publishers: string;
  authors: string;
  originalTitle: string;
  originalAuthors: string;
};

type ValidationResult = { publication: Publication; errors: PublicationError };
type PublicationKey = keyof Publication;
type PublicationError = null | string | Record<PublicationKey, string>;
type PublicationEntry = ValidationResult & { id: number };
type PublicationId = number;

// ── Atoms ──────────────────────────────────────────────────────────────

const TOTAL_INDEX_COUNT = atom<number | null>(null);

const PUBLICATION_IDS = atom<PublicationId[] | undefined>(undefined);

const PUBLICATIONS = atomFamily((id: PublicationId) =>
  atom<Publication>(undefined as unknown as Publication),
);

const PUBLICATION_ERRORS = atomFamily((id: PublicationId) =>
  atom<PublicationError>(null),
);

const PUBLICATION_OVERRIDES = atomFamily((id: PublicationId) =>
  atom<Partial<Publication>>(undefined as unknown as Partial<Publication>),
);

const IS_PUBLICATION_DELETED = atomFamily((id: PublicationId) =>
  atom<boolean>(false),
);

const IS_VALIDATING = atom<boolean>(false);

const KEYWORDS = atom<string[] | undefined>(undefined);

const LAST_VALIDATED_VALUE = atomFamily((id: PublicationId) =>
  atom<string>(undefined as unknown as string),
);

const DEFAULT_ATTRIBUTE_VISIBILITY: Record<PublicationKey, boolean> = {
  title: true,
  countries: true,
  year: true,
  publishers: true,
  authors: true,
  originalTitle: true,
  originalAuthors: true,
};

const IS_ATTRIBUTE_VISIBLE = atomFamily((key: PublicationKey) =>
  atom<boolean>(DEFAULT_ATTRIBUTE_VISIBILITY[key]),
);

const ARE_ROW_IDS_VISIBLE = atom<boolean>(false);

const FOCUSED_ROW_ID = atom<number | undefined>(undefined);

// ── Derived atoms (read-only) ──────────────────────────────────────────

const VISIBLE_PUBLICATION_IDS = atom((get) => {
  return get(PUBLICATION_IDS)?.filter(
    (id) => !get(IS_PUBLICATION_DELETED(id)),
  );
});

const DELETED_PUBLICATIONS_IDS = atom((get) => {
  return get(PUBLICATION_IDS)?.filter((id) =>
    get(IS_PUBLICATION_DELETED(id)),
  );
});

const VISIBLE_PUBLICATIONS = atomFamily((id: PublicationId) =>
  atom((get) => ({
    ...get(PUBLICATIONS(id)),
    ...(get(PUBLICATION_OVERRIDES(id)) || {}),
  })),
);

const OVERRIDDEN_PUBLICATION_IDS = atom((get) => {
  return get(VISIBLE_PUBLICATION_IDS)?.filter((id) =>
    get(PUBLICATION_OVERRIDES(id)),
  );
});

const OVERRIDDEN_PUBLICATION_COUNT = atom((get) => {
  return get(OVERRIDDEN_PUBLICATION_IDS)?.length || 0;
});

const VISIBLE_PUBLICATION_COUNT = atom((get) => {
  return get(VISIBLE_PUBLICATION_IDS)?.length || 0;
});

const IS_PUBLICATION_VALID = atomFamily((id: PublicationId) =>
  atom((get) => !get(PUBLICATION_ERRORS(id))),
);

const VALID_PUBLICATIONS_IDS = atom((get) => {
  return get(PUBLICATION_IDS)
    ?.filter((id) => !get(IS_PUBLICATION_DELETED(id)))
    .filter((id) => get(IS_PUBLICATION_VALID(id)));
});

const VALID_PUBLICATION_COUNT = atom((get) => {
  return get(VALID_PUBLICATIONS_IDS)?.length || 0;
});

const DELETED_PUBLICATION_COUNT = atom((get) => {
  return get(DELETED_PUBLICATIONS_IDS)?.length || 0;
});

const TOTAL_PUBLICATION_COUNT = atom((get) => {
  return get(PUBLICATION_IDS)?.length || 0;
});

const VISIBLE_ATTRIBUTES = atom((get) => {
  return Publication.ATTRIBUTES.filter((key) =>
    get(IS_ATTRIBUTE_VISIBLE(key)),
  );
});

const HIDDEN_ATTRIBUTES = atom((get) => {
  return Publication.ATTRIBUTES.filter(
    (key) => !get(IS_ATTRIBUTE_VISIBLE(key)),
  );
});

type CompositeAttributeId = `${PublicationId}.${PublicationKey}`;

const PUBLICATION_ATTRIBUTE = atomFamily((compositeId: CompositeAttributeId) =>
  atom((get) => {
    const [id, key] = compositeId.split(".") as [string, PublicationKey];
    return get(VISIBLE_PUBLICATIONS(parseInt(id)))[key];
  }),
);

const PUBLICATION_ERROR_DESCRIPTION = atomFamily((id: PublicationId) =>
  atom((get) => {
    return Publication.describeError(get(PUBLICATION_ERRORS(id)));
  }),
);

const PUBLICATION_ATTRIBUTE_ERROR_DESCRIPTION = atomFamily(
  (compositeId: CompositeAttributeId) =>
    atom((get) => {
      const [id, key] = compositeId.split(".") as [string, PublicationKey];
      return Publication.describeError(
        get(PUBLICATION_ERRORS(parseInt(id))),
        key,
      );
    }),
);

const PUBLICATION = atomFamily((id: PublicationId) =>
  atom((get) => get(PUBLICATIONS(id)) || null),
);

const NULL_PUBLICATION_ATOM = atom<Publication | null>(null);

// ── Error messages ─────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  conflict: "A publication with this data already exists",
  required: "This field is required and cannot be blank",
  integer: "This field should be an integer",
  incorrect_row_length: "Expected a different number of columns in csv",
  invalid_format: "Could not parse publications from the provided file",
  alpha2: "This field should be a valid ISO 3166-1 alpha 2 country code",
};

// ── Types ──────────────────────────────────────────────────────────────

type PublicationKeyType = "array" | "text" | "enum" | "enumArray" | "number";
type Resetter = () => void;
type SetterOrUpdater<T> = React.Dispatch<React.SetStateAction<T>>;

// ── Module interface & implementation ──────────────────────────────────

interface PublicationModule {
  ATTRIBUTES: PublicationKey[];
  ATTRIBUTE_LABELS: Record<PublicationKey, string>;
  ATTRIBUTE_TYPES: Record<PublicationKey, PublicationKeyType>;
  ATTRIBUTE_IS_TOGGLEABLE: Record<PublicationKey, boolean>;
  NEW_ROW_ID: PublicationId;

  STORE: {
    initialize(): void;

    useVisibleIds(): PublicationId[] | undefined;
    useValue(id: PublicationId): Publication;
    useError(id: PublicationId): PublicationError;
    useErrorDescription(id: PublicationId): string;
    useSetAll(): (entries: PublicationEntry[]) => void;
    useSetDeleted(): (ids: PublicationId[], isDeleted?: boolean) => void;
    useResetAll(): Resetter;
    useResetDeleted(): Resetter;
    useResetOverridden(): Resetter;
    useOverriddenIds(): PublicationId[] | undefined;
    useOverrideValue(id: PublicationId): Partial<Publication>;
    useAddNew(): () => PublicationId;
    useDuplicate(): (ids: Set<number>) => number[];

    useIsValid(id: PublicationId): boolean;
    useIsFocused(id: PublicationId): boolean;

    useVisibleCount(): number;
    useValidCount(): number;
    useDeletedCount(): number;
    useOverriddenCount(): number;
    useTotalCount(): number;

    useIsValidating(): boolean;

    useKeywords(): string[] | undefined;
    useIndexCount(): number | null;
    usePublication(id: PublicationId | undefined): Publication | null;

    from: (s: typeof store) => {
      getVisibleIds(): PublicationId[] | undefined;
      getAllVisible(): Publication[] | undefined;
      getValue(id: PublicationId): Publication;
      getFocusedRowId(): PublicationId | undefined;
      isDeleted(id: PublicationId): boolean;
      isValid(id: PublicationId): boolean;
    };

    with: (s: typeof store) => {
      setPublications(entries: PublicationEntry[]): void;
      setErrors(entries: PublicationEntry[]): void;
      setFocusedRowId(id: PublicationId | undefined): void;
    };

    ATTRIBUTES: {
      useVisible(): PublicationKey[];
      useHidden(): PublicationKey[];
      useSetVisible(): (keys: PublicationKey[], isVisible?: boolean) => void;
      useIsVisible(key: PublicationKey): boolean;
      useResetAll(): Resetter;
      useValue<K extends PublicationKey>(
        id: PublicationId,
        key: K,
      ): Publication[K];
      useOverride(): (
        id: PublicationId,
        attribute: PublicationKey,
        value: string,
      ) => void;
      useErrorDescription(id: PublicationId, key: PublicationKey): string;

      useAreRowIdsVisible(): [boolean, SetterOrUpdater<boolean>];
    };
  };

  REMOTE: {
    request: typeof request;
    useRequest<T = void, P = void>(
      factory: (
        params: { store: typeof store },
        http: AxiosInstance,
      ) => (args: P) => Promise<T>,
    ): (args: P) => Promise<T>;

    useIndex(): ({ search }: { search?: string }) => Promise<void>;
    useBulk(): () => Promise<Publication[]>;
    useValidate(): (ids: PublicationId[]) => Promise<void>;
  };

  autocomplete(value: string, attribute: "countries"): Promise<Country[]>;
  autocomplete(value: string, attribute: "originalAuthors"): Promise<Author[]>;
  autocomplete(value: string, attribute: "authors"): Promise<Author[]>;
  autocomplete(value: string, attribute: "publishers"): Promise<[]>;
  autocomplete(value: string, attribute: string): Promise<[]>;

  define(attribute: PublicationKey): Record<string, unknown>;

  describeValue(value: string, attribute: PublicationKey): string;
  describeError(error: PublicationError, scope?: PublicationKey): string;
  empty(): Publication;
}

const Publication: PublicationModule = {
  ATTRIBUTES: [
    "originalTitle",
    "originalAuthors",
    "title",
    "authors",
    "year",
    "countries",
    "publishers",
  ],
  ATTRIBUTE_LABELS: {
    authors: "Translators",
    originalAuthors: "Original Authors",
    originalTitle: "Original Title",
    countries: "Countries",
    publishers: "Publishers",
    title: "Title",
    year: "Year",
  },

  ATTRIBUTE_TYPES: {
    authors: "array",
    originalAuthors: "array",
    originalTitle: "text",
    countries: "enumArray",
    publishers: "array",
    title: "text",
    year: "number",
  },

  ATTRIBUTE_IS_TOGGLEABLE: {
    authors: true,
    originalAuthors: true,
    originalTitle: false,
    countries: true,
    publishers: true,
    title: false,
    year: true,
  },

  NEW_ROW_ID: -1,
  STORE: {
    initialize() {
      store.set(PUBLICATIONS(Publication.NEW_ROW_ID), Publication.empty());
    },

    useVisibleIds() {
      return useAtomValue(VISIBLE_PUBLICATION_IDS);
    },
    useValue(id) {
      return useAtomValue(VISIBLE_PUBLICATIONS(id));
    },
    useError(id) {
      return useAtomValue(PUBLICATION_ERRORS(id));
    },

    useAddNew() {
      const s = useStore();
      return useCallback(() => {
        const ids = s.get(PUBLICATION_IDS);

        if (!ids) throw "Can not add new publications: entries not loaded.";

        const id = ids.length;
        const p = s.get(VISIBLE_PUBLICATIONS(Publication.NEW_ROW_ID));

        s.set(PUBLICATION_IDS, [...ids, id]);
        s.set(PUBLICATIONS(id), p);

        s.set(
          PUBLICATION_OVERRIDES(Publication.NEW_ROW_ID),
          undefined as unknown as Partial<Publication>,
        );
        return id;
      }, [s]);
    },

    useDuplicate() {
      const s = useStore();
      return useCallback(
        (duplicateIds: Set<number>) => {
          const ids = s.get(PUBLICATION_IDS);

          if (!ids)
            throw "Can not duplicate publications: entries not loaded.";

          const newIds = range(
            ids.length + 1,
            ids.length + 1 + duplicateIds.size,
          );

          let duplicationCount = 0;
          const orderedIds = ids.reduce<number[]>((acc, current) => {
            if (duplicateIds.has(current)) {
              const newId = newIds[duplicationCount++];
              s.set(PUBLICATIONS(newId), s.get(PUBLICATIONS(current)));
              return [...acc, current, newId];
            }
            return [...acc, current];
          }, []);

          s.set(PUBLICATION_IDS, orderedIds);
          return newIds;
        },
        [s],
      );
    },

    useErrorDescription(id) {
      return useAtomValue(PUBLICATION_ERROR_DESCRIPTION(id));
    },
    useSetAll() {
      const s = useStore();
      return useCallback(
        (entries: PublicationEntry[]) => {
          const ids = entries.map(({ id }) => id);
          s.set(PUBLICATION_IDS, ids);

          entries.forEach(({ id, publication, errors }) => {
            s.set(PUBLICATIONS(id), publication);
            s.set(PUBLICATION_ERRORS(id), errors);
          });
        },
        [s],
      );
    },
    useSetDeleted() {
      const s = useStore();
      return useCallback(
        (ids: PublicationId[], isDeleted = true) => {
          ids.forEach((id) => s.set(IS_PUBLICATION_DELETED(id), isDeleted));
        },
        [s],
      );
    },
    useResetAll() {
      const s = useStore();
      return useCallback(() => {
        const ids = s.get(PUBLICATION_IDS);
        ids?.forEach((id) => {
          s.set(PUBLICATIONS(id), undefined as unknown as Publication);
          s.set(
            PUBLICATION_OVERRIDES(id),
            undefined as unknown as Partial<Publication>,
          );
          s.set(PUBLICATION_ERRORS(id), null);
          s.set(IS_PUBLICATION_DELETED(id), false);
        });
        s.set(PUBLICATION_IDS, undefined);
        s.set(FOCUSED_ROW_ID, undefined);
      }, [s]);
    },
    useResetDeleted() {
      const s = useStore();
      return useCallback(() => {
        const deleted = s.get(DELETED_PUBLICATIONS_IDS);
        deleted?.forEach((id) => {
          s.set(IS_PUBLICATION_DELETED(id), false);
        });
      }, [s]);
    },

    useResetOverridden() {
      const s = useStore();
      return useCallback(() => {
        const ids = s.get(PUBLICATION_IDS);
        ids?.forEach((id) => {
          s.set(
            PUBLICATION_OVERRIDES(id),
            undefined as unknown as Partial<Publication>,
          );
        });
      }, [s]);
    },
    useOverriddenIds() {
      return useAtomValue(OVERRIDDEN_PUBLICATION_IDS);
    },
    useOverrideValue(id) {
      return useAtomValue(PUBLICATION_OVERRIDES(id));
    },

    useIsValid(id) {
      return useAtomValue(IS_PUBLICATION_VALID(id));
    },

    useVisibleCount() {
      return useAtomValue(VISIBLE_PUBLICATION_COUNT);
    },
    useDeletedCount() {
      return useAtomValue(DELETED_PUBLICATION_COUNT);
    },
    useValidCount() {
      return useAtomValue(VALID_PUBLICATION_COUNT);
    },
    useOverriddenCount() {
      return useAtomValue(OVERRIDDEN_PUBLICATION_COUNT);
    },
    useTotalCount() {
      return useAtomValue(TOTAL_PUBLICATION_COUNT);
    },

    useIsValidating() {
      return useAtomValue(IS_VALIDATING);
    },

    useKeywords() {
      return useAtomValue(KEYWORDS);
    },

    useIsFocused(id) {
      return id === useAtomValue(FOCUSED_ROW_ID);
    },

    useIndexCount() {
      return useAtomValue(TOTAL_INDEX_COUNT);
    },

    usePublication(id) {
      return useAtomValue(
        id !== undefined ? PUBLICATION(id) : NULL_PUBLICATION_ATOM,
      );
    },

    from: (s) => ({
      getVisibleIds() {
        return s.get(VISIBLE_PUBLICATION_IDS);
      },
      getValue(id) {
        return s.get(VISIBLE_PUBLICATIONS(id));
      },
      getAllVisible() {
        const ids = s.get(VISIBLE_PUBLICATION_IDS);
        return ids?.map((id) => s.get(VISIBLE_PUBLICATIONS(id)));
      },
      getFocusedRowId() {
        return s.get(FOCUSED_ROW_ID);
      },
      isDeleted(id) {
        return s.get(IS_PUBLICATION_DELETED(id));
      },
      isValid(id) {
        return s.get(IS_PUBLICATION_VALID(id));
      },
    }),

    with: (s) => ({
      setPublications(entries) {
        const ids = entries.map(({ id }) => id);
        s.set(PUBLICATION_IDS, ids);
        entries.forEach(({ id, publication }) => {
          s.set(PUBLICATIONS(id), publication);
        });
      },
      setErrors(entries) {
        entries.forEach(({ id, errors }) => {
          s.set(PUBLICATION_ERRORS(id), errors);
        });
      },
      setFocusedRowId(id) {
        s.set(FOCUSED_ROW_ID, id);
      },
    }),

    ATTRIBUTES: {
      useVisible() {
        return useAtomValue(VISIBLE_ATTRIBUTES);
      },
      useHidden() {
        return useAtomValue(HIDDEN_ATTRIBUTES);
      },

      useIsVisible(key) {
        return useAtomValue(IS_ATTRIBUTE_VISIBLE(key));
      },
      useSetVisible() {
        const s = useStore();
        return useCallback(
          (keys: PublicationKey[], isVisible = true) => {
            keys.map((key) => s.set(IS_ATTRIBUTE_VISIBLE(key), isVisible));
          },
          [s],
        );
      },
      useResetAll() {
        const s = useStore();
        return useCallback(() => {
          Publication.ATTRIBUTES.forEach((key) => {
            s.set(IS_ATTRIBUTE_VISIBLE(key), DEFAULT_ATTRIBUTE_VISIBILITY[key]);
          });
        }, [s]);
      },
      useValue<K extends PublicationKey>(id: PublicationId, key: K) {
        const compositeId: CompositeAttributeId = `${id}.${key}`;

        return useAtomValue(
          PUBLICATION_ATTRIBUTE(compositeId),
        ) as Publication[K];
      },
      useOverride() {
        const s = useStore();
        return useCallback(
          (id: PublicationId, attribute: PublicationKey, value: string) => {
            const current = s.get(PUBLICATION_OVERRIDES(id));
            s.set(PUBLICATION_OVERRIDES(id), {
              ...current,
              [attribute]: value,
            });
          },
          [s],
        );
      },

      useErrorDescription(id, key) {
        const compositeId: CompositeAttributeId = `${id}.${key}`;
        return useAtomValue(
          PUBLICATION_ATTRIBUTE_ERROR_DESCRIPTION(compositeId),
        );
      },

      useAreRowIdsVisible() {
        return useAtom(ARE_ROW_IDS_VISIBLE);
      },
    },
  },

  REMOTE: {
    async request(cb) {
      try {
        return await request(cb);
      } catch (error) {
        throw Publication.describeError(error as PublicationError) || error;
      }
    },

    useRequest(factory) {
      const { request } = Publication.REMOTE;
      const s = useStore();
      return useCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (args: any) => {
          try {
            return await request((http) =>
              factory({ store: s }, http)(args),
            );
          } catch (error) {
            s.set(
              _NOTIFICATIONS,
              _notify({ message: error as string, level: "warning" })(
                s.get(_NOTIFICATIONS),
              ),
            );
            throw error;
          }
        },
        [s],
      );
    },

    useIndex() {
      return useDebounce(
        Publication.REMOTE.useRequest(
          ({ store: s }, http) =>
            async ({ search = undefined }) => {
              const url = search
                ? `publications?search=${search}`
                : "publications";

              type Result = { entries: Publication[]; keywords?: string[] };

              s.set(PUBLICATION_IDS, undefined);

              const { data, headers } = await http.get<Result>(url);
              const { entries, keywords } = data;

              if (headers.xTotalCount) {
                s.set(TOTAL_INDEX_COUNT, parseInt(headers.xTotalCount));
              }
              s.set(KEYWORDS, keywords);
              s.set(PUBLICATION_IDS, range(entries.length));
              entries.forEach((publication, index) =>
                s.set(PUBLICATIONS(index), publication),
              );
            },
        ),
        350,
      );
    },

    useBulk() {
      return Publication.REMOTE.useRequest(
        ({ store: s }, http) =>
          async function () {
            const publications =
              Publication.STORE.from(s).getAllVisible();

            s.set(PUBLICATION_IDS, undefined);

            const { data } = await http.post<Publication[]>(
              "publications/bulk",
              publications,
            );
            return data;
          },
      );
    },
    useValidate() {
      return Publication.REMOTE.useRequest(
        ({ store: s }, http) =>
          async (ids: PublicationId[]) => {
            s.set(IS_VALIDATING, true);
            const publications = ids
              .map((id) => ({
                id,
                publication: s.get(VISIBLE_PUBLICATIONS(id)),
              }))
              .map(({ id, publication }) => ({
                id,
                publication,
                hash: hash(publication),
              }))
              .filter(({ id, hash: h }) => {
                const lastValidatedValue = s.get(LAST_VALIDATED_VALUE(id));
                return h !== lastValidatedValue;
              })
              .map(({ id, publication, hash: h }) => {
                s.set(LAST_VALIDATED_VALUE(id), h);
                return publication;
              });

            if (publications.length > 0) {
              const { data } = await http.post<ValidationResult[]>(
                "publications/validate",
                publications,
              );

              Publication.STORE.with(s).setErrors(
                data.map((entry, index) => ({ ...entry, id: ids[index] })),
              );
            }
            s.set(IS_VALIDATING, false);
          },
      );
    },
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autocomplete(value, attribute): Promise<any> {
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
  },

  define(attribute) {
    if (attribute === "year") {
      return { min: 0, max: new Date().getFullYear() };
    }
    return {};
  },

  describeValue(value, attribute) {
    if (attribute === "countries") {
      const countries = COUNTRIES[value];
      if (countries) {
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
  },

  describeError(error, scope) {
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
  },

  empty() {
    return {
      authors: "",
      countries: "",
      originalAuthors: "",
      originalTitle: "",
      publishers: "",
      title: "",
      year: "",
    };
  },
};

export { COUNTRIES, Publication };
export type {
  PublicationEntry,
  PublicationError,
  PublicationId,
  PublicationKey,
  PublicationKeyType,
  ValidationResult,
};

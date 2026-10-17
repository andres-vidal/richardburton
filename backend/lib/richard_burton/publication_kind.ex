defmodule RichardBurton.Publication.Kind do
  @moduledoc """
  Tells whether a publication is a first translation of its work, a
  retranslation or a reissue, and which earlier publications it follows.

  Works and translations are those `RichardBurton.Publication.Insights`
  defines. Publications are compared by year only. Two publications of the
  same year count as published at the same time, whatever order they were
  entered in. Terms used here:

    * **first year** — the year of the earliest publication of a work, or of a
      translation.
    * **first edition** — a publication of a translation in that translation's
      first year. A translation published several times in its first year has
      several first editions.
    * **kind** — a publication is a `"reissue"` when it was published in a
      later year than its translation's first year. Otherwise it is a first
      edition, which is a `"first_translation"` when its translation's first
      year is the work's first year, and a `"retranslation"` when its
      translation's first year is later. A work has as many first translations
      as it has publications in its first year.
    * **follows** — the earlier publications that a retranslation or a reissue
      comes after. A reissue follows every first edition of its translation. A
      retranslation follows every publication of its work in the work's first
      year, which are the work's first translations. A first translation
      follows none.

  A publication's kind depends on the publications it is compared with.
  `ranked/1` compares the publications of a query with each other, and `of/1`
  compares one publication with every publication of its work that is not
  deleted.
  """

  import Ecto.Query

  alias RichardBurton.Publication
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook

  # The kinds, in the order the module doc defines them.
  @kinds ["first_translation", "retranslation", "reissue"]

  @doc """
  Returns the kinds: `"first_translation"`, `"retranslation"` and
  `"reissue"`, in that order.
  """
  @spec all() :: [String.t()]
  def all, do: @kinds

  @doc """
  Returns a query with one row for each publication of `source`. Each row has
  the publication's `id`, its `kind`, and `follows`, the ids of the
  publications it follows in ascending order. `follows` is an empty list for a
  first translation.

  `source` is a queryable of publications whose rows have an `id` and a
  `year`, such as `RichardBurton.FlatPublication` or a query of
  `RichardBurton.Publication`. Each publication is compared only with the
  other publications of `source`.
  """
  @spec ranked(Ecto.Queryable.t()) :: Ecto.Query.t()
  def ranked(source) do
    # `translation_year` and `work_year` are the first years of the
    # publication's translation and of its work.
    dated =
      from(s in source,
        join: p in Publication,
        on: p.id == s.id,
        join: tb in TranslatedBook,
        on: tb.id == p.translated_book_id,
        windows: [
          translation: [partition_by: p.translated_book_id],
          work: [partition_by: tb.original_book_id]
        ],
        select: %{
          id: s.id,
          year: s.year,
          translation: p.translated_book_id,
          work: tb.original_book_id,
          translation_year: over(min(s.year), :translation),
          work_year: over(min(s.year), :work)
        }
      )

    # `first_editions` holds the ids of the first editions of the publication's
    # translation, and `work_firsts` the ids of the publications of its work in
    # the work's first year. Each window orders its partition by id and spans
    # all of it, so each list is in ascending order.
    kinded =
      from(d in subquery(dated),
        windows: [
          translation: [
            partition_by: d.translation,
            order_by: d.id,
            frame: fragment("ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING")
          ],
          work: [
            partition_by: d.work,
            order_by: d.id,
            frame: fragment("ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING")
          ]
        ],
        select: %{
          id: d.id,
          kind:
            fragment(
              "CASE WHEN ? > ? THEN 'reissue' WHEN ? > ? THEN 'retranslation' ELSE 'first_translation' END",
              d.year,
              d.translation_year,
              d.translation_year,
              d.work_year
            ),
          first_editions:
            over(
              filter(fragment("array_agg(?)", d.id), d.year == d.translation_year),
              :translation
            ),
          work_firsts: over(filter(fragment("array_agg(?)", d.id), d.year == d.work_year), :work)
        }
      )

    from(k in subquery(kinded),
      select: %{
        id: k.id,
        kind: k.kind,
        follows:
          fragment(
            "CASE ? WHEN 'reissue' THEN ? WHEN 'retranslation' THEN ? ELSE '{}' END",
            k.kind,
            k.first_editions,
            k.work_firsts
          )
      }
    )
  end

  @doc """
  Returns the kind of `publication` and the publications it follows, as a map
  with `kind` and `follows`. `follows` lists publications preloaded as
  `RichardBurton.Publication.with_ids/1` preloads them, in ascending order of
  id, and is empty for a first translation.

  `publication` is compared with every publication of its work that is not
  deleted. They are read from the publications table rather than from the
  index, so a publication written since the index was last refreshed is
  counted. `publication` must not be deleted, and needs its translated book
  loaded.
  """
  @spec of(Publication.t()) :: %{kind: String.t(), follows: [Publication.t()]}
  def of(publication = %Publication{translated_book: %TranslatedBook{original_book_id: work}}) do
    live =
      from(p in Publication,
        join: tb in TranslatedBook,
        on: tb.id == p.translated_book_id,
        where: is_nil(p.deleted_at) and tb.original_book_id == ^work
      )

    %{kind: kind, follows: follows} =
      from(r in subquery(ranked(live)), where: r.id == ^publication.id)
      |> Repo.one!()

    %{kind: kind, follows: Publication.with_ids(follows)}
  end
end

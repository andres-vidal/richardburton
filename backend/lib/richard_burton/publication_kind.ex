defmodule RichardBurton.Publication.Kind do
  @moduledoc """
  Tells whether a publication is the first translation of its work, a
  retranslation or a reissue, and which earlier publication it follows.

  Works and translations are those `RichardBurton.Publication.Insights`
  defines. The publications of a work are ordered by year, and by id within a
  year. Terms used here:

    * **kind** — a publication is a `"reissue"` when an earlier publication of
      its translation exists. Otherwise it is the first publication of its
      translation, which is a `"first_translation"` when its translation is
      the translation of the work's earliest publication, and a
      `"retranslation"` when the work had an earlier translation.
    * **follows** — the earlier publication that a retranslation or a reissue
      comes after. A reissue follows the first publication of its translation.
      A retranslation follows the work's earliest publication, which is the
      first publication of the work's first translation. A first translation
      follows none.

  A publication's kind depends on the publications it is compared with.
  `ranked/1` compares the publications of a query with each other, and `of/1`
  compares one publication with every publication that is not deleted.
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
  the publication's `id`, its `kind`, and `follows`, the id of the publication
  it follows, or nil for a first translation.

  `source` is a queryable of publications whose rows have an `id` and a
  `year`, such as `RichardBurton.FlatPublication` or a query of
  `RichardBurton.Publication`. Each publication is compared only with the
  other publications of `source`.
  """
  @spec ranked(Ecto.Queryable.t()) :: Ecto.Query.t()
  def ranked(source) do
    # `edition` numbers the publications of a translation from 1, and
    # `first_edition` is the id of the translation's first publication.
    # `first_translation` is the translation of the work's earliest
    # publication, and `earliest` is the id of that publication.
    ordered =
      from(s in source,
        join: p in Publication,
        on: p.id == s.id,
        join: tb in TranslatedBook,
        on: tb.id == p.translated_book_id,
        windows: [
          translation: [partition_by: p.translated_book_id, order_by: [s.year, s.id]],
          work: [partition_by: tb.original_book_id, order_by: [s.year, s.id]]
        ],
        select: %{
          id: s.id,
          translation: p.translated_book_id,
          edition: over(row_number(), :translation),
          first_edition: over(first_value(s.id), :translation),
          first_translation: over(first_value(p.translated_book_id), :work),
          earliest: over(first_value(s.id), :work)
        }
      )

    from(r in subquery(ordered),
      select: %{
        id: r.id,
        kind:
          fragment(
            "CASE WHEN ? > 1 THEN 'reissue' WHEN ? = ? THEN 'first_translation' ELSE 'retranslation' END",
            r.edition,
            r.translation,
            r.first_translation
          ),
        follows:
          fragment(
            "CASE WHEN ? > 1 THEN ? WHEN ? <> ? THEN ? END",
            r.edition,
            r.first_edition,
            r.translation,
            r.first_translation,
            r.earliest
          )
      }
    )
  end

  @doc """
  Returns the kind of `publication` and the publication it follows, as a map
  with `kind` and `follows`. `follows` is a publication preloaded as
  `RichardBurton.Publication.with_ids/1` preloads it, or nil for a first
  translation.

  `publication` is compared with every publication of its work that is not
  deleted. They are read from the publications table rather than from the
  index, so a publication written since the index was last refreshed is
  counted. `publication` must not be deleted, and needs its translated book
  loaded.
  """
  @spec of(Publication.t()) :: %{kind: String.t(), follows: Publication.t() | nil}
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

    %{kind: kind, follows: follows && hd(Publication.with_ids([follows]))}
  end
end

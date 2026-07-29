defmodule RichardBurton.Repo.Migrations.SoftDeletePublications do
  use Ecto.Migration

  @moduledoc """
  Soft-deletable publications with an append-only history log.

  Deleting a publication stamps `deleted_at` instead of removing the row, so
  nothing cascades and the record can be restored. Every read path goes through
  `flat_publications`, so filtering deleted rows there hides them from the
  index, search (the materialized views build on the view), exports, and the
  conflict checks in one place. The composite-key unique index becomes partial
  (live rows only) so a tombstone never blocks re-importing the same record.

  `publication_history` records one immutable row per mutation — action, a
  flattened snapshot, the acting user, and a per-publication version. A guard
  trigger makes it append-only at the database level: the app role owns the
  table, so revoked grants would not bind, and unlike the per-statement refresh
  triggers removed in 20260724130000 this one costs nothing — it only fires on
  UPDATE/DELETE, which never happen legitimately. (TRUNCATE stays allowed for
  the e2e reset.)
  """

  def up do
    alter table(:publications) do
      add(:deleted_at, :utc_datetime)
    end

    # Same name, now partial: the changeset's unique_constraint keeps matching,
    # and only live rows contend for the composite key.
    execute("DROP INDEX publications_composite_key")

    execute("""
    CREATE UNIQUE INDEX publications_composite_key
    ON publications (title, year, publishers_fingerprint, translated_book_fingerprint, countries_fingerprint)
    WHERE deleted_at IS NULL
    """)

    execute(flat_publications_sql(live_only: true))

    create table(:publication_history) do
      # No FK: the log is independent of the publication tables' lifecycle.
      add(:publication_id, :bigint, null: false)
      add(:version, :integer, null: false)
      add(:action, :string, null: false)
      add(:snapshot, :map, null: false)
      add(:actor, :string, null: false)
      timestamps(updated_at: false)
    end

    create(unique_index(:publication_history, [:publication_id, :version]))

    execute("""
    CREATE FUNCTION forbid_history_mutation()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$ BEGIN
      RAISE EXCEPTION 'publication_history is append-only';
    END $$
    """)

    execute("""
    CREATE TRIGGER publication_history_append_only
    BEFORE UPDATE OR DELETE
    ON publication_history
    FOR EACH STATEMENT
    EXECUTE PROCEDURE forbid_history_mutation()
    """)
  end

  def down do
    execute("DROP TRIGGER publication_history_append_only ON publication_history")
    execute("DROP FUNCTION forbid_history_mutation")
    drop(table(:publication_history))

    # Restore the unfiltered view before dropping the column it references.
    execute(flat_publications_sql(live_only: false))

    execute("DROP INDEX publications_composite_key")

    execute("""
    CREATE UNIQUE INDEX publications_composite_key
    ON publications (title, year, publishers_fingerprint, translated_book_fingerprint, countries_fingerprint)
    """)

    alter table(:publications) do
      remove(:deleted_at)
    end
  end

  # The current view definition (20260716120000), with soft-deleted rows
  # filtered out of the base CTE when live_only — the single choke point that
  # hides them from the index, search, exports, and conflict validation.
  defp flat_publications_sql(live_only: live_only) do
    where = if live_only, do: "WHERE publications.deleted_at IS NULL", else: ""

    """
    CREATE OR REPLACE VIEW flat_publications AS
    WITH
    CTE_publications AS (
      SELECT
          publications.id AS id,
          publications.title AS title,
          publications.year AS year,
          authors.name AS original_author,
          translators.name AS translator,
          original_books.title AS original_title,
          publications.translated_book_fingerprint AS translated_book_fingerprint,
          publications.countries_fingerprint AS countries_fingerprint,
          publications.publishers_fingerprint AS publishers_fingerprint,
          countries.code AS country,
          publishers.name AS publisher
      FROM
          translated_books
      INNER JOIN
          publications
          ON publications.translated_book_id = translated_books.id
      INNER JOIN
          original_books
          ON original_books.id = translated_books.original_book_id
      INNER JOIN
          original_book_authors
          ON original_book_authors.original_book_id = original_books.id
      INNER JOIN
          authors
          ON authors.id = original_book_authors.author_id
      INNER JOIN
          translated_book_authors
          ON translated_book_authors.translated_book_id = translated_books.id
      INNER JOIN
          authors AS translators
          ON translators.id = translated_book_authors.author_id
      INNER JOIN
          publication_countries
          ON publication_countries.publication_id = publications.id
      INNER JOIN
          countries
          ON countries.id = publication_countries.country_id
      INNER JOIN
          publication_publishers
          ON publication_publishers.publication_id = publications.id
      INNER JOIN
          publishers
          ON publishers.id = publication_publishers.publisher_id
      #{where}
    ),
    CTE_authors AS (
      SELECT id, original_author
      FROM CTE_publications
      GROUP BY id, original_author
    ),
    CTE_authors_distinct AS (
      SELECT id, string_agg(original_author, ', ' ORDER BY original_author) AS original_authors
      FROM CTE_authors
      GROUP BY id
    ),
    CTE_translators AS (
      SELECT id, translator
      FROM CTE_publications
      GROUP BY id, translator
    ),
    CTE_translators_distinct AS (
      SELECT id, string_agg(translator, ', ' ORDER BY translator) AS translators
      FROM CTE_translators
      GROUP BY id
    ),
    CTE_countries AS (
      SELECT id, country
      FROM CTE_publications
      GROUP BY id, country
    ),
    CTE_countries_distinct AS (
      SELECT id, string_agg(country, ', ' ORDER BY country) AS countries
      FROM CTE_countries
      GROUP BY id
    ),
    CTE_publishers AS (
      SELECT id, publisher
      FROM CTE_publications
      GROUP BY id, publisher
    ),
    CTE_publishers_distinct AS (
      SELECT id, string_agg(publisher, ', ' ORDER BY publisher) AS publishers
      FROM CTE_publishers
      GROUP BY id
    ),
    CTE_references_distinct AS (
      SELECT publication_id AS id, array_agg(content ORDER BY "position") AS refs
      FROM publication_references
      GROUP BY publication_id
    )
    SELECT
      CTE_publications.id AS id,
      CTE_publications.title AS title,
      CTE_countries_distinct.countries AS countries,
      CTE_publications.countries_fingerprint AS countries_fingerprint,
      CTE_publications.year AS year,
      CTE_publishers_distinct.publishers AS publishers,
      CTE_publications.publishers_fingerprint AS publishers_fingerprint,
      CTE_publications.original_title AS original_title,
      CTE_authors_distinct.original_authors AS original_authors,
      CTE_translators_distinct.translators AS authors,
      CTE_publications.translated_book_fingerprint AS translated_book_fingerprint,
      COALESCE(CTE_references_distinct.refs, ARRAY[]::varchar[]) AS "references"
    FROM
      CTE_publications
    INNER JOIN
      CTE_authors_distinct
      ON CTE_publications.id = CTE_authors_distinct.id
    INNER JOIN
      CTE_translators_distinct
      ON CTE_publications.id = CTE_translators_distinct.id
    INNER JOIN
      CTE_countries_distinct
      ON CTE_publications.id = CTE_countries_distinct.id
    INNER JOIN
      CTE_publishers_distinct
      ON CTE_publications.id = CTE_publishers_distinct.id
    LEFT JOIN
      CTE_references_distinct
      ON CTE_publications.id = CTE_references_distinct.id
    GROUP BY
      CTE_publications.id,
      CTE_publications.title,
      CTE_publications.year,
      CTE_publications.original_title,
      CTE_publications.translated_book_fingerprint,
      CTE_publications.countries_fingerprint,
      CTE_publications.publishers_fingerprint,
      CTE_authors_distinct.original_authors,
      CTE_translators_distinct.translators,
      CTE_countries_distinct.countries,
      CTE_publishers_distinct.publishers,
      CTE_references_distinct.refs
    """
  end
end

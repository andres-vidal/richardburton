defmodule RichardBurton.Repo.Migrations.CreateSearchIndex do
  use Ecto.Migration

  def change do
    execute(
      "--Up
      CREATE VIEW flat_publications AS
      WITH
      CTE_publications AS (
        SELECT
            publications.id AS id,
            publications.title AS title,
            publications.country AS country,
            publications.year AS year,
            publications.publisher AS publisher,
            authors.name AS original_author,
            translators.name AS translator,
            original_books.title AS original_title
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
      )
      SELECT
        CTE_publications.id AS id,
        CTE_publications.title AS title,
        CTE_publications.country AS country,
        CTE_publications.year AS year,
        CTE_publications.publisher AS publisher,
        CTE_publications.original_title AS original_title,
        CTE_authors_distinct.original_authors AS original_authors,
        CTE_translators_distinct.translators AS authors
      FROM
        CTE_publications
      INNER JOIN
        CTE_authors_distinct
        ON CTE_publications.id = CTE_authors_distinct.id
      INNER JOIN
        CTE_translators_distinct
        ON CTE_publications.id = CTE_translators_distinct.id
      GROUP BY
        CTE_publications.id,
        CTE_publications.title,
        CTE_publications.country,
        CTE_publications.year,
        CTE_publications.publisher,
        CTE_publications.original_title,
        CTE_authors_distinct.original_authors,
        CTE_translators_distinct.translators;
      ",
      "--Down
      DROP VIEW flat_publications;
      "
    )

    execute(
      "--Up
      CREATE MATERIALIZED VIEW search_documents AS
      SELECT
        id,
        to_tsvector('simple'::regconfig, title)                ||
        to_tsvector('simple'::regconfig, country)              ||
        to_tsvector('simple'::regconfig, publisher)            ||
        to_tsvector('simple'::regconfig, year::text)           ||
        to_tsvector('simple'::regconfig, authors)              ||
        to_tsvector('simple'::regconfig, original_title)       ||
        to_tsvector('simple'::regconfig, original_authors)     AS document
      FROM
        flat_publications
      ",
      "--Down
      DROP MATERIALIZED VIEW search_documents;
      "
    )

    execute(
      "--Up
      CREATE INDEX search_index ON search_documents USING gin(document);
      ",
      "--Down
      DROP INDEX search_index;
      "
    )

    execute(
      "--Up
      CREATE EXTENSION pg_trgm;
      ",
      "--Down
      DROP EXTENSION pg_trgm;
      "
    )

    execute(
      "--Up
      CREATE MATERIALIZED VIEW search_keywords AS
      SELECT
        word
      FROM
        ts_stat('SELECT document FROM public.search_documents');
      ",
      "--Down
      DROP MATERIALIZED VIEW search_keywords;
      "
    )

    execute(
      "--Up
      CREATE INDEX search_trigram_index ON search_keywords USING gin(word gin_trgm_ops);
      ",
      "--Down
      DROP INDEX search_trigram_index;
      "
    )

    execute(
      "--Up
      CREATE FUNCTION refresh_search_index()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS
      $$ BEGIN
        REFRESH MATERIALIZED VIEW search_documents;
        REFRESH MATERIALIZED VIEW search_keywords;
        RETURN NULL;
      END $$;
      ",
      "--Down
      DROP FUNCTION refresh_search_index;
      "
    )

    Enum.each(["publications", "translated_books", "original_books", "authors"], fn table ->
      execute(
        "--Up
        CREATE TRIGGER #{table}_refresh_search_index
        AFTER INSERT OR UPDATE
        ON #{table}
        EXECUTE PROCEDURE refresh_search_index();
        ",
        "--Down
        DROP TRIGGER #{table}_refresh_search_index
        ON #{table};
        "
      )
    end)
  end
end

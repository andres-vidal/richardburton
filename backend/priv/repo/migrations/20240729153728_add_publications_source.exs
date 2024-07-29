defmodule RichardBurton.Repo.Migrations.AddPublicationsSource do
  use Ecto.Migration

  def change do
    alter table(:publications) do
      add :source, :text
    end

    execute(
      """
      -- Up
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
            publications.source AS source,
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
        CTE_publications.translated_book_fingerprint AS translated_book_fingerprint
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
        CTE_publishers_distinct.publishers;
      """,
      """
      -- Down
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
        CTE_publications.translated_book_fingerprint AS translated_book_fingerprint
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
        CTE_publishers_distinct.publishers;
      """
    )
  end
end

defmodule RichardBurton.Repo.Migrations.LookUpCompositeKeysInTheDatabase do
  use Ecto.Migration

  @moduledoc """
  Defines functions that find the stored row with a given composite key.

  Each function takes the values a key is built from, with names rather than
  fingerprints, and returns the id of the stored row with that key, or null
  when there is none. The keys are those of `ComputeFingerprintsInTheDatabase`:

    * an original book: its title, and the fingerprint of its authors;
    * a translated book: its original book, and the fingerprint of its
      translators;
    * a publication that is not deleted: its title, year and translated book,
      and the fingerprints of its countries and publishers.

  `rb_publication_with_key` leaves out the publication with the id `excluded`,
  so an edit to a stored publication does not match the publication itself.
  """

  def up do
    execute("""
    CREATE FUNCTION rb_original_book_with_key(title text, authors text[]) RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
      SELECT ob.id
      FROM original_books ob
      WHERE ob.title = rb_original_book_with_key.title
        AND ob.authors_fingerprint = rb_set_fingerprint(authors)
    $$
    """)

    execute("""
    CREATE FUNCTION rb_translated_book_with_key(original_book bigint, translators text[])
    RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
      SELECT tb.id
      FROM translated_books tb
      WHERE tb.original_book_id = original_book
        AND tb.authors_fingerprint = rb_set_fingerprint(translators)
    $$
    """)

    execute("""
    CREATE FUNCTION rb_publication_with_key(
      title text,
      year integer,
      countries text[],
      publishers text[],
      translators text[],
      original_title text,
      original_authors text[],
      excluded bigint
    ) RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
      SELECT p.id
      FROM publications p
      WHERE p.deleted_at IS NULL
        AND p.id IS DISTINCT FROM excluded
        AND p.title = rb_publication_with_key.title
        AND p.year = rb_publication_with_key.year
        AND p.countries_fingerprint = rb_set_fingerprint(countries)
        AND p.publishers_fingerprint = rb_set_fingerprint(publishers)
        AND p.translated_book_id = rb_translated_book_with_key(
          rb_original_book_with_key(original_title, original_authors),
          translators
        )
      LIMIT 1
    $$
    """)
  end

  def down do
    execute(
      "DROP FUNCTION rb_publication_with_key(text, integer, text[], text[], text[], text, text[], bigint)"
    )

    execute("DROP FUNCTION rb_translated_book_with_key(bigint, text[])")
    execute("DROP FUNCTION rb_original_book_with_key(text, text[])")
  end
end

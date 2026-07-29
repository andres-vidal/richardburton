defmodule RichardBurton.Repo.Migrations.IndexCountryNames do
  use Ecto.Migration

  @moduledoc """
  Index countries by name instead of translating names to codes at query time.

  A record stores a country as its code, so searching by the name a reader sees
  (or an alternate, like "Reino Unido" or "USA") used to mean translating the
  name to a code in the query. That path could not serve a quoted search, and a
  two-letter code injected as a lexeme collided with common two-letter words.

  Each country now carries its names, and the search document folds those names
  in — at the country weight — in place of the code. Country search becomes an
  ordinary word match, on every search path, with no code in the index to
  collide with anything.
  """

  alias RichardBurton.Country
  alias RichardBurton.Repo

  import Ecto.Query

  def up do
    alter table(:countries) do
      add(:names, {:array, :string}, null: false, default: [])
    end

    flush()

    for {id, code} <- Repo.all(from(c in "countries", select: {c.id, c.code})) do
      Repo.update_all(
        from(c in "countries", where: c.id == ^id),
        set: [names: Country.names_for(code)]
      )
    end

    rebuild_search_documents(country_field: "coalesce(cn.names, '')", extra_join: lateral())
  end

  def down do
    rebuild_search_documents(country_field: "countries", extra_join: "")

    alter table(:countries) do
      remove(:names)
    end
  end

  # A record's countries, resolved to the words a reader would search them by.
  defp lateral do
    """
    LEFT JOIN LATERAL (
      SELECT string_agg(array_to_string(c.names, ' '), ' ') AS names
      FROM countries c
      WHERE c.code = ANY (string_to_array(fp.countries, ', '))
    ) cn ON true
    """
  end

  # search_keywords reads search_documents, so it goes first and comes back last.
  defp rebuild_search_documents(country_field: country_field, extra_join: extra_join) do
    execute("DROP MATERIALIZED VIEW search_keywords")
    execute("DROP MATERIALIZED VIEW search_documents")

    execute("""
    CREATE MATERIALIZED VIEW search_documents AS
    SELECT
      fp.id,
      setweight(to_tsvector('rb_search'::regconfig, fp.title::text), 'A')                 ||
      setweight(to_tsvector('rb_search'::regconfig, fp.original_title::text), 'A')        ||
      setweight(to_tsvector('rb_search'::regconfig, fp.authors), 'B')                     ||
      setweight(to_tsvector('rb_search'::regconfig, fp.original_authors), 'B')            ||
      setweight(to_tsvector('rb_search'::regconfig, fp.publishers), 'C')                  ||
      setweight(to_tsvector('rb_search'::regconfig, #{country_field}), 'C')               ||
      setweight(to_tsvector('rb_search'::regconfig, fp.year::text), 'C')                  ||
      setweight(to_tsvector('rb_search'::regconfig,
        array_to_string(fp."references", ' ')), 'D')                                      AS document
    FROM
      flat_publications fp
      #{extra_join}
    """)

    execute("CREATE INDEX search_index ON search_documents USING gin(document)")
    execute("CREATE UNIQUE INDEX search_documents_id_index ON search_documents (id)")

    execute("""
    CREATE MATERIALIZED VIEW search_keywords AS
    SELECT word FROM ts_stat('SELECT document FROM search_documents')
    """)

    execute("CREATE INDEX search_trigram_index ON search_keywords USING gin(word gin_trgm_ops)")
    execute("CREATE UNIQUE INDEX search_keywords_word_index ON search_keywords (word)")
  end
end

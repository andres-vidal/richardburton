defmodule RichardBurton.Repo.Migrations.OffloadSearchIndexRefresh do
  use Ecto.Migration

  @moduledoc """
  Move search-index maintenance off the write path.

  The per-statement triggers rebuilt both materialized views synchronously
  inside every writing transaction — with an ACCESS EXCLUSIVE lock, so
  searches blocked and bulk writes crawled. Maintenance now lives in
  `Publication.Index.Refresher`, which the write paths signal; it rebuilds
  with `REFRESH ... CONCURRENTLY`, which needs a unique index on each view.

  This also retires the `skip_search_refresh` guard (20260724010000) — with
  the triggers gone there is nothing to skip.
  """

  @tables ["publications", "translated_books", "original_books", "authors"]

  def up do
    execute("CREATE UNIQUE INDEX search_documents_id_index ON search_documents (id)")
    execute("CREATE UNIQUE INDEX search_keywords_word_index ON search_keywords (word)")

    Enum.each(@tables, fn table ->
      execute("DROP TRIGGER #{table}_refresh_search_index ON #{table}")
    end)

    execute("DROP FUNCTION refresh_search_index")
  end

  def down do
    execute("""
    CREATE FUNCTION refresh_search_index()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS
    $$ BEGIN
      IF current_setting('richard_burton.skip_search_refresh', true) = 'on' THEN
        RETURN NULL;
      END IF;
      REFRESH MATERIALIZED VIEW search_documents;
      REFRESH MATERIALIZED VIEW search_keywords;
      RETURN NULL;
    END $$;
    """)

    Enum.each(@tables, fn table ->
      execute("""
      CREATE TRIGGER #{table}_refresh_search_index
      AFTER INSERT OR UPDATE
      ON #{table}
      EXECUTE PROCEDURE refresh_search_index()
      """)
    end)

    execute("DROP INDEX search_keywords_word_index")
    execute("DROP INDEX search_documents_id_index")
  end
end

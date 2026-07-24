defmodule RichardBurton.Repo.Migrations.BatchSearchIndexRefresh do
  use Ecto.Migration

  @moduledoc """
  Let a transaction opt out of the per-statement search-index rebuild.

  The refresh trigger fires on every INSERT/UPDATE to publications and their
  associations, so a bulk insert of N publications rebuilds both materialized
  views dozens of times inside one transaction — pathologically slow (each
  rebuild is a full recompute, serialized on the same connection). With the
  guard, `Publication.insert_all` sets `richard_burton.skip_search_refresh`
  via SET LOCAL and rebuilds the views once after the batch commits.
  """

  def up do
    execute("""
    CREATE OR REPLACE FUNCTION refresh_search_index()
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
  end

  def down do
    execute("""
    CREATE OR REPLACE FUNCTION refresh_search_index()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS
    $$ BEGIN
      REFRESH MATERIALIZED VIEW search_documents;
      REFRESH MATERIALIZED VIEW search_keywords;
      RETURN NULL;
    END $$;
    """)
  end
end

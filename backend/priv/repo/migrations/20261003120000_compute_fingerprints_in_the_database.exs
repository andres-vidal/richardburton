defmodule RichardBurton.Repo.Migrations.ComputeFingerprintsInTheDatabase do
  use Ecto.Migration

  @moduledoc """
  Compute the fingerprints of the composite keys in the database, and keep them
  up to date with triggers.

  A fingerprint is a hash of a set of names: the authors of an original book,
  the translators of a translated book, and the publishers and country codes of
  a publication. `rb_set_fingerprint` computes one, the same way the
  application did, so every stored value stays as it was. Triggers on the link
  tables and on the names recompute the fingerprints a change affects, so a
  write keeps them current whether or not it goes through the application.

  A translated book is now identified by the id of the original book it
  translates, and a publication by the id of its translated book, rather than
  by a copy of that book's fingerprint. `translated_books.original_book_fingerprint`
  and `publications.translated_book_fingerprint` are dropped, so a change to an
  original book no longer has to be copied onto its translations and their
  publications.

  The keys are checked when a transaction commits. A row's links are written
  one by one after the row, and until the last one is written the row can match
  another row's key. The publications key applies only to publications that
  are not deleted, and a partial unique index cannot be deferred, so it becomes
  an exclusion constraint with the same columns.

  The materialized views built on `publications` read the dropped column, so
  they are rebuilt without the fingerprints, which nothing reads from them.
  """

  def up do
    create_functions()

    # The views read `publications.translated_book_fingerprint`, so they come
    # down before it is dropped.
    drop_views()

    execute("DROP INDEX original_books_composite_key")
    execute("DROP INDEX translated_books_composite_key")
    execute("DROP INDEX publications_composite_key")

    execute("ALTER TABLE translated_books DROP COLUMN original_book_fingerprint")
    execute("ALTER TABLE publications DROP COLUMN translated_book_fingerprint")

    # A new row has no links yet, so it starts with the fingerprint of no
    # names, and the triggers replace it as the links are written.
    for {table, column} <- set_fingerprints() do
      execute("""
      ALTER TABLE #{table} ALTER COLUMN #{column} SET DEFAULT rb_set_fingerprint('{}')
      """)
    end

    recompute_set_fingerprints()

    execute("""
    ALTER TABLE original_books
    ADD CONSTRAINT original_books_composite_key
    UNIQUE (title, authors_fingerprint)
    DEFERRABLE INITIALLY DEFERRED
    """)

    execute("""
    ALTER TABLE translated_books
    ADD CONSTRAINT translated_books_composite_key
    UNIQUE (original_book_id, authors_fingerprint)
    DEFERRABLE INITIALLY DEFERRED
    """)

    execute("""
    ALTER TABLE publications
    ADD CONSTRAINT publications_composite_key
    EXCLUDE USING btree (
      title WITH =,
      year WITH =,
      translated_book_id WITH =,
      publishers_fingerprint WITH =,
      countries_fingerprint WITH =
    )
    WHERE (deleted_at IS NULL)
    DEFERRABLE INITIALLY DEFERRED
    """)

    create_triggers()
    create_views(flat_publications_select(fingerprints: false))
  end

  def down do
    drop_triggers()
    drop_views()

    execute("ALTER TABLE original_books DROP CONSTRAINT original_books_composite_key")
    execute("ALTER TABLE translated_books DROP CONSTRAINT translated_books_composite_key")
    execute("ALTER TABLE publications DROP CONSTRAINT publications_composite_key")

    for {table, column} <- set_fingerprints() do
      execute("ALTER TABLE #{table} ALTER COLUMN #{column} DROP DEFAULT")
    end

    # The two dropped fingerprints, computed the way the application computed
    # them: the original book's title followed by its authors' fingerprint, and
    # that fingerprint followed by the translators' fingerprint.
    execute("ALTER TABLE translated_books ADD COLUMN original_book_fingerprint varchar")

    execute("""
    UPDATE translated_books tb
    SET original_book_fingerprint =
      rb_fingerprint(convert_to(ob.title || ob.authors_fingerprint, 'UTF8'))
    FROM original_books ob
    WHERE ob.id = tb.original_book_id
    """)

    execute("ALTER TABLE translated_books ALTER COLUMN original_book_fingerprint SET NOT NULL")
    execute("ALTER TABLE publications ADD COLUMN translated_book_fingerprint varchar")

    execute("""
    UPDATE publications p
    SET translated_book_fingerprint =
      rb_fingerprint(convert_to(tb.original_book_fingerprint || tb.authors_fingerprint, 'UTF8'))
    FROM translated_books tb
    WHERE tb.id = p.translated_book_id
    """)

    execute("ALTER TABLE publications ALTER COLUMN translated_book_fingerprint SET NOT NULL")

    execute("""
    CREATE UNIQUE INDEX original_books_composite_key
    ON original_books (title, authors_fingerprint)
    """)

    execute("""
    CREATE UNIQUE INDEX translated_books_composite_key
    ON translated_books (authors_fingerprint, original_book_fingerprint)
    """)

    execute("""
    CREATE UNIQUE INDEX publications_composite_key
    ON publications (title, year, publishers_fingerprint, translated_book_fingerprint, countries_fingerprint)
    WHERE deleted_at IS NULL
    """)

    create_views(flat_publications_select(fingerprints: true))
    drop_functions()
  end

  # Each stored set fingerprint, as its table and column.
  defp set_fingerprints do
    [
      {"original_books", "authors_fingerprint"},
      {"translated_books", "authors_fingerprint"},
      {"publications", "publishers_fingerprint"},
      {"publications", "countries_fingerprint"}
    ]
  end

  # `rb_fingerprint` hashes bytes as the uppercase hex of their SHA-256.
  # `rb_set_fingerprint` hashes a set of names: the names sorted by their
  # bytes and joined with a NUL byte, which a name cannot contain, so two
  # different sets never join to the same bytes. An empty or null set hashes
  # no bytes at all.
  #
  # The other four functions compute the fingerprint of one row's linked names
  # from the link tables.
  defp create_functions do
    execute("""
    CREATE FUNCTION rb_fingerprint(data bytea) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$ SELECT upper(encode(sha256(data), 'hex')) $$
    """)

    execute("""
    CREATE FUNCTION rb_set_fingerprint(members text[]) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
      SELECT rb_fingerprint(coalesce(
        (SELECT string_agg(convert_to(m, 'UTF8'), decode('00', 'hex')
                           ORDER BY convert_to(m, 'UTF8'))
         FROM unnest(members) AS m),
        ''::bytea))
    $$
    """)

    for {name, table, key, names_table, names_key, value} <- linked_names() do
      execute("""
      CREATE FUNCTION #{name}(row_id bigint) RETURNS text
      LANGUAGE sql STABLE
      AS $$
        SELECT rb_set_fingerprint(array_agg(n.#{value}))
        FROM #{table} l
        JOIN #{names_table} n ON n.id = l.#{names_key}
        WHERE l.#{key} = row_id
      $$
      """)
    end
  end

  defp drop_functions do
    for {name, _, _, _, _, _} <- linked_names(), do: execute("DROP FUNCTION #{name}(bigint)")

    execute("DROP FUNCTION rb_set_fingerprint(text[])")
    execute("DROP FUNCTION rb_fingerprint(bytea)")
  end

  # For each set fingerprint: the function that computes it, the link table and
  # its column naming the row, and the table of names with the link column
  # naming it and the value hashed.
  defp linked_names do
    [
      {"rb_original_book_authors_fingerprint", "original_book_authors", "original_book_id",
       "authors", "author_id", "name"},
      {"rb_translated_book_authors_fingerprint", "translated_book_authors", "translated_book_id",
       "authors", "author_id", "name"},
      {"rb_publishers_fingerprint", "publication_publishers", "publication_id", "publishers",
       "publisher_id", "name"},
      {"rb_countries_fingerprint", "publication_countries", "publication_id", "countries",
       "country_id", "code"}
    ]
  end

  # Writes every stored set fingerprint from the links as they are now.
  defp recompute_set_fingerprints do
    execute(
      "UPDATE original_books SET authors_fingerprint = rb_original_book_authors_fingerprint(id)"
    )

    execute(
      "UPDATE translated_books SET authors_fingerprint = rb_translated_book_authors_fingerprint(id)"
    )

    execute("""
    UPDATE publications
    SET publishers_fingerprint = rb_publishers_fingerprint(id),
        countries_fingerprint = rb_countries_fingerprint(id)
    """)
  end

  # A trigger on each link table recomputes the fingerprint of the row whose
  # links changed, and of the row a link moved away from. A trigger on each
  # table of names recomputes the fingerprints of the rows linked to a name
  # that changed.
  defp create_triggers do
    for {table, key, parent, column, function} <- link_triggers() do
      execute("""
      CREATE FUNCTION rb_refingerprint_#{table}() RETURNS trigger
      LANGUAGE plpgsql
      AS $$ BEGIN
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
          UPDATE #{parent} SET #{column} = #{function}(id) WHERE id = OLD.#{key};
        END IF;
        IF TG_OP IN ('INSERT', 'UPDATE') THEN
          UPDATE #{parent} SET #{column} = #{function}(id) WHERE id = NEW.#{key};
        END IF;
        RETURN NULL;
      END $$
      """)

      execute("""
      CREATE TRIGGER #{table}_fingerprint
      AFTER INSERT OR UPDATE OR DELETE ON #{table}
      FOR EACH ROW EXECUTE FUNCTION rb_refingerprint_#{table}()
      """)
    end

    execute("""
    CREATE FUNCTION rb_refingerprint_authors() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
      UPDATE original_books SET authors_fingerprint = rb_original_book_authors_fingerprint(id)
      WHERE id IN (SELECT original_book_id FROM original_book_authors WHERE author_id = NEW.id);
      UPDATE translated_books SET authors_fingerprint = rb_translated_book_authors_fingerprint(id)
      WHERE id IN (SELECT translated_book_id FROM translated_book_authors WHERE author_id = NEW.id);
      RETURN NULL;
    END $$
    """)

    execute("""
    CREATE FUNCTION rb_refingerprint_publishers() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
      UPDATE publications SET publishers_fingerprint = rb_publishers_fingerprint(id)
      WHERE id IN (SELECT publication_id FROM publication_publishers WHERE publisher_id = NEW.id);
      RETURN NULL;
    END $$
    """)

    execute("""
    CREATE FUNCTION rb_refingerprint_countries() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
      UPDATE publications SET countries_fingerprint = rb_countries_fingerprint(id)
      WHERE id IN (SELECT publication_id FROM publication_countries WHERE country_id = NEW.id);
      RETURN NULL;
    END $$
    """)

    for {table, value} <- [{"authors", "name"}, {"publishers", "name"}, {"countries", "code"}] do
      execute("""
      CREATE TRIGGER #{table}_fingerprint
      AFTER UPDATE OF #{value} ON #{table}
      FOR EACH ROW WHEN (OLD.#{value} IS DISTINCT FROM NEW.#{value})
      EXECUTE FUNCTION rb_refingerprint_#{table}()
      """)
    end
  end

  defp drop_triggers do
    for {table, _, _, _, _} <- link_triggers() do
      execute("DROP TRIGGER #{table}_fingerprint ON #{table}")
      execute("DROP FUNCTION rb_refingerprint_#{table}()")
    end

    for table <- ["authors", "publishers", "countries"] do
      execute("DROP TRIGGER #{table}_fingerprint ON #{table}")
      execute("DROP FUNCTION rb_refingerprint_#{table}()")
    end
  end

  # For each link table: the column naming the row it links, that row's table
  # and fingerprint column, and the function that computes the fingerprint.
  defp link_triggers do
    [
      {"original_book_authors", "original_book_id", "original_books", "authors_fingerprint",
       "rb_original_book_authors_fingerprint"},
      {"translated_book_authors", "translated_book_id", "translated_books", "authors_fingerprint",
       "rb_translated_book_authors_fingerprint"},
      {"publication_publishers", "publication_id", "publications", "publishers_fingerprint",
       "rb_publishers_fingerprint"},
      {"publication_countries", "publication_id", "publications", "countries_fingerprint",
       "rb_countries_fingerprint"}
    ]
  end

  # search_keywords reads search_documents, which reads flat_publications, so
  # the stack comes down top-first and is rebuilt bottom-first. What follows
  # rebuilds it as `AggregateMultivaluedAttributesAsArrays` left it, with or
  # without the fingerprint columns.
  defp drop_views do
    execute("DROP MATERIALIZED VIEW search_keywords")
    execute("DROP MATERIALIZED VIEW search_documents")
    execute("DROP MATERIALIZED VIEW flat_publications")
  end

  defp create_views(select) do
    execute("CREATE MATERIALIZED VIEW flat_publications AS #{select}")
    execute("CREATE UNIQUE INDEX flat_publications_id_index ON flat_publications (id)")
    execute("CREATE INDEX flat_publications_title_id_index ON flat_publications (title, id)")

    execute("""
    CREATE INDEX flat_publications_translators_trigram_index
    ON flat_publications USING gin((rb_joined(authors)) gin_trgm_ops)
    """)

    for field <- ~w(title original_title) do
      execute("""
      CREATE INDEX flat_publications_#{field}_search_index ON flat_publications
      USING gin (to_tsvector('rb_search', coalesce(#{field}::text, '')))
      """)
    end

    for field <- ~w(authors original_authors publishers countries) do
      execute("""
      CREATE INDEX flat_publications_#{field}_search_index ON flat_publications
      USING gin (to_tsvector('rb_search', rb_joined(#{field})))
      """)
    end

    execute("""
    CREATE INDEX flat_publications_sources_search_index ON flat_publications
    USING gin (to_tsvector('rb_search', rb_joined(sources)))
    """)

    execute("CREATE INDEX flat_publications_year_index ON flat_publications (year)")

    execute("""
    CREATE MATERIALIZED VIEW search_documents AS
    SELECT
      fp.id,
      setweight(to_tsvector('rb_search'::regconfig, fp.title::text), 'A')                     ||
      setweight(to_tsvector('rb_search'::regconfig, fp.original_title::text), 'A')            ||
      setweight(to_tsvector('rb_search'::regconfig, rb_joined(fp."authors")), 'B')           ||
      setweight(to_tsvector('rb_search'::regconfig, rb_joined(fp."original_authors")), 'B')  ||
      setweight(to_tsvector('rb_search'::regconfig, rb_joined(fp."publishers")), 'C')        ||
      setweight(to_tsvector('rb_search'::regconfig, coalesce(cn.names, '')), 'C')             ||
      setweight(to_tsvector('rb_search'::regconfig, fp.year::text), 'C')                      ||
      setweight(to_tsvector('rb_search'::regconfig,
        rb_joined(fp.sources)), 'D')                                          AS document
    FROM
      flat_publications fp
      LEFT JOIN LATERAL (
        SELECT string_agg(array_to_string(c.names, ' '), ' ') AS names
        FROM countries c
        WHERE c.code = ANY (fp.countries)
      ) cn ON true
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

  # The flattening join, with each set gathered into a sorted array. With
  # `fingerprints: true` it also carries the three fingerprint columns of
  # `publications`, as it did before this migration.
  defp flat_publications_select(fingerprints: fingerprints) do
    carried = fn column -> if fingerprints, do: column, else: "" end

    """
    WITH
    CTE_publications AS (
      SELECT
          publications.id AS id,
          publications.title AS title,
          publications.year AS year,
          authors.name AS original_author,
          translators.name AS translator,
          original_books.title AS original_title,
          #{carried.("publications.translated_book_fingerprint AS translated_book_fingerprint,")}
          #{carried.("publications.countries_fingerprint AS countries_fingerprint,")}
          #{carried.("publications.publishers_fingerprint AS publishers_fingerprint,")}
          countries.code AS country,
          publishers.name AS publisher
      FROM translated_books
      INNER JOIN publications ON publications.translated_book_id = translated_books.id
      INNER JOIN original_books ON original_books.id = translated_books.original_book_id
      INNER JOIN original_book_authors ON original_book_authors.original_book_id = original_books.id
      INNER JOIN authors ON authors.id = original_book_authors.author_id
      INNER JOIN translated_book_authors ON translated_book_authors.translated_book_id = translated_books.id
      INNER JOIN authors AS translators ON translators.id = translated_book_authors.author_id
      INNER JOIN publication_countries ON publication_countries.publication_id = publications.id
      INNER JOIN countries ON countries.id = publication_countries.country_id
      INNER JOIN publication_publishers ON publication_publishers.publication_id = publications.id
      INNER JOIN publishers ON publishers.id = publication_publishers.publisher_id
      WHERE publications.deleted_at IS NULL
    ),
    CTE_authors AS (
      SELECT id, original_author FROM CTE_publications GROUP BY id, original_author
    ),
    CTE_authors_distinct AS (
      SELECT id, array_agg(original_author ORDER BY original_author) AS original_authors
      FROM CTE_authors GROUP BY id
    ),
    CTE_translators AS (
      SELECT id, translator FROM CTE_publications GROUP BY id, translator
    ),
    CTE_translators_distinct AS (
      SELECT id, array_agg(translator ORDER BY translator) AS translators
      FROM CTE_translators GROUP BY id
    ),
    CTE_countries AS (
      SELECT id, country FROM CTE_publications GROUP BY id, country
    ),
    CTE_countries_distinct AS (
      SELECT id, array_agg(country ORDER BY country) AS countries
      FROM CTE_countries GROUP BY id
    ),
    CTE_publishers AS (
      SELECT id, publisher FROM CTE_publications GROUP BY id, publisher
    ),
    CTE_publishers_distinct AS (
      SELECT id, array_agg(publisher ORDER BY publisher) AS publishers
      FROM CTE_publishers GROUP BY id
    ),
    CTE_sources_distinct AS (
      SELECT publication_id AS id, array_agg(content ORDER BY "position") AS refs
      FROM publication_sources GROUP BY publication_id
    )
    SELECT
      CTE_publications.id AS id,
      CTE_publications.title AS title,
      CTE_countries_distinct.countries AS countries,
      #{carried.("CTE_publications.countries_fingerprint AS countries_fingerprint,")}
      CTE_publications.year AS year,
      CTE_publishers_distinct.publishers AS publishers,
      #{carried.("CTE_publications.publishers_fingerprint AS publishers_fingerprint,")}
      CTE_publications.original_title AS original_title,
      CTE_authors_distinct.original_authors AS original_authors,
      CTE_translators_distinct.translators AS authors,
      #{carried.("CTE_publications.translated_book_fingerprint AS translated_book_fingerprint,")}
      COALESCE(CTE_sources_distinct.refs, ARRAY[]::varchar[]) AS sources
    FROM CTE_publications
    INNER JOIN CTE_authors_distinct ON CTE_publications.id = CTE_authors_distinct.id
    INNER JOIN CTE_translators_distinct ON CTE_publications.id = CTE_translators_distinct.id
    INNER JOIN CTE_countries_distinct ON CTE_publications.id = CTE_countries_distinct.id
    INNER JOIN CTE_publishers_distinct ON CTE_publications.id = CTE_publishers_distinct.id
    LEFT JOIN CTE_sources_distinct ON CTE_publications.id = CTE_sources_distinct.id
    GROUP BY
      CTE_publications.id,
      CTE_publications.title,
      CTE_publications.year,
      CTE_publications.original_title,
      #{carried.("CTE_publications.translated_book_fingerprint,")}
      #{carried.("CTE_publications.countries_fingerprint,")}
      #{carried.("CTE_publications.publishers_fingerprint,")}
      CTE_authors_distinct.original_authors,
      CTE_translators_distinct.translators,
      CTE_countries_distinct.countries,
      CTE_publishers_distinct.publishers,
      CTE_sources_distinct.refs
    """
  end
end

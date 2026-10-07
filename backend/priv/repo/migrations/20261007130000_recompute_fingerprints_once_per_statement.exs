defmodule RichardBurton.Repo.Migrations.RecomputeFingerprintsOncePerStatement do
  use Ecto.Migration

  @moduledoc """
  Recompute the fingerprints that a statement on a link table affects once per
  statement, rather than once per row.

  `ComputeFingerprintsInTheDatabase` keeps each fingerprint current with a
  trigger that runs for every link row inserted, updated or deleted, and
  recomputes the fingerprint of the row that the link belongs to. A statement
  that inserts the links of many rows therefore recomputes each of those rows
  once per link, one row at a time.

  Here each link table gets three statement-level triggers, one for each kind
  of statement, which can read the links the statement changed as a
  transition table. The function they run collects the rows that those links
  belong to, and recomputes the fingerprints of all of them with one `UPDATE`
  that groups the remaining links by row. A row whose links were all removed
  gets the fingerprint of no names.
  """

  # For each link table: the column naming the row it links, that row's table
  # and fingerprint column, the column naming the linked name, the table and
  # column of the names, and the function that computes one row's fingerprint,
  # which the row-level triggers that `down/0` restores call.
  @links [
    {"original_book_authors", "original_book_id", "original_books", "authors_fingerprint",
     "author_id", "authors", "name", "rb_original_book_authors_fingerprint"},
    {"translated_book_authors", "translated_book_id", "translated_books", "authors_fingerprint",
     "author_id", "authors", "name", "rb_translated_book_authors_fingerprint"},
    {"publication_publishers", "publication_id", "publications", "publishers_fingerprint",
     "publisher_id", "publishers", "name", "rb_publishers_fingerprint"},
    {"publication_countries", "publication_id", "publications", "countries_fingerprint",
     "country_id", "countries", "code", "rb_countries_fingerprint"}
  ]

  def up do
    for {table, key, parent, column, name_key, names, value, _function} <- @links do
      execute("DROP TRIGGER #{table}_fingerprint ON #{table}")
      execute("DROP FUNCTION rb_refingerprint_#{table}()")

      # `new_links` and `old_links` are the transition tables, which exist only
      # for the kinds of statement that have them, so each branch reads only
      # the ones its kind has.
      refingerprint = fn affected ->
        """
        UPDATE #{parent} p
        SET #{column} = f.fingerprint
        FROM (
          SELECT a.id,
                 rb_set_fingerprint(array_agg(n.#{value}) FILTER (WHERE n.#{value} IS NOT NULL))
                   AS fingerprint
          FROM (#{affected}) AS a(id)
          LEFT JOIN #{table} l ON l.#{key} = a.id
          LEFT JOIN #{names} n ON n.id = l.#{name_key}
          GROUP BY a.id
        ) f
        WHERE p.id = f.id;
        """
      end

      execute("""
      CREATE FUNCTION rb_refingerprint_#{table}() RETURNS trigger
      LANGUAGE plpgsql
      AS $$ BEGIN
        IF TG_OP = 'INSERT' THEN
          #{refingerprint.("SELECT DISTINCT #{key} FROM new_links")}
        ELSIF TG_OP = 'DELETE' THEN
          #{refingerprint.("SELECT DISTINCT #{key} FROM old_links")}
        ELSE
          #{refingerprint.("SELECT #{key} FROM new_links UNION SELECT #{key} FROM old_links")}
        END IF;
        RETURN NULL;
      END $$
      """)

      execute("""
      CREATE TRIGGER #{table}_fingerprint_insert
      AFTER INSERT ON #{table}
      REFERENCING NEW TABLE AS new_links
      FOR EACH STATEMENT EXECUTE FUNCTION rb_refingerprint_#{table}()
      """)

      execute("""
      CREATE TRIGGER #{table}_fingerprint_update
      AFTER UPDATE ON #{table}
      REFERENCING OLD TABLE AS old_links NEW TABLE AS new_links
      FOR EACH STATEMENT EXECUTE FUNCTION rb_refingerprint_#{table}()
      """)

      execute("""
      CREATE TRIGGER #{table}_fingerprint_delete
      AFTER DELETE ON #{table}
      REFERENCING OLD TABLE AS old_links
      FOR EACH STATEMENT EXECUTE FUNCTION rb_refingerprint_#{table}()
      """)
    end
  end

  def down do
    for {table, key, parent, column, _name_key, _names, _value, function} <- @links do
      for event <- ~w(insert update delete) do
        execute("DROP TRIGGER #{table}_fingerprint_#{event} ON #{table}")
      end

      execute("DROP FUNCTION rb_refingerprint_#{table}()")

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
  end
end

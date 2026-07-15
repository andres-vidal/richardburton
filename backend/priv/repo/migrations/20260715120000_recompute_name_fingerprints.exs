defmodule RichardBurton.Repo.Migrations.RecomputeNameFingerprints do
  use Ecto.Migration

  # The country/publisher/author fingerprints moved from a delimiter-less join to
  # a NUL-delimited one (RichardBurton.Fingerprint.of_set/1), which changes the
  # stored value for any record with 2+ names/codes — and cascades into the
  # original_book and translated_book fingerprints derived from them. Recompute the
  # affected columns so existing identities stay consistent. No-op on a fresh
  # (empty) database.
  #
  # Written as raw SQL rather than calling the app's fingerprint functions, so the
  # migration stays reproducible even if that code later changes. Each statement
  # mirrors the algorithm: sort the values byte-wise (COLLATE "C", matching
  # Elixir's `Enum.sort`), join on a NUL byte, SHA-256, then hex-encode uppercase.
  # Columns are recomputed in dependency order (a book's authors fingerprint feeds
  # the fingerprints derived from it).

  # A set fingerprint (order-independent), mirroring RichardBurton.Fingerprint.of_set/1.
  defp set_fp(value, order) do
    "upper(encode(sha256(string_agg(convert_to(#{value}, 'UTF8'), '\\x00' " <>
      "ORDER BY #{order} COLLATE \"C\")), 'hex'))"
  end

  # A fingerprint of concatenated parts (fixed-width sub-fingerprints, a title).
  defp concat_fp(parts), do: "upper(encode(sha256(convert_to(#{parts}, 'UTF8')), 'hex'))"

  def up do
    execute("""
    UPDATE original_books ob SET authors_fingerprint = sub.fp
    FROM (
      SELECT oba.original_book_id AS id, #{set_fp("a.name", "a.name")} AS fp
      FROM original_book_authors oba JOIN authors a ON a.id = oba.author_id
      GROUP BY oba.original_book_id
    ) sub WHERE ob.id = sub.id
    """)

    execute("""
    UPDATE translated_books tb SET authors_fingerprint = sub.fp
    FROM (
      SELECT tba.translated_book_id AS id, #{set_fp("a.name", "a.name")} AS fp
      FROM translated_book_authors tba JOIN authors a ON a.id = tba.author_id
      GROUP BY tba.translated_book_id
    ) sub WHERE tb.id = sub.id
    """)

    execute("""
    UPDATE translated_books tb
    SET original_book_fingerprint = #{concat_fp("ob.title || ob.authors_fingerprint")}
    FROM original_books ob WHERE ob.id = tb.original_book_id
    """)

    execute("""
    UPDATE publications p SET countries_fingerprint = sub.fp
    FROM (
      SELECT pc.publication_id AS id, #{set_fp("c.code", "c.code")} AS fp
      FROM publication_countries pc JOIN countries c ON c.id = pc.country_id
      GROUP BY pc.publication_id
    ) sub WHERE p.id = sub.id
    """)

    execute("""
    UPDATE publications p SET publishers_fingerprint = sub.fp
    FROM (
      SELECT pp.publication_id AS id, #{set_fp("pu.name", "pu.name")} AS fp
      FROM publication_publishers pp JOIN publishers pu ON pu.id = pp.publisher_id
      GROUP BY pp.publication_id
    ) sub WHERE p.id = sub.id
    """)

    execute("""
    UPDATE publications p
    SET translated_book_fingerprint =
      #{concat_fp("tb.original_book_fingerprint || tb.authors_fingerprint")}
    FROM translated_books tb WHERE tb.id = p.translated_book_id
    """)
  end

  # Irreversible: the previous (buggy) fingerprints are not worth restoring.
  def down, do: :ok
end

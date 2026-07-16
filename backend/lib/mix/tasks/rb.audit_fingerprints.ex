defmodule Mix.Tasks.Rb.AuditFingerprints do
  @shortdoc "Checks stored fingerprints against the current algorithm"

  @moduledoc """
  Recomputes every fingerprint from its associations and reports any row whose
  stored value has drifted from what the current algorithm produces.

  Fingerprints are denormalised, hand-synced derived state — nothing at the DB
  level guarantees they match the associations — so this task is the safety net:
  run it on demand or on a schedule to detect drift. It exits non-zero when drift
  is found, so it can gate CI.

      mix rb.audit_fingerprints
  """

  use Mix.Task

  alias RichardBurton.Author
  alias RichardBurton.Country
  alias RichardBurton.OriginalBook
  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook

  @impl Mix.Task
  def run(_args) do
    Mix.Task.run("app.start")

    drift = audit_original_books() ++ audit_translated_books() ++ audit_publications()

    case drift do
      [] ->
        Mix.shell().info("Fingerprints consistent.")

      _ ->
        Enum.each(drift, fn {schema, id, field} ->
          Mix.shell().error("#{schema} ##{id}: #{field} is stale")
        end)

        Mix.raise("#{length(drift)} fingerprint(s) drifted from the current algorithm.")
    end
  end

  defp audit_original_books do
    OriginalBook
    |> Repo.all()
    |> Repo.preload(:authors)
    |> Enum.flat_map(fn book ->
      check(
        "original_books",
        book.id,
        :authors_fingerprint,
        book.authors_fingerprint,
        Author.fingerprint(book.authors)
      )
    end)
  end

  defp audit_translated_books do
    TranslatedBook
    |> Repo.all()
    |> Repo.preload([:authors, :original_book])
    |> Enum.flat_map(fn book ->
      check(
        "translated_books",
        book.id,
        :authors_fingerprint,
        book.authors_fingerprint,
        Author.fingerprint(book.authors)
      ) ++
        check(
          "translated_books",
          book.id,
          :original_book_fingerprint,
          book.original_book_fingerprint,
          OriginalBook.fingerprint(book.original_book)
        )
    end)
  end

  defp audit_publications do
    Publication
    |> Repo.all()
    |> Repo.preload([:countries, :publishers, :translated_book])
    |> Enum.flat_map(fn pub ->
      check(
        "publications",
        pub.id,
        :countries_fingerprint,
        pub.countries_fingerprint,
        Country.fingerprint(pub.countries)
      ) ++
        check(
          "publications",
          pub.id,
          :publishers_fingerprint,
          pub.publishers_fingerprint,
          Publisher.fingerprint(pub.publishers)
        ) ++
        check(
          "publications",
          pub.id,
          :translated_book_fingerprint,
          pub.translated_book_fingerprint,
          TranslatedBook.fingerprint(pub.translated_book)
        )
    end)
  end

  defp check(_schema, _id, _field, stored, stored), do: []
  defp check(schema, id, field, _stored, _computed), do: [{schema, id, field}]
end

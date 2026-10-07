defmodule RichardBurton.Publication.ImportTest do
  @moduledoc """
  Tests for `Publication.Import`, through `Publication.insert_all/2`: that a
  batch is stored as inserting its rows one at a time would store it, with a
  number of queries that does not depend on the number of rows, and that the
  first invalid or conflicting row is returned.
  """

  use RichardBurton.DataCase

  alias RichardBurton.Publication
  alias RichardBurton.Publication.Codec
  alias RichardBurton.Publication.History

  # Iracema in Isabel Burton's translation, stored before each import.
  @iracema %{
    title: "Iraçéma the Honey-Lips",
    year: 1886,
    countries: ["GB"],
    publishers: ["Bickers & Son"],
    authors: ["Isabel Burton"],
    original_title: "Iracema",
    original_authors: ["José de Alencar"]
  }

  # A batch whose rows share names and books with each other and with
  # `@iracema`: two publications of one translated book, its translators
  # listed in both orders; a new translation and a new edition of the stored
  # book; a translator who is an original author in another row; and an
  # original book whose authors are listed in both orders.
  @batch [
    %{
      title: "The Devil to Pay in the Backlands",
      year: 1963,
      countries: ["US"],
      publishers: ["Knopf"],
      authors: ["James L. Taylor", "Harriet de Onís"],
      original_title: "Grande Sertão: Veredas",
      original_authors: ["João Guimarães Rosa"],
      sources: ["Taylor, James. Preface, 1963."]
    },
    %{
      title: "The Devil to Pay in the Backlands",
      year: 1971,
      countries: ["US", "GB"],
      publishers: ["Bantam", "Knopf"],
      authors: ["Harriet de Onís", "James L. Taylor"],
      original_title: "Grande Sertão: Veredas",
      original_authors: ["João Guimarães Rosa"]
    },
    %{
      title: "Iracema, the Honey-Lips",
      year: 1886,
      countries: ["GB"],
      publishers: ["Bickers & Son"],
      authors: ["Isabel Burton"],
      original_title: "Iracema",
      original_authors: ["José de Alencar"]
    },
    %{
      title: "Iracema",
      year: 2000,
      countries: ["US"],
      publishers: ["Penguin"],
      authors: ["Clifford E. Landers"],
      original_title: "Iracema",
      original_authors: ["José de Alencar"],
      sources: ["Landers, Clifford. Introduction.", "Publisher's catalogue."]
    },
    %{
      title: "Dom Casmurro",
      year: 1953,
      countries: ["US"],
      publishers: ["Noonday Press"],
      authors: ["Helen Caldwell"],
      original_title: "Dom Casmurro",
      original_authors: ["Machado de Assis"]
    },
    %{
      title: "Letters",
      year: 1990,
      countries: ["BR"],
      publishers: ["Editora Nova"],
      authors: ["Gregory Rabassa"],
      original_title: "Cartas",
      original_authors: ["Helen Caldwell"]
    },
    %{
      title: "Two Stories",
      year: 2001,
      countries: ["GB"],
      publishers: ["Carcanet"],
      authors: ["Giovanni Pontiero"],
      original_title: "Dois Contos",
      original_authors: ["Clarice Lispector", "Rubem Fonseca"]
    },
    %{
      title: "Two Stories",
      year: 2005,
      countries: ["GB"],
      publishers: ["Carcanet"],
      authors: ["Giovanni Pontiero"],
      original_title: "Dois Contos",
      original_authors: ["Rubem Fonseca", "Clarice Lispector"]
    }
  ]

  # The tables a publication write reaches.
  @tables ~w[authors publishers countries original_books translated_books original_book_authors
             translated_book_authors publications publication_countries publication_publishers
             publication_sources publication_history]

  setup do
    {:ok, _} = Publication.insert(Codec.nest(@iracema))
    :ok
  end

  describe "a batch" do
    test "is stored as inserting its rows one at a time stores it" do
      # Dom Casmurro was stored once and deleted, which leaves its key free.
      {:ok, deleted} = Publication.insert(Codec.nest(Enum.at(@batch, 4)))
      {:ok, _} = Publication.delete(deleted.id)

      batch = Codec.nest(@batch)

      at_once =
        rolled_back(fn ->
          {:ok, _} = Publication.insert_all(batch, "admin@example.com")
          stored()
        end)

      one_at_a_time =
        rolled_back(fn ->
          for attrs <- batch, do: {:ok, _} = Publication.insert(attrs, "admin@example.com")
          stored()
        end)

      assert at_once == one_at_a_time
    end

    test "is returned in order, with each row's countries and publishers in the order the row lists them" do
      {:ok, publications} = Publication.insert_all(Codec.nest(@batch))
      fields = [:title, :year, :countries, :publishers, :sources]

      returned = Enum.map(publications, &(&1 |> Codec.flatten() |> Map.take(fields)))
      expected = Enum.map(@batch, &(&1 |> Map.put_new(:sources, []) |> Map.take(fields)))

      assert returned == expected
    end

    test "is returned with the authors of a book in the order of the row that stored it" do
      # Isabel Burton is stored as a translator before Richard Burton, so the
      # stored order of the two can differ from the order a row gives.
      by_both = fn title, year, translators ->
        Map.merge(@iracema, %{title: title, year: year, authors: translators})
      end

      batch =
        Codec.nest([
          by_both.("Iracema", 1887, ["Richard Burton", "Isabel Burton"]),
          by_both.("Iracema", 1888, ["Isabel Burton", "Richard Burton"])
        ])

      {:ok, [storing, reusing]} = Publication.insert_all(batch)
      assert Codec.flatten(storing).authors == ["Richard Burton", "Isabel Burton"]

      assert Codec.flatten(reusing).authors ==
               stored_authors(reusing.translated_book_id)
    end

    test "is stored with the same number of queries whatever its size" do
      assert queries(fn -> Publication.insert_all(works(3)) end) ==
               queries(fn -> Publication.insert_all(works(30)) end)
    end
  end

  describe "the error" do
    test "is the later of two rows with the same key" do
      [first, second | _] = Codec.nest(@batch)
      repeated = Map.put(first, "sources", [%{"content" => "A second copy", "position" => 0}])

      assert {:error, {^repeated, :conflict}} =
               Publication.insert_all([first, second, repeated])

      assert stored_count("publications") == 1
    end

    test "is the row with the key of a stored publication" do
      batch = Codec.nest(@batch)
      stored = Codec.nest(@iracema)

      assert {:error, {^stored, :conflict}} = Publication.insert_all(batch ++ [stored])
      assert stored_count("publications") == 1
      assert stored_count("authors") == 2
    end

    test "is a conflict among the rows before an invalid row, ahead of the invalid row" do
      [first | rest] = Codec.nest(@batch)
      invalid = Map.delete(first, "year")

      assert {:error, {^first, :conflict}} =
               Publication.insert_all([first | rest] ++ [first, invalid])
    end

    test "is an invalid row ahead of a conflict after it" do
      [first | rest] = Codec.nest(@batch)
      invalid = Map.delete(first, "year")

      assert {:error, {^invalid, %{year: :required}}} =
               Publication.insert_all([first | rest] ++ [invalid, first])

      assert stored_count("publications") == 1
    end
  end

  # Runs `fun` in a transaction that is rolled back, and returns what it
  # returned.
  defp rolled_back(fun) do
    {:error, result} = Repo.transaction(fn -> Repo.rollback(fun.()) end)
    result
  end

  # Returns what an import leaves stored: each publication that is not deleted
  # as it reads, with its fingerprints and its history, and the number of rows
  # in each table a publication write reaches. Ids and timestamps are left out,
  # because they differ between two runs.
  defp stored do
    publications =
      Publication.all()
      |> Enum.reject(& &1.deleted_at)
      |> Enum.map(fn publication ->
        %{
          flat: publication |> Codec.flatten() |> Map.delete(:id),
          fingerprints: [
            publication.countries_fingerprint,
            publication.publishers_fingerprint,
            publication.translated_book.authors_fingerprint,
            publication.translated_book.original_book.authors_fingerprint
          ],
          history:
            Enum.map(History.of(publication.id), fn entry ->
              {entry.version, entry.action, entry.actor, Map.delete(entry.snapshot, "id")}
            end)
        }
      end)
      |> Enum.sort()

    {publications, Map.new(@tables, &{&1, stored_count(&1)})}
  end

  defp stored_count(table), do: Repo.one(from(r in table, select: count()))

  # Returns the translators of the translated book with the id `id`, as a
  # preload reads them.
  defp stored_authors(id) do
    RichardBurton.TranslatedBook
    |> Repo.get!(id)
    |> Repo.preload(:authors)
    |> Map.fetch!(:authors)
    |> Enum.map(& &1.name)
  end

  # Returns `n` publications, each of a new book by new names.
  defp works(n) do
    Codec.nest(
      for i <- 1..n do
        %{
          title: "Work #{i}",
          year: 1900 + i,
          countries: ["US"],
          publishers: ["Press #{i}"],
          authors: ["Translator #{i}"],
          original_title: "Obra #{i}",
          original_authors: ["Author #{i}"],
          sources: ["Source #{i}"]
        }
      end
    )
  end

  # Returns the number of queries `fun` sends, rolling back what it writes.
  defp queries(fun) do
    test = self()
    handler = "count-queries-#{inspect(test)}"

    :telemetry.attach(
      handler,
      [:richard_burton, :repo, :query],
      fn _event, _measurements, _metadata, _config -> send(test, :query) end,
      nil
    )

    try do
      rolled_back(fn -> {:ok, _} = fun.() end)
      count_received(:query, 0)
    after
      :telemetry.detach(handler)
    end
  end

  defp count_received(message, count) do
    receive do
      ^message -> count_received(message, count + 1)
    after
      0 -> count
    end
  end
end

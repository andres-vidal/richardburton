defmodule Mix.Tasks.Rb.BackfillHistoryTest do
  @moduledoc """
  Tests for the task that gives unlogged publications a starting point
  """

  use RichardBurton.DataCase

  alias Mix.Tasks.Rb.BackfillHistory
  alias RichardBurton.Country
  alias RichardBurton.Publication
  alias RichardBurton.Publication.History
  alias RichardBurton.Publisher
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook

  @attrs %{
    "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
    "countries" => [%{"code" => "GB"}],
    "year" => 1886,
    "publishers" => [%{"name" => "Bickers & Son"}],
    "translated_book" => %{
      "authors" => [%{"name" => "Richard Burton"}],
      "original_book" => %{
        "authors" => [%{"name" => "J. M. Pereira da Silva"}],
        "title" => "Manuel de Moraes: crônica do século XVII"
      }
    }
  }

  # A publication in the state the original corpus is in: in the database,
  # loaded straight into the database, with nothing in the log. The history table
  # is append-only, so this is written the way such a record arrived rather than
  # by clearing one that was recorded properly.
  defp unlogged_publication do
    %Publication{}
    |> Publication.changeset(@attrs)
    |> Country.link()
    |> TranslatedBook.link()
    |> Publisher.link()
    |> Repo.insert!()
    |> Publication.preload()
  end

  describe "run/1" do
    test "gives a publication with no history a created entry for its current state" do
      publication = unlogged_publication()

      BackfillHistory.run([])

      assert [entry] = History.of(publication.id)
      assert entry.action == "created"
      assert entry.version == 1
      assert entry.actor == History.system_actor()
      # The record as it stands, so the next change has something to compare to.
      assert entry.snapshot["title"] == publication.title
      assert entry.snapshot["year"] == publication.year
      assert entry.snapshot["countries"] == "GB"
    end

    test "leaves a publication that already has history alone" do
      {:ok, publication} = Publication.insert(@attrs)
      before = History.of(publication.id)

      BackfillHistory.run([])

      assert History.of(publication.id) == before
    end

    test "adds nothing on a second run" do
      publication = unlogged_publication()

      BackfillHistory.run([])
      logged = History.of(publication.id)
      BackfillHistory.run([])

      assert History.of(publication.id) == logged
    end

    test "an update after the backfill says what it changed" do
      publication = unlogged_publication()
      BackfillHistory.run([])

      {:ok, updated} = Publication.update(publication.id, %{@attrs | "year" => 1887})

      assert [entry | _] = History.of(updated.id)
      assert entry.action == "updated"
      assert %{fields: %{"year" => %{from: 1886, to: 1887}}} = entry.diff
    end
  end
end

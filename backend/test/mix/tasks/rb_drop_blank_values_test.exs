defmodule Mix.Tasks.Rb.DropBlankValuesTest do
  @moduledoc """
  Tests for the blank-value repair task.
  """

  use RichardBurton.DataCase

  import ExUnit.CaptureIO

  alias Mix.Tasks.Rb.DropBlankValues
  alias RichardBurton.Publication
  alias RichardBurton.Publisher

  @attrs %{
    "title" => "A Brazilian Tenement",
    "year" => 1976,
    "countries" => ["US"],
    "publishers" => ["Howard Fertig"],
    "authors" => ["Harry W. Brown"],
    "original_authors" => ["Aluísio de Azevedo"],
    "original_title" => "O cortiço"
  }

  # The shape a trailing separator left behind, which nothing can write now.
  defp with_a_blank_publisher(publication) do
    {:ok, blank} = Repo.insert(Ecto.Changeset.change(%Publisher{}, name: ""))

    Repo.insert_all("publication_publishers", [
      %{publication_id: publication.id, publisher_id: blank.id}
    ])

    Publication.Index.Refresher.refresh()
    publication
  end

  defp publishers_of(id) do
    id |> Publication.find() |> Publication.preload() |> Map.get(:publishers)
  end

  setup do
    {:ok, publication} = @attrs |> Publication.Codec.nest() |> Publication.insert()
    [publication: with_a_blank_publisher(publication)]
  end

  test "drops the blank and leaves the real value", meta do
    DropBlankValues.run([])

    assert [%Publisher{name: "Howard Fertig"}] = publishers_of(meta.publication.id)
  end

  # Casting drops blank entries, so the record's snapshot never held one: to
  # the log the publication is what it always was, and an entry saying so would
  # claim a change nobody can see.
  test "writes no history entry, having changed nothing the record says", meta do
    DropBlankValues.run([])

    assert [%{action: "created"}] = Publication.History.of(meta.publication.id)
  end

  test "the index stops carrying the blank", meta do
    DropBlankValues.run([])

    assert [%{publishers: ["Howard Fertig"]}] =
             Repo.all(RichardBurton.FlatPublication)
             |> Enum.filter(&(&1.id == meta.publication.id))
  end

  test "leaves a publication that carries no blank alone" do
    DropBlankValues.run([])

    assert capture_io(fn -> DropBlankValues.run([]) end) =~ "No publication carries a blank"
  end
end

defmodule RichardBurton.VocabularyTest do
  @moduledoc """
  Tests for renaming the names a publication is built from.

  The point of most of these is the fingerprints: a publication's identity is
  built from these names, so a rename that leaves them stale leaves the
  database unable to tell one publication from another.
  """
  use RichardBurton.DataCase

  alias RichardBurton.Author
  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.Repo
  alias RichardBurton.Vocabulary

  @base %{
    "title" => "Dom Casmurro",
    "year" => 1953,
    "countries" => [%{"code" => "US"}],
    "publishers" => [%{"name" => "Noonday Press"}],
    "translated_book" => %{
      "authors" => [%{"name" => "Helen Caldwell"}],
      "original_book" => %{
        "title" => "Dom Casmurro",
        "authors" => [%{"name" => "Machado de Assis"}]
      }
    }
  }

  defp insert(attrs \\ %{}) do
    {:ok, publication} = Publication.insert(RichardBurton.Util.deep_merge_maps(@base, attrs))
    publication
  end

  defp id_of(schema, name), do: Repo.get_by!(schema, name: name).id

  defp fingerprints(publication) do
    reloaded = Repo.get!(Publication, publication.id)
    {reloaded.publishers_fingerprint, reloaded.translated_book_fingerprint}
  end

  describe "all/1" do
    test "counts the publications each name is on" do
      insert()
      insert(%{"title" => "Dom Casmurro (revised)"})
      insert(%{"title" => "Iracema", "publishers" => [%{"name" => "Bickers & Son"}]})

      names = Vocabulary.all("publishers")

      assert %{name: "Noonday Press", publications: 2} =
               Enum.find(names, &(&1.name == "Noonday Press"))

      assert %{name: "Bickers & Son", publications: 1} =
               Enum.find(names, &(&1.name == "Bickers & Son"))
    end

    test "a name nothing uses is still listed, at nought" do
      Repo.insert!(%Publisher{name: "Nobody's Press"})

      assert %{publications: 0} =
               Enum.find(Vocabulary.all("publishers"), &(&1.name == "Nobody's Press"))
    end

    test "an author is counted through both ways it reaches a publication" do
      # The same person as translator of one book and author of another.
      insert(%{"translated_book" => %{"authors" => [%{"name" => "Ana Lessa"}]}})

      insert(%{
        "title" => "Another",
        "translated_book" => %{
          "authors" => [%{"name" => "Someone Else"}],
          "original_book" => %{"title" => "Outro", "authors" => [%{"name" => "Ana Lessa"}]}
        }
      })

      assert %{publications: 2} =
               Enum.find(Vocabulary.all("authors"), &(&1.name == "Ana Lessa"))
    end

    test "a kind nobody has heard of is refused" do
      assert {:error, :no_such_kind} = Vocabulary.all("sandwiches")
    end
  end

  describe "rename/3 correcting a spelling" do
    test "the name changes and the publication's fingerprint follows" do
      publication = insert()
      before = fingerprints(publication)

      assert {:ok, :renamed} =
               Vocabulary.rename("publishers", id_of(Publisher, "Noonday Press"), "Noonday")

      assert Repo.get_by(Publisher, name: "Noonday") != nil
      refute fingerprints(publication) == before
    end

    test "renaming a translator moves the publication's identity too" do
      publication = insert()
      {_, translated_before} = fingerprints(publication)

      assert {:ok, :renamed} =
               Vocabulary.rename("authors", id_of(Author, "Helen Caldwell"), "H. Caldwell")

      {_, translated_after} = fingerprints(publication)
      refute translated_after == translated_before
    end

    test "renaming an original author moves it as well" do
      publication = insert()
      {_, translated_before} = fingerprints(publication)

      assert {:ok, :renamed} =
               Vocabulary.rename("authors", id_of(Author, "Machado de Assis"), "J. M. de Assis")

      {_, translated_after} = fingerprints(publication)
      refute translated_after == translated_before
    end

    test "a blank name is refused" do
      insert()

      assert {:error, :blank} =
               Vocabulary.rename("publishers", id_of(Publisher, "Noonday Press"), "   ")
    end

    test "a name is trimmed on the way in" do
      insert()

      {:ok, :renamed} =
        Vocabulary.rename("publishers", id_of(Publisher, "Noonday Press"), "  Noonday  ")

      assert Repo.get_by(Publisher, name: "Noonday") != nil
    end

    test "renaming something to what it is already called changes nothing" do
      insert()
      id = id_of(Publisher, "Noonday Press")

      assert {:ok, :renamed} = Vocabulary.rename("publishers", id, "Noonday Press")
      assert Repo.get(Publisher, id) != nil
    end
  end

  describe "rename/3 onto a name already taken" do
    test "the two become one, and its publications come with it" do
      kept = insert()
      stray = insert(%{"title" => "Iracema", "publishers" => [%{"name" => "Noonday press"}]})

      assert {:ok, :merged} =
               Vocabulary.rename(
                 "publishers",
                 id_of(Publisher, "Noonday press"),
                 "Noonday Press"
               )

      # One publisher where there were two...
      assert Repo.get_by(Publisher, name: "Noonday press") == nil
      assert Repo.aggregate(Publisher, :count) == 1

      # ...and both publications are on it.
      assert %{publications: 2} =
               Enum.find(Vocabulary.all("publishers"), &(&1.name == "Noonday Press"))

      # The one that moved has the surviving name's fingerprint.
      assert elem(fingerprints(stray), 0) == elem(fingerprints(kept), 0)
    end

    test "a publication crediting both spellings credits the survivor once" do
      publication =
        insert(%{
          "publishers" => [%{"name" => "Noonday Press"}, %{"name" => "Noonday press"}]
        })

      assert {:ok, :merged} =
               Vocabulary.rename(
                 "publishers",
                 id_of(Publisher, "Noonday press"),
                 "Noonday Press"
               )

      reloaded = Repo.preload(Repo.get!(Publication, publication.id), :publishers)
      assert length(reloaded.publishers) == 1
    end

    test "two spellings of one translator become one" do
      insert()

      insert(%{
        "title" => "Iracema",
        "translated_book" => %{"authors" => [%{"name" => "helen caldwell"}]}
      })

      assert {:ok, :merged} =
               Vocabulary.rename("authors", id_of(Author, "helen caldwell"), "Helen Caldwell")

      assert Repo.get_by(Author, name: "helen caldwell") == nil

      assert %{publications: 2} =
               Enum.find(Vocabulary.all("authors"), &(&1.name == "Helen Caldwell"))
    end
  end

  describe "rename/3 when it uncovers a duplicate" do
    test "it is refused, and says which publications clashed" do
      # The same publication entered twice, told apart only by the misspelling.
      kept = insert()
      hidden = insert(%{"publishers" => [%{"name" => "Noonday press"}]})

      before = {fingerprints(kept), fingerprints(hidden)}

      assert {:error, {:would_collide, clashing}} =
               Vocabulary.rename(
                 "publishers",
                 id_of(Publisher, "Noonday press"),
                 "Noonday Press"
               )

      # Both are named, so a person can go and look at them.
      assert length(clashing) == 2
      assert Enum.all?(clashing, &(&1.title == "Dom Casmurro"))

      # And nothing moved: the spellings, the fingerprints, all as they were.
      assert Repo.get_by(Publisher, name: "Noonday press") != nil
      assert {fingerprints(kept), fingerprints(hidden)} == before
    end
  end

  describe "rename/3 refusals" do
    test "a name that is not there" do
      assert {:error, :not_found} = Vocabulary.rename("publishers", 999_999, "Anything")
    end

    test "a kind that is not there" do
      assert {:error, :no_such_kind} = Vocabulary.rename("sandwiches", 1, "Anything")
    end
  end
end

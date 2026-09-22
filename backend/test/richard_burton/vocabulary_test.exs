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

  describe "all/1, on the names resembling each other" do
    test "each spelling points at the others, and says nothing where there are none" do
      insert(%{"publishers" => [%{"name" => "Penguin Books"}]})
      insert(%{"title" => "Iracema", "publishers" => [%{"name" => "Penguin books"}]})
      insert(%{"title" => "Esau and Jacob", "publishers" => [%{"name" => "Peter Owen"}]})

      names = Vocabulary.all("publishers")
      by_name = Map.new(names, &{&1.name, &1})

      assert by_name["Penguin Books"].resembles == [by_name["Penguin books"].id]
      assert by_name["Penguin books"].resembles == [by_name["Penguin Books"].id]
      assert by_name["Peter Owen"].resembles == []
    end

    test "refuses a kind it does not keep" do
      assert {:error, :no_such_kind} = Vocabulary.all("countries")
    end
  end

  describe "resemblances/2" do
    test "says nothing about a name the vocabulary already holds exactly" do
      insert()

      {:ok, [entry]} = Vocabulary.resemblances("publishers", ["Noonday Press"])

      assert %{name: "Noonday Press", held: true, resembles: []} = entry
    end

    test "a name nothing here is near is simply new" do
      insert()

      {:ok, [entry]} = Vocabulary.resemblances("publishers", ["Tagus Press"])

      assert %{name: "Tagus Press", held: false, resembles: []} = entry
    end

    test "catches the spelling that differs only in case" do
      insert()

      {:ok, [entry]} = Vocabulary.resemblances("publishers", ["noonday press"])

      assert %{held: false, resembles: [%{name: "Noonday Press", publications: 1}]} = entry
    end

    test "catches a dropped space, and says how much rests on the other spelling" do
      insert(%{"publishers" => [%{"name" => "Alfred A. Knopf"}]})
      insert(%{"title" => "Iracema", "publishers" => [%{"name" => "Alfred A. Knopf"}]})

      {:ok, [entry]} = Vocabulary.resemblances("publishers", ["Alfred A.Knopf"])

      assert %{held: false, resembles: [%{name: "Alfred A. Knopf", publications: 2}]} = entry
    end

    test "a translator is found whether the name translated or wrote" do
      insert()

      {:ok, [translator, author]} =
        Vocabulary.resemblances("authors", ["Helen Caldwel", "Machado de Assiz"])

      assert %{resembles: [%{name: "Helen Caldwell"}]} = translator
      assert %{resembles: [%{name: "Machado de Assis"}]} = author
    end

    test "the established spelling comes first" do
      insert(%{"publishers" => [%{"name" => "Penguin Books"}]})
      insert(%{"title" => "Iracema", "publishers" => [%{"name" => "Penguin Books"}]})
      insert(%{"title" => "Esau and Jacob", "publishers" => [%{"name" => "Penguin Book"}]})

      {:ok, [entry]} = Vocabulary.resemblances("publishers", ["Penguin books"])

      assert [%{name: "Penguin Books", publications: 2}, %{name: "Penguin Book", publications: 1}] =
               entry.resembles
    end

    test "trims, drops blanks and asks about each name once" do
      insert()

      {:ok, entries} =
        Vocabulary.resemblances("publishers", ["  Noonday Press  ", "", "Noonday Press", "   "])

      assert [%{name: "Noonday Press", held: true}] = entries
    end

    test "nothing asked is nothing answered" do
      assert {:ok, []} = Vocabulary.resemblances("publishers", [])
    end

    test "refuses a kind it does not keep" do
      assert {:error, :no_such_kind} = Vocabulary.resemblances("countries", ["Brazil"])
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
                 "Noonday Press",
                 true
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
                 "Noonday Press",
                 true
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
               Vocabulary.rename(
                 "authors",
                 id_of(Author, "helen caldwell"),
                 "Helen Caldwell",
                 true
               )

      assert Repo.get_by(Author, name: "helen caldwell") == nil

      assert %{publications: 2} =
               Enum.find(Vocabulary.all("authors"), &(&1.name == "Helen Caldwell"))
    end
  end

  describe "rename/3 onto a name already taken, unasked" do
    test "nothing is written, and it says who holds the name" do
      insert()
      insert(%{"title" => "Iracema", "publishers" => [%{"name" => "Noonday press"}]})

      assert {:error, {:would_fold, keeper}} =
               Vocabulary.rename(
                 "publishers",
                 id_of(Publisher, "Noonday press"),
                 "Noonday Press"
               )

      # Named and counted, which is what makes the question answerable.
      assert %{name: "Noonday Press", publications: 1} = keeper

      # Both spellings still stand.
      assert Repo.aggregate(Publisher, :count) == 2
    end

    test "correcting onto a free name needs no such permission" do
      insert()

      assert {:ok, :renamed} =
               Vocabulary.rename("publishers", id_of(Publisher, "Noonday Press"), "Noonday")
    end

    test "renaming a name to itself is not a fold" do
      insert()
      id = id_of(Publisher, "Noonday Press")

      assert {:ok, :renamed} = Vocabulary.rename("publishers", id, "Noonday Press")
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
                 "Noonday Press",
                 true
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

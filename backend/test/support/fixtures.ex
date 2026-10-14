defmodule RichardBurton.Fixtures do
  @moduledoc """
  Records a test needs to exist but is not the subject of it.
  """

  alias RichardBurton.Author
  alias RichardBurton.Document
  alias RichardBurton.OriginalBook
  alias RichardBurton.Publication
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook
  alias RichardBurton.User

  @doc """
  A user holding `role`. Accounts are born readers, so anything else is a
  promotion — the same one the dashboard makes.
  """
  def user_fixture(email, role \\ :reader) do
    {:ok, user} = User.insert(%{"subject_id" => "sub-#{email}", "email" => email})
    {:ok, user} = User.set_role(user, role)
    user
  end

  @doc "Creates an import document named `name`."
  def document_fixture(name \\ "Second pass") do
    {:ok, document} = Document.create(%{"name" => name})
    document
  end

  @doc "Returns the stored author named `name`, and inserts it when there is none."
  def author_fixture(name) do
    Repo.get_by(Author, name: name) || Repo.insert!(%Author{name: name})
  end

  @doc """
  Inserts an original book titled `title` by the authors named `authors`,
  reusing stored authors. It does not look for a stored book with the same key
  first, so it can store a second one.
  """
  def original_book_fixture(title, authors) do
    %OriginalBook{title: title}
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:authors, Enum.map(authors, &author_fixture/1))
    |> Repo.insert!()
  end

  @doc """
  Inserts a translated book of `original_book` by the translators named
  `translators`, reusing stored authors. It does not look for a stored book
  with the same key first, so it can store a second one.
  """
  def translated_book_fixture(original_book, translators) do
    %TranslatedBook{original_book_id: original_book.id}
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:authors, Enum.map(translators, &author_fixture/1))
    |> Repo.insert!()
  end

  @doc """
  Returns seven flat publications of five works, for tests that count them.
  Dom Casmurro has two translations, and Helen Caldwell's translation is
  published twice. John Gledson's Dom Casmurro names two countries, and two
  publications cite a source.
  """
  def insights_corpus do
    [
      %{
        title: "Dom Casmurro",
        year: 1953,
        countries: ["US"],
        publishers: ["Noonday Press"],
        authors: ["Helen Caldwell"],
        original_title: "Dom Casmurro",
        original_authors: ["Machado de Assis"],
        sources: ["Caldwell, Helen. Introduction, 1953."]
      },
      %{
        title: "Dom Casmurro",
        year: 1966,
        countries: ["US"],
        publishers: ["University of California Press"],
        authors: ["Helen Caldwell"],
        original_title: "Dom Casmurro",
        original_authors: ["Machado de Assis"]
      },
      %{
        title: "Dom Casmurro",
        year: 1997,
        countries: ["GB", "US"],
        publishers: ["Oxford University Press"],
        authors: ["John Gledson"],
        original_title: "Dom Casmurro",
        original_authors: ["Machado de Assis"]
      },
      %{
        title: "Epitaph of a Small Winner",
        year: 1952,
        countries: ["US"],
        publishers: ["Noonday Press"],
        authors: ["William Grossman"],
        original_title: "Memórias póstumas de Brás Cubas",
        original_authors: ["Machado de Assis"]
      },
      %{
        title: "The Hour of the Star",
        year: 1986,
        countries: ["GB"],
        publishers: ["Carcanet"],
        authors: ["Giovanni Pontiero"],
        original_title: "A hora da estrela",
        original_authors: ["Clarice Lispector"]
      },
      %{
        title: "The Passion According to G.H.",
        year: 1988,
        countries: ["US"],
        publishers: ["University of Minnesota Press"],
        authors: ["Ronald W. Sousa"],
        original_title: "A paixão segundo G.H.",
        original_authors: ["Clarice Lispector"]
      },
      %{
        title: "Iraçéma the Honey-Lips",
        year: 1886,
        countries: ["GB"],
        publishers: ["Bickers & Son"],
        authors: ["Isabel Burton"],
        original_title: "Iracema",
        original_authors: ["José de Alencar"],
        sources: ["Burton, Isabel. Preface, 1886."]
      }
    ]
  end

  @doc """
  Inserts flat publications the way an import does, then refreshes the index
  that the insights and the charts read from.
  """
  def seed_index(publications) do
    publications
    |> Publication.Codec.nest()
    |> Enum.each(&({:ok, _} = Publication.insert(&1)))

    Publication.Index.Refresher.refresh()
  end
end

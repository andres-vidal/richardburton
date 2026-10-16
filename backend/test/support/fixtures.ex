defmodule RichardBurton.Fixtures do
  @moduledoc """
  Records a test needs to exist but is not the subject of it, and builders of
  the nodes of rich text, as `RichardBurton.RichText` describes them.
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
  Returns rich text with a paragraph for each of `texts`, a string or a list
  of them. Each paragraph holds one run of text without marks.
  """
  def paragraphs(texts), do: texts |> List.wrap() |> Enum.map(&paragraph/1)

  @doc """
  Returns a run of rich text that holds `text`, with the marks in `marks`,
  such as `%{"bold" => true}`.
  """
  def run(text, marks \\ %{}), do: Map.merge(%{"text" => text}, marks)

  @doc """
  Returns a paragraph that holds `inlines`, or one run of `text` without marks
  when given a string.
  """
  def paragraph(text) when is_binary(text), do: paragraph([run(text)])
  def paragraph(inlines), do: %{"type" => "paragraph", "children" => inlines}

  @doc """
  Returns a list item of `kind`, `"bulleted"` or `"numbered"`, at `depth`,
  that holds `inlines`, or one run of `text` without marks when given a
  string.
  """
  def item(kind, depth, text) when is_binary(text), do: item(kind, depth, [run(text)])

  def item(kind, depth, inlines),
    do: %{"type" => "list-item", "list" => kind, "depth" => depth, "children" => inlines}

  @doc """
  Returns a link to `url` that holds `runs`, or one run of `text` without
  marks when given a string.
  """
  def link(url, text) when is_binary(text), do: link(url, [run(text)])
  def link(url, runs), do: %{"type" => "link", "url" => url, "children" => runs}

  @doc """
  Returns a flat publication with atom keys: Dom Casmurro in Helen Caldwell's
  translation, published by Noonday Press in the United States in 1953, with
  no source. The fields in `changes`, given with atom keys, replace its own.
  """
  def flat_publication_attrs(changes \\ %{}) do
    Map.merge(
      %{
        title: "Dom Casmurro",
        year: 1953,
        countries: ["US"],
        publishers: ["Noonday Press"],
        authors: ["Helen Caldwell"],
        original_title: "Dom Casmurro",
        original_authors: ["Machado de Assis"]
      },
      changes
    )
  end

  @doc """
  Returns what `flat_publication_attrs/1` returns for `changes`, in the nested
  shape `Publication.insert/2` and `Publication.update/3` take.
  """
  def publication_attrs(changes \\ %{}) do
    changes |> flat_publication_attrs() |> Publication.Codec.nest()
  end

  @doc """
  Inserts the publication `publication_attrs/1` returns for `changes`, and
  returns it, preloaded.
  """
  def publication_fixture(changes \\ %{}) do
    {:ok, publication} = changes |> publication_attrs() |> Publication.insert()
    publication
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
  Inserts flat publications as one import, which also refreshes the index, and
  returns them, preloaded, in order.
  """
  def seed_index(publications) do
    {:ok, inserted} = publications |> Publication.Codec.nest() |> Publication.insert_all()
    inserted
  end
end

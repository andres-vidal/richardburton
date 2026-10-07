defmodule RichardBurton.Fixtures do
  @moduledoc """
  Records a test needs to exist but is not the subject of it.
  """

  alias RichardBurton.Author
  alias RichardBurton.Document
  alias RichardBurton.OriginalBook
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
end

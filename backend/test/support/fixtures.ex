defmodule RichardBurton.Fixtures do
  @moduledoc """
  Records a test needs to exist but is not the subject of it.
  """

  alias RichardBurton.Document
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

  @doc "An import document under `name`."
  def document_fixture(name \\ "Second pass") do
    {:ok, document} = Document.create(%{"name" => name})
    document
  end
end

defmodule RichardBurtonWeb.VocabularyController do
  @moduledoc """
  The names a publication is built from, and the one thing that can be done to
  them.

  There is no create and no delete. A name exists because a publication uses it,
  and stops existing when nothing does — see `RichardBurton.Vocabulary`.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.Vocabulary

  def index(conn, %{"kind" => kind}) do
    case Vocabulary.all(kind) do
      {:error, :no_such_kind} -> not_found(conn)
      entries -> json(conn, %{entries: entries, kinds: Vocabulary.kinds()})
    end
  end

  @doc """
  Rename one.

  Renaming to a name nothing else holds corrects a spelling; renaming to one
  already taken folds the two together. The reply says which happened.
  """
  def update(conn, %{"kind" => kind, "id" => id, "name" => name}) do
    case Vocabulary.rename(kind, id, name) do
      {:ok, outcome} ->
        json(conn, %{outcome: outcome})

      {:error, {:would_collide, publications}} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: :would_collide, publications: publications})

      {:error, :no_such_kind} ->
        not_found(conn)

      {:error, :not_found} ->
        not_found(conn)

      {:error, :blank} ->
        conn |> put_status(:bad_request) |> json(%{error: :blank})
    end
  end

  defp not_found(conn) do
    conn |> put_status(:not_found) |> json(%{error: :not_found})
  end
end

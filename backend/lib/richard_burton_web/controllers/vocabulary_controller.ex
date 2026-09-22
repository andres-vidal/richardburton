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
  Which of the names given are already here, and which look like misspellings of
  a name already here.

  A question rather than a change, but it is posted: a batch being entered can
  carry more names than a URL should.
  """
  def resemblances(conn, %{"kind" => kind, "names" => names}) when is_list(names) do
    case Vocabulary.resemblances(kind, names) do
      {:ok, entries} -> json(conn, %{entries: entries})
      {:error, :no_such_kind} -> not_found(conn)
    end
  end

  @doc """
  Rename one.

  Renaming to a name nothing else holds corrects a spelling; renaming to one
  already taken folds the two together. The reply says which happened.

  A fold has to be asked for: without `"fold" => true` the reply is 409 and
  nothing is written, naming who holds the name so the request can be put to
  the person before it is made again.
  """
  def update(conn, params = %{"kind" => kind, "id" => id, "name" => name}) do
    case Vocabulary.rename(kind, id, name, params["fold"] == true) do
      {:ok, outcome} ->
        json(conn, %{outcome: outcome})

      {:error, {:would_fold, keeper}} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: :would_fold, into: keeper})

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

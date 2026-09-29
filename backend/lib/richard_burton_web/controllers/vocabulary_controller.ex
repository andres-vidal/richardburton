defmodule RichardBurtonWeb.VocabularyController do
  @moduledoc """
  Lists, checks and renames the author and publisher names that publications
  are built from. See `RichardBurton.Vocabulary`.

  There are no create or delete actions. A name is created when a publication
  that uses it is saved. It is deleted only when a rename folds it into another
  name, and a name that no publication uses stays in the list.
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
  Returns, for each name in `"names"`, whether it is already stored and which
  stored names it resembles. See `RichardBurton.Vocabulary.resemblances/2`.

  This action writes nothing. It is a POST because the list of names can be
  too long for a URL.
  """
  def resemblances(conn, %{"kind" => kind, "names" => names}) when is_list(names) do
    case Vocabulary.resemblances(kind, names) do
      {:ok, entries} -> json(conn, %{entries: entries})
      {:error, :no_such_kind} -> not_found(conn)
    end
  end

  @doc """
  Renames a name, and responds with `outcome` set to `"renamed"` or
  `"merged"`. See `RichardBurton.Vocabulary.rename/4`.

  Folding into a name that is already taken requires `"fold" => true`. Without
  it, nothing is written and the response is 409 with `error: "would_fold"` and
  `into`, the name that has it. A rename that would give two publications the
  same identity is also a 409, with `error: "would_collide"` and the
  `publications` involved.
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

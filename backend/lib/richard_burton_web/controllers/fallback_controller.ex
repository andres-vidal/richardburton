defmodule RichardBurtonWeb.FallbackController do
  @moduledoc """
  Answers an action that returned an error instead of a response.

  Every controller names this with `action_fallback` (see `RichardBurtonWeb`),
  so an action's `with` can stop at the first thing that fails and return it.
  The same failure then gets the same status and body from every endpoint.

    * `{:error, :not_found}` is a 404.
    * `{:error, reason}` with an atom is a 409 when the reason is a conflict,
      and a 400 otherwise. The body is `%{error: reason}`.
    * `{:error, status, reason}` answers with that status and
      `%{error: reason}`, for a refusal whose status is not the one its reason
      gets everywhere else.
    * `{:error, changeset}`, or `{:error, errors}` with a map of errors by field,
      is a 400 whose body is `%{errors: errors}`.

  A **conflict** is a sound request refused because of the state it met, as
  opposed to a request that was wrong in itself. The conflicts are a record that
  already exists (`:conflict`), a record held inside another (`:absorbed`),
  demoting the last admin (`:last_admin`), changing one's own role (`:self`),
  and an invitation already taken up (`:accepted`) or already waiting
  (`:pending`).
  """

  use Phoenix.Controller, formats: [:json]

  import Plug.Conn

  alias RichardBurton.Validation

  @conflicts [:conflict, :absorbed, :last_admin, :self, :accepted, :pending]

  def call(conn, {:error, :not_found}), do: refuse(conn, :not_found, %{error: :not_found})

  def call(conn, {:error, status, reason}) when is_atom(status) and is_atom(reason),
    do: refuse(conn, status, %{error: reason})

  def call(conn, {:error, changeset = %Ecto.Changeset{}}),
    do: call(conn, {:error, Validation.get_errors(changeset)})

  def call(conn, {:error, reason}) when reason in @conflicts,
    do: refuse(conn, :conflict, %{error: reason})

  def call(conn, {:error, reason}) when is_atom(reason),
    do: refuse(conn, :bad_request, %{error: reason})

  def call(conn, {:error, errors}) when is_map(errors),
    do: refuse(conn, :bad_request, %{errors: errors})

  @doc """
  A record looked up by id, as `{:ok, record}`, or `{:error, :not_found}` where
  the lookup found nothing. It lets a lookup that answers `nil` take part in a
  `with`.
  """
  def found(nil), do: {:error, :not_found}
  def found(record), do: {:ok, record}

  # Answers with the status and body, and ends the request.
  defp refuse(conn, status, body), do: conn |> put_status(status) |> json(body)
end

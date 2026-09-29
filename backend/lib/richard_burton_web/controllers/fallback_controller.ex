defmodule RichardBurtonWeb.FallbackController do
  @moduledoc """
  Turns an error returned by a controller action into a JSON response.

  Every controller sets this as its `action_fallback` (see `RichardBurtonWeb`),
  so an action's `with` can return the first error it meets. Each kind of error
  then gets the same status and body from every endpoint.

    * `{:error, :not_found}` is a 404.
    * `{:error, reason}` with an atom is a 409 when the reason is a conflict,
      and a 400 otherwise. The body is `%{error: reason}`.
    * `{:error, status, reason}` responds with that status and
      `%{error: reason}`. An action returns it when it needs a different status
      from the one the reason normally gets.
    * `{:error, changeset}`, or `{:error, errors}` with a map of errors by field,
      is a 400 whose body is `%{errors: errors}`.

  A **conflict** is a valid request that is refused because of the current
  state of the data, as opposed to a malformed request. The conflicts are a
  record that already exists (`:conflict`), a record held inside another
  (`:absorbed`), demoting the last admin (`:last_admin`), changing one's own
  role (`:self`), and an invitation already accepted (`:accepted`) or already
  pending (`:pending`).
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
  Returns `{:ok, record}`, or `{:error, :not_found}` when `record` is `nil`.
  It lets a lookup that returns `nil` be used in a `with`.
  """
  def found(nil), do: {:error, :not_found}
  def found(record), do: {:ok, record}

  # Sends `body` as JSON with `status`.
  defp refuse(conn, status, body), do: conn |> put_status(status) |> json(body)
end

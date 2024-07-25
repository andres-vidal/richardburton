defmodule RichardBurtonWeb.FallbackController do
  use Phoenix.Controller

  alias RichardBurton.Validation

  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    conn
    |> put_status(:bad_request)
    |> json(%{errors: changeset |> Validation.get_errors()})
  end
end

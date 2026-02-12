defmodule RichardBurtonWeb.EmailController do
  use RichardBurtonWeb, :controller
  alias RichardBurton.Email

  @spec contact(Plug.Conn.t(), any()) :: Plug.Conn.t()
  def contact(conn, params) do
    case Email.contact(params) do
      :ok ->
        json(conn, %{message: "Email sent."})

      {:error, {:invalid, issues}} ->
        conn |> put_status(400) |> json(%{issues: issues})

      {:error, reason} ->
        throw(reason)
    end
  end
end

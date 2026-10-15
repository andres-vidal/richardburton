defmodule RichardBurtonWeb.EmailController do
  @moduledoc """
  The public contact form. It is the only write that needs no session, so a
  reCAPTCHA check guards it instead.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.Email

  @doc """
  Sends a contact-form message, as `RichardBurton.Email.contact/1` does.

  Invalid fields are a 400 with `errors` by field. A message the mailer could
  not send is a 502 with `unsent`.
  """
  @spec contact(Plug.Conn.t(), map()) :: Plug.Conn.t() | {:error, term()}
  def contact(conn, params) do
    with :ok <- Email.contact(params), do: json(conn, %{message: "Email sent."})
  end
end

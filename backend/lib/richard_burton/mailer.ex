defmodule RichardBurton.Mailer do
  @moduledoc """
  Behaviour for Mailer
  """

  @callback send(email :: RichardBurton.Email.t()) :: {:ok, String.t()} | {:error, String.t()}

  @spec send(email :: RichardBurton.Email.t()) :: {:ok, any()} | {:error, any()}
  def send(email), do: impl().send(email)

  # The configured implementation of the mailer, so tests can supply a double.
  defp impl,
    do: Application.get_env(:richard_burton, :mailer, RichardBurton.Mailer.SMTP)
end

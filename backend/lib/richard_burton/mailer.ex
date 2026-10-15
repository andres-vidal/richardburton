defmodule RichardBurton.Mailer do
  @moduledoc """
  Sends a `RichardBurton.Email` through Swoosh.

  The Swoosh adapter is the `:mailer_adapter` application setting, and SMTP
  when it is unset. The SMTP settings are read from the environment on every
  send.
  """

  import Swoosh.Email

  use Swoosh.Mailer, otp_app: :richard_burton

  # SMTP settings from the environment, over the adapter's defaults.
  defp config() do
    Keyword.merge(
      [
        adapter: Application.get_env(:richard_burton, :mailer_adapter, Swoosh.Adapters.SMTP),
        relay: System.get_env("SMTP_HOST"),
        username: System.get_env("SMTP_USER"),
        port: System.get_env("SMTP_PORT"),
        tls: System.get_env("SMTP_TLS"),
        retries: 1,
        no_mx_lookups: false
      ],
      config_auth(System.get_env("SMTP_PASS"))
    )
  end

  # Authenticates with `SMTP_PASS` when it is set and not empty. Without a
  # password the relay is used without authentication, as a relay on the local
  # network allows.
  defp config_auth(nil), do: [auth: :never]
  defp config_auth(""), do: [auth: :never]
  defp config_auth(password), do: [password: password]

  @doc """
  Sends `email`, and returns what the adapter returns: `{:ok, result}` or
  `{:error, reason}`.

  An adapter that raises, as Swoosh's SMTP adapter does when `SMTP_HOST` is
  unset, gives `{:error, exception}`.
  """
  @spec send(RichardBurton.Email.t()) :: {:ok, any()} | {:error, any()}
  def send(email) do
    deliver(get_swoosh_email(email), config())
  rescue
    exception -> {:error, exception}
  end

  @spec get_swoosh_email(RichardBurton.Email.t()) :: Swoosh.Email.t()
  # The Swoosh email for `email`. An email with no `to` is a contact-form
  # message: it goes to `SMTP_ADMIN_INBOX`, with the writer as the reply-to
  # address. An email with a `to` goes there with its subject unchanged.
  defp get_swoosh_email(email = %{message: message, address: address, to: nil}) do
    new(
      from: get_from(),
      to: System.get_env("SMTP_ADMIN_INBOX"),
      subject: get_subject(email),
      text_body: message,
      reply_to: address
    )
  end

  defp get_swoosh_email(%{subject: subject, message: message, to: to}) do
    new(
      from: get_from(),
      to: to,
      subject: subject,
      text_body: message
    )
  end

  # The sender, `SMTP_NAME` at `SMTP_FROM`. The SMTP relay only sends from an
  # address it owns, so a contact-form message names its writer in the subject
  # and the reply-to address instead.
  defp get_from(),
    do: {System.get_env("SMTP_NAME"), System.get_env("SMTP_FROM")}

  # The subject of a contact-form message, followed by the writer's name and
  # address.
  defp get_subject(email = %{address: address, subject: subject}),
    do: "#{subject} (from #{get_contact_name(email)}<#{address}>)"

  # The writer's name, with their institution when they gave one.
  defp get_contact_name(%{name: name, institution: nil}), do: name
  defp get_contact_name(%{name: name, institution: ""}), do: name
  defp get_contact_name(%{name: name, institution: institution}), do: "#{name} (#{institution})"
end

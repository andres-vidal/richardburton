defmodule RichardBurton.Mailer.SMTP do
  @moduledoc """
  STMP implementation for RichardBurton.Mailer behaviour
  """
  @behaviour RichardBurton.Mailer

  import Swoosh.Email

  use Swoosh.Mailer, otp_app: :richard_burton

  defp config() do
    Keyword.merge(
      [
        # SMTP in dev/prod; overridden to Swoosh's test adapter under test so the
        # suite can assert on built emails without opening a connection.
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

  defp config_auth(nil), do: [auth: :never]
  defp config_auth(""), do: [auth: :never]
  defp config_auth(password), do: [password: password]

  @spec send(RichardBurton.Email.t()) :: {:ok, any()} | {:error, any()}
  def send(email) do
    case deliver(get_swoosh_email(email), config()) do
      {:ok, payload} -> {:ok, payload}
      {:error, reason} -> {:error, reason}
    end
  end

  @spec get_swoosh_email(RichardBurton.Email.t()) :: Swoosh.Email.t()
  defp get_swoosh_email(email = %{message: message, address: address, to: nil}) do
    new(
      from: get_from(),
      to: System.get_env("SMTP_ADMIN_INBOX"),
      subject: get_subject(email),
      text_body: message,
      reply_to: address
    )
  end

  @spec get_swoosh_email(RichardBurton.Email.t()) :: Swoosh.Email.t()
  defp get_swoosh_email(%{subject: subject, message: message, to: to}) do
    new(
      from: get_from(),
      to: to,
      subject: subject,
      text_body: message
    )
  end

  defp get_from(),
    do: {System.get_env("SMTP_NAME"), System.get_env("SMTP_FROM")}

  defp get_subject(email = %{address: address, subject: subject}),
    do: "#{subject} (from #{get_contact_name(email)}<#{address}>)"

  defp get_contact_name(%{name: name, institution: nil}), do: name
  defp get_contact_name(%{name: name, institution: ""}), do: name
  defp get_contact_name(%{name: name, institution: institution}), do: "#{name} (#{institution})"
  defp get_contact_name(%{name: name}), do: name
end

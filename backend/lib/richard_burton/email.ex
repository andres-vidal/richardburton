defmodule RichardBurton.Email do
  @moduledoc """
  An email the platform sends: a message from the contact form to the research
  team, or a message the platform writes itself, such as a confirmation or an
  invitation.

  An email without `to` is a contact-form message, and `RichardBurton.Mailer`
  sends it to the research team. An email with `to` is sent to that address.
  The schema is never stored. It only validates the contact form's fields.
  """
  use Ecto.Schema
  import Ecto.Changeset
  import EctoCommons.EmailValidator

  alias RichardBurton.Email
  alias RichardBurton.Mailer

  # Who the platform is when it writes an email itself.
  @platform "Richard & Isabel Burton Platform"

  @typedoc "An email, as the contact form fills it in or as the platform writes it."
  @type t :: %__MODULE__{}

  schema "emails" do
    field :name, :string
    field :institution, :string
    field :address, :string
    field :subject, :string
    field :message, :string
    field :to, :string
  end

  @doc """
  Casts the contact form's fields. `name`, `address`, `subject` and `message`
  are required, and `address` must be an email address. `to` is not cast, so
  a contact-form message always goes to the research team.
  """
  def changeset(email, params) do
    email
    |> cast(params, [:name, :institution, :address, :subject, :message])
    |> validate_required([:name, :address, :subject, :message])
    |> validate_email(:address)
  end

  @doc """
  Sends `message` to the address `to`, from the platform itself. Returns `:ok`,
  or `{:error, :unsent}` when the mailer fails to send it.
  """
  def deliver(to: to, subject: subject, message: message) do
    send_email(%Email{
      name: @platform,
      institution: "IFRS Canoas",
      address: System.get_env("SMTP_FROM"),
      subject: subject,
      message: message,
      to: to
    })
  end

  @doc """
  Sends a contact-form message to the research team, then a copy of it to the
  writer as a confirmation.

  Returns `:ok` once the message is sent, whether the confirmation is sent or
  not. Returns `{:error, changeset}` when a field is invalid, and
  `{:error, :unsent}` when the mailer fails to send the message.
  """
  def contact(params) do
    with {:ok, email} <- %Email{} |> changeset(params) |> apply_action(:insert),
         :ok <- send_email(email) do
      deliver(
        to: email.address,
        subject: "Contact Confirmation from #{@platform}",
        message: confirmation(email)
      )

      :ok
    end
  end

  # Sends `email` with `RichardBurton.Mailer`. Returns `:ok`, or
  # `{:error, :unsent}` whatever the reason the mailer gives for failing.
  defp send_email(email) do
    case Mailer.send(email) do
      {:ok, _} -> :ok
      {:error, _reason} -> {:error, :unsent}
    end
  end

  # The body of the confirmation sent to the writer: a thank-you, then the
  # fields of their message.
  defp confirmation(email) do
    """
    Thank you for contacting the Richard & Isabel Burton Platform research team. We will get back to you as soon as possible.

    The contact information and message you sent are as follows:

    Name: #{email.name}
    Institution: #{email.institution}
    Email: #{email.address}
    Subject: #{email.subject}
    Message: #{email.message}
    """
  end
end

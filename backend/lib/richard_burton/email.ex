defmodule RichardBurton.Email do
  @moduledoc """
  Schema for emails
  """
  use Ecto.Schema
  import Ecto.Changeset
  import EctoCommons.EmailValidator

  alias RichardBurton.Email
  alias RichardBurton.Mailer

  schema "emails" do
    field :name, :string
    field :institution, :string
    field :address, :string
    field :subject, :string
    field :message, :string
    field :to, :string
  end

  def changeset(email, params) do
    email
    |> cast(params, [:name, :institution, :address, :subject, :message])
    |> validate_required([:name, :address, :subject, :message])
    |> validate_email(:address)
  end

  def contact(params) do
    case changeset = Email.changeset(%Email{}, params) do
      %Ecto.Changeset{valid?: true} ->
        changeset |> Ecto.Changeset.apply_changes() |> send_email(confirmation: true)

      %Ecto.Changeset{valid?: false} ->
        {:error, {:invalid, RichardBurton.Validation.get_errors(changeset)}}
    end
  end

  defp send_email(email, confirmation: false) do
    case Mailer.send(email) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp send_email(email = %{address: address}, confirmation: true) do
    case Mailer.send(email) do
      {:ok, _} ->
        send_email(
          %{
            name: "Richard & Isabel Burton Platform",
            institution: "IFRS Canoas",
            address: System.get_env("SMTP_FROM"),
            subject: "Contact Confirmation from Richard & Isabel Burton Platform",
            message: get_confimation_message(email),
            to: address
          },
          confirmation: false
        )

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp get_confimation_message(email) do
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

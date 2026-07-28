defmodule RichardBurton.Invitation do
  @moduledoc """
  A role held for an email address until whoever owns it signs in.

  An admin cannot grant a role to someone who has never been here: the provider
  mints the subject id, and only on a first sign-in. So the grant waits on the
  address instead, and the sign-in redeems it — the provider vouching for that
  address *is* the confirmation, which is why no separate confirmation link is
  sent. Everything this rests on is therefore the identity provider's word: see
  `RichardBurton.Auth.Claims`, which refuses a token that does not carry a
  verified email.

  Someone who already has an account is given the role outright; there is
  nothing left to wait for.
  """
  use Ecto.Schema

  import Ecto.Changeset
  import Ecto.Query
  import EctoCommons.EmailValidator

  alias RichardBurton.Email
  alias RichardBurton.Invitation
  alias RichardBurton.Mailer
  alias RichardBurton.Repo
  alias RichardBurton.User
  alias RichardBurton.Validation

  @derive {Jason.Encoder, only: [:id, :email, :role, :accepted_at, :inserted_at]}
  schema "invitations" do
    field :email, :string
    field :role, Ecto.Enum, values: [:reader, :contributor, :admin]
    field :accepted_at, :utc_datetime

    belongs_to :invited_by, User

    timestamps()
  end

  @doc false
  def changeset(invitation, attrs) do
    invitation
    |> cast(attrs, [:email, :role, :invited_by_id])
    |> validate_required([:email, :role])
    |> update_change(:email, &String.trim/1)
    |> validate_email(:email)
    |> unique_constraint(:email, name: :invitations_pending_email_index)
  end

  @doc "Every invitation, newest first — pending ones and the ones taken up."
  def all do
    from(i in Invitation, order_by: [desc: i.inserted_at], preload: [:invited_by])
    |> Repo.all()
  end

  def get(id), do: Repo.get(Invitation, id)

  @doc """
  Offer `role` to an address, and say so by email.

  Someone who has already signed in gets the role now — there is no sign-in left
  to wait for — and no invitation is recorded. The mail is sent after the grant
  lands, so a mail server having a bad day cannot cost someone their role; a
  failure to send is reported so the dashboard can offer to send it again.
  """
  def invite(attrs, invited_by \\ nil) do
    email = attrs |> Map.get("email", "") |> to_string() |> String.trim()

    case User.get_by_email(email) do
      nil -> offer(attrs, invited_by)
      user -> promote(user, attrs)
    end
  end

  @doc """
  Take up the invitation waiting for a user's address, if one is.

  Called as an account is created, so a person invited before they had one
  arrives already holding what they were offered.
  """
  def claim(user = %User{}) do
    case pending_for(user.email) do
      nil ->
        user

      invitation ->
        {:ok, user} = accept(invitation, user)
        user
    end
  end

  @doc "Withdraw a pending invitation."
  def cancel(invitation = %Invitation{accepted_at: nil}) do
    {:ok, Repo.delete!(invitation)}
  end

  def cancel(%Invitation{}), do: {:error, :already_accepted}

  @doc "Send a pending invitation's mail again."
  def resend(invitation = %Invitation{accepted_at: nil}) do
    case notify(invitation) do
      :ok -> {:ok, invitation}
      {:error, reason} -> {:error, reason}
    end
  end

  def resend(%Invitation{}), do: {:error, :already_accepted}

  defp offer(attrs, invited_by) do
    attrs = Map.put(attrs, "invited_by_id", invited_by && invited_by.id)

    case %Invitation{} |> changeset(attrs) |> Repo.insert() do
      {:ok, invitation} ->
        invitation = Repo.preload(invitation, :invited_by)
        {notify(invitation), invitation} |> reported()

      {:error, changeset} ->
        {:error, Validation.get_errors(changeset)}
    end
  end

  defp promote(user, %{"role" => role}) do
    case User.set_role(user, cast_role(role)) do
      {:ok, updated} -> {:ok, {:granted, updated}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp promote(_user, _attrs), do: {:error, %{role: "required"}}

  defp reported({:ok, invitation}), do: {:ok, {:invited, invitation}}
  defp reported({{:error, _reason}, invitation}), do: {:ok, {:unsent, invitation}}

  defp accept(invitation, user) do
    Repo.transaction(fn ->
      {:ok, updated} = User.set_role(user, invitation.role)

      invitation
      |> change(accepted_at: DateTime.utc_now() |> DateTime.truncate(:second))
      |> Repo.update!()

      updated
    end)
  end

  defp pending_for(email) when is_binary(email) do
    Repo.one(
      from(i in Invitation,
        where: fragment("lower(?)", i.email) == ^String.downcase(email) and is_nil(i.accepted_at)
      )
    )
  end

  defp pending_for(_email), do: nil

  defp cast_role(role) when is_atom(role), do: role
  defp cast_role(role) when is_binary(role), do: String.to_existing_atom(role)

  defp notify(invitation) do
    %Email{
      name: "Richard & Isabel Burton Platform",
      institution: "IFRS Canoas",
      address: System.get_env("SMTP_FROM"),
      subject: "You have been invited to the Richard & Isabel Burton Platform",
      message: message(invitation),
      to: invitation.email
    }
    |> Mailer.send()
    |> case do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp message(invitation) do
    """
    You have been invited to the Richard & Isabel Burton Platform#{invited_by(invitation)} as #{describe(invitation.role)}.

    Sign in with Google at #{app_url()} using this address — #{invitation.email} — and the access will be waiting for you.

    If you were not expecting this invitation, you can ignore it. Nothing happens until you sign in.
    """
  end

  defp invited_by(%{invited_by: %User{email: email}}), do: " by #{email}"
  defp invited_by(_invitation), do: ""

  defp describe(:admin), do: "an administrator, who can also manage who has access"
  defp describe(:contributor), do: "a contributor, who can add and correct publications"
  defp describe(:reader), do: "a reader"

  defp app_url, do: System.get_env("APP_URL") || "the platform"
end

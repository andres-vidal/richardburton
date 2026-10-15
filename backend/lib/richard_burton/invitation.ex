defmodule RichardBurton.Invitation do
  @moduledoc """
  A role held for an email address until whoever owns it signs in.

  An admin cannot grant a role to someone who has never signed in, because the
  identity provider mints the subject id only on a first sign-in. So the role
  waits on the address instead, and the first sign-in with that address
  redeems it. The provider vouching for the address is the confirmation, so no
  separate confirmation link is sent. `RichardBurton.Auth.Claims` refuses a
  token that does not carry a verified email, which is what this rests on.

  Someone who already has an account is given the role outright, and no
  invitation is recorded.

  An invitation is **pending** until it is redeemed, and **accepted** after.
  An address has at most one pending invitation.
  """
  use Ecto.Schema

  import Ecto.Changeset
  import Ecto.Query
  import EctoCommons.EmailValidator

  alias RichardBurton.Auth.Access
  alias RichardBurton.Email
  alias RichardBurton.Invitation
  alias RichardBurton.Repo
  alias RichardBurton.User

  @derive {Jason.Encoder, only: [:id, :email, :role, :accepted_at, :inserted_at]}
  schema "invitations" do
    field :email, :string
    field :role, Ecto.Enum, values: User.roles()
    field :accepted_at, :utc_datetime

    belongs_to :invited_by, User

    timestamps()
  end

  @doc """
  Casts a new invitation's `email`, `role` and `invited_by_id`. The email,
  trimmed, must be an email address, and the role is required.
  """
  def changeset(invitation, attrs) do
    invitation
    |> cast(attrs, [:email, :role, :invited_by_id])
    |> validate_required([:email, :role])
    |> update_change(:email, &String.trim/1)
    |> validate_email(:email)
    |> unique_constraint(:email, name: :invitations_pending_email_index)
  end

  @doc "Every invitation, newest first, pending and accepted."
  def all do
    from(i in Invitation, order_by: [desc: i.inserted_at]) |> Repo.all()
  end

  @doc "Returns the invitation with `id`, or nil."
  def get(id), do: Repo.get(Invitation, id)

  @doc """
  Offers the role in `attrs["role"]` to the address in `attrs["email"]`, on
  behalf of `invited_by`, and mails the offer.

  Someone who already has an account gets the role now, and no invitation is
  recorded. Returns `{:ok, {:granted, user}}`, or the errors of
  `RichardBurton.User.set_role/3`.

  Otherwise it records a pending invitation and mails it. Returns
  `{:ok, {:invited, invitation}}`, or `{:ok, {:unsent, invitation}}` when the
  mail could not be sent. The invitation is recorded first, so a failure to
  send does not lose it, and it can be sent again with `resend/1`.

  Returns `{:error, :invalid_role}` when the role is missing or is not a role,
  `{:error, :pending}` when the address already has a pending invitation, and
  `{:error, changeset}` when the address is not one.
  """
  def invite(attrs, invited_by \\ nil) do
    email = attrs |> Map.get("email", "") |> to_string() |> String.trim()

    with {:ok, role} <- User.cast_role(attrs["role"]) do
      case User.get_by_email(email) do
        nil -> offer(email, role, invited_by)
        user -> promote(user, role, invited_by)
      end
    end
  end

  @doc """
  Admits a signed-in identity when it is one this platform knows.

  An account is made only for someone who was invited. Anyone may hold a Google
  account, so a sign-in that created one regardless would let whoever tries
  decide who has an account, and revoking an account would mean nothing, since
  signing in again would make another. The new account takes up the pending
  invitation in the same transaction, so it starts with the offered role.

  Someone who already has an account is admitted on the strength of it. If a
  pending invitation is also waiting for their address, they take it up, and
  their role is raised to the offered one when the offered one is higher. An
  invitation never lowers a role.

  Returns `{:ok, user}`, `:not_invited` for someone with neither an account
  nor a pending invitation, or `{:error, changeset}` when the account cannot
  be made.
  """
  def admit(subject_id, email) when is_binary(subject_id) and is_binary(email) do
    case {User.get(subject_id), pending_for(email)} do
      {nil, nil} ->
        :not_invited

      {nil, invitation} ->
        with {:ok, user} <- User.insert(%{"subject_id" => subject_id, "email" => email}) do
          accept(invitation, user)
        end

      {user, nil} ->
        {:ok, user}

      {user, invitation} ->
        accept(invitation, user)
    end
  end

  @doc """
  Withdraws a pending invitation by deleting it. Returns `{:ok, invitation}`,
  or `{:error, :accepted}` for an invitation already accepted.
  """
  def cancel(invitation = %Invitation{accepted_at: nil}) do
    {:ok, Repo.delete!(invitation)}
  end

  def cancel(%Invitation{}), do: {:error, :accepted}

  @doc """
  Mails a pending invitation again. Returns `{:ok, invitation}`,
  `{:error, :unsent}` when the mail could not be sent, or `{:error, :accepted}`
  for an invitation already accepted.
  """
  def resend(invitation = %Invitation{accepted_at: nil}) do
    with :ok <- notify(invitation), do: {:ok, invitation}
  end

  def resend(%Invitation{}), do: {:error, :accepted}

  # Records a pending invitation of `role` for `email`, which has no account,
  # and mails it.
  defp offer(email, role, invited_by) do
    attrs = %{"email" => email, "role" => role, "invited_by_id" => invited_by && invited_by.id}

    case %Invitation{} |> changeset(attrs) |> Repo.insert() do
      {:ok, invitation} ->
        invitation = %{invitation | invited_by: invited_by}

        case notify(invitation) do
          :ok -> {:ok, {:invited, invitation}}
          {:error, :unsent} -> {:ok, {:unsent, invitation}}
        end

      {:error, changeset} ->
        {:error, refusal(changeset)}
    end
  end

  # Returns `:pending` when the insert was refused because the address already
  # has a pending invitation, and the changeset for any other invalid field.
  defp refusal(changeset) do
    case Keyword.get(changeset.errors, :email) do
      {_message, opts} -> if opts[:constraint] == :unique, do: :pending, else: changeset
      nil -> changeset
    end
  end

  # Gives `role` to an address that already has an account, without an
  # invitation to redeem.
  defp promote(user, role, invited_by) do
    with {:ok, updated} <- User.set_role(user, role, invited_by && invited_by.subject_id) do
      {:ok, {:granted, updated}}
    end
  end

  # Raises the user to the offered role and marks the invitation accepted, in
  # one transaction, so an invitation cannot be spent twice. A user who already
  # holds the offered role or a higher one keeps their role. After the
  # transaction commits, it calls `RichardBurton.Auth.Access.changed/1` for the
  # user. Returns `{:ok, user}` with the user as they are after the change.
  #
  # `User.set_role/3` also calls `changed/1`, but that call happens inside the
  # transaction, before a subscriber can read the new role.
  defp accept(invitation, user) do
    {:ok, updated} =
      Repo.transaction(fn ->
        updated = raise_role(user, invitation.role)

        invitation
        |> change(accepted_at: DateTime.utc_now(:second))
        |> Repo.update!()

        updated
      end)

    Access.changed(updated.subject_id)
    {:ok, updated}
  end

  # Gives `user` the role `role` when it outranks the role they hold, and
  # returns the user unchanged otherwise.
  defp raise_role(user, role) do
    if User.at_least?(user.role, role) do
      user
    else
      {:ok, updated} = User.set_role(user, role)
      updated
    end
  end

  # The pending invitation for an address, compared without case, if there is
  # one.
  defp pending_for(email) do
    Repo.one(
      from(i in Invitation,
        where: fragment("lower(?)", i.email) == ^String.downcase(email) and is_nil(i.accepted_at)
      )
    )
  end

  # Mails the invitation, naming who sent it when the record still has them.
  # Returns `:ok` or `{:error, :unsent}`.
  defp notify(invitation) do
    invitation = Repo.preload(invitation, :invited_by)

    Email.deliver(
      to: invitation.email,
      subject:
        "Convite para a Plataforma Richard & Isabel Burton / " <>
          "Invitation to the Richard & Isabel Burton Platform",
      message: message(invitation)
    )
  end

  # The invitation email body: the message in Portuguese, then the same message
  # in English, separated by a line of dashes.
  #
  # An invitation records no language for the person it is sent to, so the
  # email is written in both of the platform's languages.
  defp message(invitation) do
    Enum.map_join([:pt, :en], "\n---\n\n", &message(invitation, &1))
  end

  # The invitation email body in one language, `:pt` or `:en`.
  defp message(invitation, :pt) do
    """
    Você foi convidado para a Plataforma Richard & Isabel Burton#{invited_by(invitation, :pt)} como #{describe(invitation.role, :pt)}.

    #{sign_in(:pt)} usando este endereço (#{invitation.email}), e o acesso estará esperando por você.

    Se você não esperava este convite, pode ignorá-lo. Nada acontece até você entrar.
    """
  end

  defp message(invitation, :en) do
    """
    You have been invited to the Richard & Isabel Burton Platform#{invited_by(invitation, :en)} as #{describe(invitation.role, :en)}.

    #{sign_in(:en)} using this address (#{invitation.email}), and the access will be waiting for you.

    If you were not expecting this invitation, you can ignore it. Nothing happens until you sign in.
    """
  end

  # The words that name the inviter, or an empty string when the invitation has
  # none, such as one whose sender's account has since been deleted.
  defp invited_by(%{invited_by: %User{email: email}}, :pt), do: " por #{email}"
  defp invited_by(%{invited_by: %User{email: email}}, :en), do: " by #{email}"
  defp invited_by(_invitation, _language), do: ""

  # What each role allows, in the words the email uses.
  defp describe(:admin, :pt), do: "administrador, que também pode decidir quem tem acesso"
  defp describe(:contributor, :pt), do: "colaborador, que pode acrescentar e corrigir publicações"
  defp describe(:reader, :pt), do: "leitor"
  defp describe(:admin, :en), do: "an administrator, who can also manage who has access"
  defp describe(:contributor, :en), do: "a contributor, who can add and correct publications"
  defp describe(:reader, :en), do: "a reader"

  # The start of the sentence that says where to sign in. It names the address
  # in `APP_URL` when that is set, and the platform in general when it is unset
  # or empty, so the email never carries a broken link.
  defp sign_in(language), do: sign_in(System.get_env("APP_URL", ""), language)

  defp sign_in("", :pt), do: "Entre na plataforma com o Google"
  defp sign_in(url, :pt), do: "Entre com o Google em #{url}"
  defp sign_in("", :en), do: "Sign in to the platform with Google"
  defp sign_in(url, :en), do: "Sign in with Google at #{url}"
end

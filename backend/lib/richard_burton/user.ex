defmodule RichardBurton.User do
  @moduledoc """
  Schema for users
  """
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias RichardBurton.User
  alias RichardBurton.Repo
  alias RichardBurton.Validation

  @roles [:reader, :contributor, :admin]

  @derive {Jason.Encoder, only: [:id, :email, :role, :inserted_at]}
  schema "users" do
    field :subject_id, :string
    field :email, :string
    field :role, Ecto.Enum, values: @roles

    timestamps()
  end

  @doc """
  The roles, least privileged first. A role admits everything the ones before it
  admit: a contributor keeps the catalogue, an admin also decides who may.
  """
  def roles, do: @roles

  @doc "Whether `role` is `required`, or outranks it."
  def at_least?(role, required) when role in @roles and required in @roles do
    Enum.find_index(@roles, &(&1 == role)) >= Enum.find_index(@roles, &(&1 == required))
  end

  def at_least?(_role, _required), do: false

  @doc false
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:subject_id, :email])
    |> validate_required([:subject_id, :email])
    |> put_change(:role, :reader)
    |> unique_constraint([:subject_id])
  end

  @doc false
  def role_changeset(user, attrs) do
    user
    |> cast(attrs, [:role])
    |> validate_required([:role])
    |> validate_inclusion(:role, @roles)
  end

  def all do
    from(u in User, order_by: [asc: u.email]) |> Repo.all()
  end

  def get(subject_id) do
    Repo.get_by(User, subject_id: subject_id)
  end

  def get_by_id(id), do: Repo.get(User, id)

  def get_by_email(email) when is_binary(email) do
    Repo.one(from(u in User, where: fragment("lower(?)", u.email) == ^String.downcase(email)))
  end

  def insert(attrs) do
    case %User{} |> changeset(attrs) |> Repo.insert() do
      {:ok, user} -> {:ok, user}
      {:error, changeset} -> {:error, Validation.get_errors(changeset)}
    end
  end

  @doc """
  Give a user a role.

  The last admin keeps theirs: a platform with nobody who can grant access can
  only be repaired from the database, so the demotion that would produce it is
  refused rather than confirmed.
  """
  def set_role(user = %User{}, role) do
    if last_admin?(user) and role != :admin do
      {:error, :last_admin}
    else
      user
      |> role_changeset(%{role: role})
      |> Repo.update()
      |> case do
        {:ok, updated} -> {:ok, updated}
        {:error, changeset} -> {:error, Validation.get_errors(changeset)}
      end
    end
  end

  @doc """
  Revoke a user's access: the account goes, and with it the sessions that were
  signed in as them — otherwise a revoked user keeps the run of the place until
  their cookie happens to expire.
  """
  def delete(user = %User{}) do
    if last_admin?(user) do
      {:error, :last_admin}
    else
      Repo.transaction(fn ->
        RichardBurton.Auth.Session.revoke_all(user.subject_id)
        Repo.delete!(user)
      end)
      |> case do
        {:ok, deleted} -> {:ok, deleted}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp last_admin?(%User{role: :admin, id: id}) do
    from(u in User, where: u.role == :admin and u.id != ^id) |> Repo.aggregate(:count) == 0
  end

  defp last_admin?(_user), do: false
end

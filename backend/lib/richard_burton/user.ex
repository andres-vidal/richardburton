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
  admit: a contributor adds and corrects publications, an admin also decides who may.
  """
  def roles, do: @roles

  @doc """
  The role named by `role`, given as a string or an atom.

  Names arrive as strings from request params, the console and the dev
  provider; only this knows which strings are roles.
  """
  def cast_role(role) do
    case Enum.find(@roles, &(to_string(&1) == to_string(role))) do
      nil -> {:error, :invalid_role}
      found -> {:ok, found}
    end
  end

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
  Give a user a role, on behalf of `actor` — the subject id of whoever is
  asking, or `nil` from the console.

  Two changes are refused: your own role, and the one that would leave the
  database without an admin. Answers `{:error, :self}` or `{:error, :last_admin}`
  respectively, and `{:error, :invalid_role}` for a role that is not one.
  """
  def set_role(user = %User{}, role, actor \\ nil) do
    with {:ok, role} <- cast_role(role),
         :ok <- refuse_self(user, actor),
         :ok <- refuse_last_admin(user, role) do
      user
      |> role_changeset(%{role: role})
      |> Repo.update()
      |> case do
        {:ok, updated} ->
          RichardBurton.Auth.Access.changed(updated.subject_id)
          {:ok, updated}

        {:error, changeset} ->
          {:error, Validation.get_errors(changeset)}
      end
    end
  end

  @doc """
  Deletes a user's account and all of their sessions, on behalf of `actor`.
  `actor` is the subject id of the person asking, or `nil` from the console.
  Returns `{:ok, user}`. Like `set_role/3`, it refuses to remove your own
  account or the last admin's, and returns `{:error, :self}` or
  `{:error, :last_admin}`.

  Deleting the sessions signs the person out everywhere. The sessions and the
  account are deleted in one transaction. After the transaction commits,
  `delete/2` calls `RichardBurton.Auth.Access.changed/1`, so the person's open
  document channels check their access again and close.
  `Session.revoke_all/1` also calls `changed/1`, but that call happens inside
  the transaction, too early to close them.
  """
  def delete(user = %User{}, actor \\ nil) do
    with :ok <- refuse_self(user, actor),
         :ok <- refuse_last_admin(user, nil) do
      delete_with_sessions(user)
    end
  end

  # Deletes the user's sessions and then the user, in one transaction, and calls
  # `RichardBurton.Auth.Access.changed/1` after the transaction commits. Returns
  # `{:ok, user}` with the deleted user.
  defp delete_with_sessions(user) do
    {:ok, deleted} =
      Repo.transaction(fn ->
        RichardBurton.Auth.Session.revoke_all(user.subject_id)
        Repo.delete!(user)
      end)

    RichardBurton.Auth.Access.changed(user.subject_id)
    {:ok, deleted}
  end

  # Changing your own role or removing your own account is a mistake often
  # enough, and undoable by nobody but another admin, that it is not offered.
  # Every way in refuses it, not only the one the dashboard uses.
  defp refuse_self(%User{subject_id: subject_id}, subject_id), do: {:error, :self}
  defp refuse_self(_user, _actor), do: :ok

  # The last admin keeps the role: with nobody left who can grant access, the
  # database is the only way back, so the demotion is refused rather than
  # confirmed.
  defp refuse_last_admin(user, role) do
    if last_admin?(user) and role != :admin, do: {:error, :last_admin}, else: :ok
  end

  # Whether this is the only administrator left, which neither a demotion nor a
  # deletion may leave the platform without.
  defp last_admin?(%User{role: :admin, id: id}) do
    from(u in User, where: u.role == :admin and u.id != ^id) |> Repo.aggregate(:count) == 0
  end

  defp last_admin?(_user), do: false
end

defmodule RichardBurton.User do
  @moduledoc """
  An account: the identity provider's subject id, the email address it was
  made for, and the role it holds.
  """
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias RichardBurton.Auth.Access
  alias RichardBurton.Auth.Session
  alias RichardBurton.Repo
  alias RichardBurton.User

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
  Returns `{:ok, role}` for the role named by `role`, given as a string or an
  atom, and `{:error, :invalid_role}` when it names none, including when it is
  nil.
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

  @doc """
  Returns `:ok` when the account with `subject_id` holds `role` or a role that
  outranks it. Returns `:error` otherwise, including when there is no such
  account.
  """
  @spec authorize(subject_id :: String.t(), role :: atom()) :: :ok | :error
  def authorize(subject_id, role) do
    case get(subject_id) do
      %User{role: held} -> if at_least?(held, role), do: :ok, else: :error
      nil -> :error
    end
  end

  @doc """
  Casts a new account's `subject_id` and `email`, both required. The role is
  always `:reader`, whatever `attrs` say.
  """
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:subject_id, :email])
    |> validate_required([:subject_id, :email])
    |> put_change(:role, :reader)
    |> unique_constraint([:subject_id])
  end

  @doc """
  Casts a change of `role`, which must be one of `roles/0`. It checks nothing
  else. `set_role/3` changes a role and also refuses the changes that are not
  allowed.
  """
  def role_changeset(user, attrs) do
    user
    |> cast(attrs, [:role])
    |> validate_required([:role])
  end

  @doc "Returns every account, ordered by email."
  def all do
    from(u in User, order_by: [asc: u.email]) |> Repo.all()
  end

  @doc "Returns the account with `subject_id`, or nil."
  def get(subject_id) do
    Repo.get_by(User, subject_id: subject_id)
  end

  @doc "Returns the account with the database id `id`, or nil."
  def get_by_id(id), do: Repo.get(User, id)

  @doc "Returns the account for `email`, compared without case, or nil."
  def get_by_email(email) when is_binary(email) do
    Repo.one(from(u in User, where: fragment("lower(?)", u.email) == ^String.downcase(email)))
  end

  @doc """
  Inserts a reader account. Returns `{:ok, user}`, or `{:error, changeset}`
  when a field is missing or another account has the subject id.
  """
  def insert(attrs) do
    %User{} |> changeset(attrs) |> Repo.insert()
  end

  @doc """
  Gives a user a role on behalf of `actor`, the subject id of whoever is
  asking, or `nil` from the console.

  Two changes are refused: your own role, and the one that would leave the
  database without an admin. Answers `{:error, :self}` or `{:error, :last_admin}`
  respectively, and `{:error, :invalid_role}` for a role that is not one.
  """
  def set_role(user = %User{}, role, actor \\ nil) do
    with {:ok, role} <- cast_role(role),
         :ok <- refuse_self(user, actor),
         {:ok, updated} <-
           keeping_an_admin(user, role, fn ->
             user |> role_changeset(%{role: role}) |> Repo.update()
           end) do
      Access.changed(updated.subject_id)
      {:ok, updated}
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
         {:ok, deleted} <-
           keeping_an_admin(user, nil, fn ->
             Session.revoke_all(user.subject_id)
             Repo.delete(user)
           end) do
      Access.changed(user.subject_id)
      {:ok, deleted}
    end
  end

  # Changing your own role or removing your own account is a mistake often
  # enough, and undoable by nobody but another admin, that it is not offered.
  # Every way in refuses it, not only the access endpoints.
  defp refuse_self(%User{subject_id: subject_id}, subject_id), do: {:error, :self}
  defp refuse_self(_user, _actor), do: :ok

  # Runs `write`, which changes `user` so that it holds `role` afterwards, or
  # deletes it when `role` is nil, and returns what `write` returns. It returns
  # `{:error, :last_admin}` without running `write` when `user` is the only
  # admin and would no longer be one: with nobody left who can grant access,
  # the database would be the only way back.
  #
  # The check and the write run in one transaction that first locks every
  # admin's row. Two changes that would each leave one admin, such as two
  # admins demoting each other at once, then run one after the other, and the
  # second sees that the first left only one admin.
  defp keeping_an_admin(user, role, write) do
    Repo.transaction(fn ->
      admins =
        from(u in User, where: u.role == :admin, select: u.id, lock: "FOR UPDATE")
        |> Repo.all()

      with :ok <- refuse_last_admin(admins, user, role),
           {:ok, result} <- write.() do
        result
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  # Returns `{:error, :last_admin}` when `user` is the only one of `admins`, the
  # ids of every admin, and `role` is not admin. Returns `:ok` otherwise.
  defp refuse_last_admin([id], %User{id: id}, role) when role != :admin,
    do: {:error, :last_admin}

  defp refuse_last_admin(_admins, _user, _role), do: :ok
end

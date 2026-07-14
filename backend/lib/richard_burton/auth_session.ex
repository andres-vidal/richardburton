defmodule RichardBurton.Auth.Session do
  @moduledoc """
  Server-side (stateful) app sessions. Each session is a row in `auth_sessions`
  holding the authenticated user's `subject_id` and the SHA-256 hash of an opaque
  token. The raw token is set as the `rb-session` cookie and looked up on every
  request, so a session can be revoked instantly by deleting its row.

  Lifetime is a **sliding idle timeout** (`:session_idle_timeout`) refreshed on
  use, bounded by an **absolute cap** (`:session_max_age`) measured from creation.
  """
  use Ecto.Schema

  import Ecto.Query, only: [from: 2]

  alias RichardBurton.Auth.Session
  alias RichardBurton.Repo

  # 30 days: absolute cap (also the cookie max_age).
  @default_max_age 2_592_000
  # 7 days: sliding idle timeout, refreshed on use.
  @default_idle_timeout 604_800
  # Throttle idle-timeout refreshes to at most once per interval.
  @slide_after 3_600
  @token_bytes 32
  # The httpOnly cookie carrying the raw session token.
  @cookie_name "rb-session"

  schema "auth_sessions" do
    field :subject_id, :string
    field :token_hash, :string
    field :expires_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @doc "Creates a session for `subject_id`, returning the raw opaque token to set as the cookie."
  @spec create(String.t()) :: {:ok, String.t()} | {:error, Ecto.Changeset.t()}
  def create(subject_id) do
    token = generate_token()

    %Session{subject_id: subject_id, token_hash: hash(token), expires_at: idle_deadline()}
    |> Repo.insert()
    |> case do
      {:ok, _session} -> {:ok, token}
      {:error, changeset} -> {:error, changeset}
    end
  end

  @doc """
  Verifies a raw token, returning `{:ok, subject_id}` or `:error`.

  Rejects (and prunes) sessions past their idle timeout or absolute cap, and
  slides the idle timeout forward on a valid, active session.
  """
  @spec verify(String.t()) :: {:ok, String.t()} | :error
  def verify(token) do
    now = DateTime.utc_now()

    case Repo.get_by(Session, token_hash: hash(token)) do
      nil ->
        :error

      session ->
        if expired?(now, session.expires_at) or expired?(now, absolute_deadline(session)) do
          Repo.delete(session)
          :error
        else
          maybe_slide(session, now)
          {:ok, session.subject_id}
        end
    end
  end

  @doc "Revokes the session identified by `token` (deletes its row)."
  @spec revoke(String.t()) :: :ok
  def revoke(token) do
    Repo.delete_all(from s in Session, where: s.token_hash == ^hash(token))
    :ok
  end

  @doc "Revokes every session for `subject_id` (sign out everywhere)."
  @spec revoke_all(String.t()) :: :ok
  def revoke_all(subject_id) do
    Repo.delete_all(from s in Session, where: s.subject_id == ^subject_id)
    :ok
  end

  @doc "Absolute session cap in seconds — also the cookie max_age (`:session_max_age`)."
  @spec max_age() :: pos_integer()
  def max_age, do: Application.get_env(:richard_burton, :session_max_age, @default_max_age)

  @doc "Sliding idle timeout in seconds (`:session_idle_timeout`)."
  @spec idle_timeout() :: pos_integer()
  def idle_timeout,
    do: Application.get_env(:richard_burton, :session_idle_timeout, @default_idle_timeout)

  @doc "Name of the httpOnly cookie carrying the raw session token."
  @spec cookie_name() :: String.t()
  def cookie_name, do: @cookie_name

  # Slide the idle timeout forward on use, throttled, never past the absolute cap.
  defp maybe_slide(session, now) do
    if DateTime.diff(now, session.updated_at) >= @slide_after do
      next = min_datetime(idle_deadline(now), absolute_deadline(session))
      session |> Ecto.Changeset.change(expires_at: next) |> Repo.update()
    end

    :ok
  end

  defp idle_deadline(now \\ DateTime.utc_now()) do
    now |> DateTime.add(idle_timeout(), :second) |> DateTime.truncate(:second)
  end

  defp absolute_deadline(session) do
    session.inserted_at |> DateTime.add(max_age(), :second) |> DateTime.truncate(:second)
  end

  defp expired?(now, deadline), do: DateTime.compare(now, deadline) != :lt

  defp min_datetime(a, b), do: if(DateTime.compare(a, b) == :lt, do: a, else: b)

  defp generate_token do
    @token_bytes |> :crypto.strong_rand_bytes() |> Base.url_encode64(padding: false)
  end

  defp hash(token) do
    :crypto.hash(:sha256, token) |> Base.encode16(case: :lower)
  end
end

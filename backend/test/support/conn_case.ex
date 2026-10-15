defmodule RichardBurtonWeb.ConnCase do
  @moduledoc """
  The test case for requests to the endpoint. It imports `Phoenix.ConnTest`,
  the fixtures and the helpers below, and sets up the database sandbox.

  Each test gets a `conn` signed in as the **session user**: it carries an
  `rb-session` cookie for a real session of that user's subject, the matching
  `rb-csrf-token` header, and an `Authorization: Bearer` header for the routes
  that take a provider token. The session user's row is not inserted;
  `create_session_user/0` inserts it. The role checks go through
  `RichardBurton.AuthMock`, which the `expect_auth_*` helpers program.
  `Phoenix.ConnTest.build_conn/0` gives a connection without any of this.
  """

  use ExUnit.CaseTemplate
  import Mox

  @session_subject_id "12345"
  @session_user_email "admin@richardburton.test"

  using do
    quote do
      import Plug.Conn
      import Phoenix.ConnTest
      import RichardBurton.Fixtures
      import RichardBurtonWeb.ConnCase

      alias RichardBurtonWeb.Router.Helpers, as: Routes

      @endpoint RichardBurtonWeb.Endpoint
    end
  end

  setup tags do
    RichardBurton.DataCase.setup_sandbox(tags)
    {:ok, conn: signed_in_conn()}
  end

  setup :verify_on_exit!

  # Returns a connection signed in as the session user, as the module doc
  # describes.
  defp signed_in_conn do
    {:ok, token} = RichardBurton.Auth.Session.create(@session_subject_id)

    Phoenix.ConnTest.build_conn()
    |> Plug.Test.put_req_cookie(RichardBurton.Auth.Session.cookie_name(), token)
    |> Plug.Conn.put_req_header("authorization", "Bearer token")
    |> Plug.Conn.put_req_header(
      RichardBurton.Auth.Csrf.header_name(),
      RichardBurton.Auth.Csrf.sign(@session_subject_id)
    )
  end

  @doc "Returns the params of a request that uploads the file at `path` as `csv`."
  def uploaded_csv_fixture(path) do
    %{"csv" => %Plug.Upload{path: path, filename: "file"}}
  end

  @doc "Returns the subject id of the session user."
  def session_subject_id, do: @session_subject_id

  @doc "Returns the email of the session user."
  def session_user_email, do: @session_user_email

  @doc "Inserts the session user, with the reader role, and returns it."
  def create_session_user do
    {:ok, user} =
      RichardBurton.User.insert(%{
        subject_id: @session_subject_id,
        email: @session_user_email
      })

    user
  end

  @doc """
  Expects `n` calls of `Auth.verify/1`, each of which vouches for the session
  user's subject with the address `email`.
  """
  def expect_auth_verify(n \\ 1, email \\ @session_user_email) do
    expect(RichardBurton.AuthMock, :verify, n, fn _ ->
      {:ok, %{subject_id: @session_subject_id, email: email}}
    end)
  end

  @doc """
  Expects `n` role checks, each of which admits the role the route asks for,
  contributor or admin.
  """
  def expect_auth_authorize_admin(n \\ 1) do
    expect(RichardBurton.AuthMock, :authorize, n, fn _, role
                                                     when role in [:contributor, :admin] ->
      :ok
    end)
  end

  @doc "Expects `n` role checks for `role`, each of which refuses it."
  def refuse_auth_authorize(role, n \\ 1) do
    expect(RichardBurton.AuthMock, :authorize, n, fn _, ^role -> :error end)
  end

  @doc "Expects `n` reCAPTCHA checks, each of which passes."
  def expect_auth_recaptcha_verify(n \\ 1) do
    expect(RichardBurton.Auth.RecaptchaMock, :verify, n, fn _ -> :ok end)
  end

  @doc """
  Runs `fun`, and returns its result and how many of the queries the calling
  process ran meanwhile read the `search_keywords` view.
  """
  def counting_keyword_lookups(fun) do
    RichardBurton.DataCase.count_queries(fun, &(&1 =~ "search_keywords"))
  end
end

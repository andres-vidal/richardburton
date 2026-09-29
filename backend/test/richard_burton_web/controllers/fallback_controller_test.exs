defmodule RichardBurtonWeb.FallbackControllerTest do
  @moduledoc """
  Tests for `FallbackController`: the status and body it responds with for each
  kind of error an action returns.
  """
  use ExUnit.Case, async: true

  import Phoenix.ConnTest
  import Plug.Conn

  alias RichardBurtonWeb.FallbackController

  defp answer(error) do
    conn = FallbackController.call(build_conn(), error)
    {conn.status, Jason.decode!(conn.resp_body)}
  end

  test "a missing record is a 404" do
    assert answer({:error, :not_found}) == {404, %{"error" => "not_found"}}
  end

  test "a conflict is a 409, whichever conflict it is" do
    for reason <- [:conflict, :absorbed, :last_admin, :self, :accepted, :pending] do
      assert answer({:error, reason}) == {409, %{"error" => to_string(reason)}}
    end
  end

  test "any other reason is a 400, named in the body" do
    assert answer({:error, :invalid_role}) == {400, %{"error" => "invalid_role"}}
  end

  test "field errors are a 400, by field" do
    assert answer({:error, %{title: :required}}) == {400, %{"errors" => %{"title" => "required"}}}
  end

  test "a changeset is answered with its errors by field" do
    changeset =
      {%{}, %{name: :string}}
      |> Ecto.Changeset.cast(%{}, [:name])
      |> Ecto.Changeset.validate_required([:name])

    assert answer({:error, changeset}) == {400, %{"errors" => %{"name" => "required"}}}
  end

  # The same reason can be a conflict in one action and a malformed request in
  # another. `:self` is a 409 by default, but a 400 when merging a record into
  # itself.
  test "a status named with the reason is the one given" do
    assert answer({:error, :bad_request, :self}) == {400, %{"error" => "self"}}
    assert answer({:error, :bad_gateway, :unsent}) == {502, %{"error" => "unsent"}}
  end

  test "found turns a lookup that found nothing into a miss" do
    assert FallbackController.found(nil) == {:error, :not_found}
    assert FallbackController.found(%{id: 1}) == {:ok, %{id: 1}}
  end

  test "the answer is JSON" do
    conn = FallbackController.call(build_conn(), {:error, :not_found})

    assert ["application/json" <> _] = get_resp_header(conn, "content-type")
  end
end

defmodule RichardBurtonWeb.EndpointCorsTest do
  @moduledoc """
  Guards the CORS contract for the app's custom headers. The frontend attaches
  the rb-csrf-token header (double-submit CSRF) once a csrf-token cookie exists,
  and reads the rb-total-count header off the index response. If CORSPlug doesn't
  allow/expose these, every browser request breaks after sign-in even though curl
  works fine.
  """
  use RichardBurtonWeb.ConnCase, async: false

  @origin "http://localhost:3000"

  setup do
    previous = System.get_env("PHX_CONSUMER_URL")
    System.put_env("PHX_CONSUMER_URL", @origin)

    on_exit(fn ->
      case previous do
        nil -> System.delete_env("PHX_CONSUMER_URL")
        value -> System.put_env("PHX_CONSUMER_URL", value)
      end
    end)

    :ok
  end

  defp allow_header(conn, name) do
    conn
    |> get_resp_header(name)
    |> List.first("")
    |> String.downcase()
  end

  test "preflight allows the rb-csrf-token request header" do
    conn =
      build_conn()
      |> put_req_header("origin", @origin)
      |> put_req_header("access-control-request-method", "POST")
      |> put_req_header("access-control-request-headers", "rb-csrf-token")
      |> options("/api/publications/bulk")

    assert allow_header(conn, "access-control-allow-headers") =~ "rb-csrf-token"
  end

  test "the index response exposes the rb-total-count header" do
    conn =
      build_conn()
      |> put_req_header("origin", @origin)
      |> get("/api/publications")

    assert allow_header(conn, "access-control-expose-headers") =~ "rb-total-count"
  end
end

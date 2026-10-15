defmodule RichardBurtonWeb.VocabularyControllerTest do
  @moduledoc """
  Tests for `RichardBurtonWeb.VocabularyController`: listing the names of a
  kind, checking new names against them, and renaming one.
  """
  use RichardBurtonWeb.ConnCase

  import Routes, only: [vocabulary_path: 3, vocabulary_path: 4]

  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.Repo

  setup do
    create_session_user()
    :ok
  end

  defp id_of(name), do: Repo.get_by!(Publisher, name: name).id

  describe "GET /vocabulary/:kind" do
    test "lists the names with how many publications each is on", meta do
      publication_fixture(%{publishers: ["Noonday Press"]})
      expect_auth_authorize_admin()

      assert %{"entries" => entries, "kinds" => kinds} =
               meta.conn
               |> get(vocabulary_path(meta.conn, :index, "publishers"))
               |> json_response(200)

      assert %{"name" => "Noonday Press", "publications" => 1} = hd(entries)
      assert "authors" in kinds
    end

    test "a kind nobody has heard of is not found", meta do
      expect_auth_authorize_admin()

      assert %{"error" => "not_found"} =
               meta.conn
               |> get(vocabulary_path(meta.conn, :index, "sandwiches"))
               |> json_response(404)
    end
  end

  describe "POST /vocabulary/:kind/resemblances" do
    test "answers which names are held and which look like misspellings", meta do
      publication_fixture(%{publishers: ["Noonday Press"]})
      expect_auth_authorize_admin()

      assert %{"entries" => entries} =
               meta.conn
               |> post(vocabulary_path(meta.conn, :resemblances, "publishers"),
                 names: ["Noonday Press", "noonday press", "Tagus Press"]
               )
               |> json_response(200)

      assert [held, near, new] = entries

      assert %{"name" => "Noonday Press", "held" => true, "resembles" => []} = held
      assert %{"held" => false, "resembles" => [%{"name" => "Noonday Press"}]} = near
      assert %{"name" => "Tagus Press", "held" => false, "resembles" => []} = new
    end

    test "404s on a kind it does not keep", meta do
      expect_auth_authorize_admin()

      assert meta.conn
             |> post(vocabulary_path(meta.conn, :resemblances, "countries"), names: ["Brazil"])
             |> json_response(404)
    end
  end

  describe "PATCH /vocabulary/:kind/:id" do
    test "correcting a spelling says it renamed, and records it under the signed-in user",
         meta do
      publication = publication_fixture(%{publishers: ["Noonday Press"]})
      expect_auth_authorize_admin()

      assert %{"outcome" => "renamed"} =
               meta.conn
               |> patch(
                 vocabulary_path(meta.conn, :update, "publishers", id_of("Noonday Press")),
                 %{"name" => "Noonday"}
               )
               |> json_response(200)

      assert [%{action: "renamed", actor: actor} | _] = Publication.History.of(publication.id)
      assert actor == session_user_email()
    end

    test "renaming onto a name already taken is refused until it is asked for", meta do
      publication_fixture(%{publishers: ["Noonday Press"]})
      publication_fixture(%{title: "Iracema", year: 1953, publishers: ["Noonday press"]})

      expect_auth_authorize_admin()

      assert %{"error" => "would_fold", "into" => into, "publications" => publications} =
               meta.conn
               |> patch(
                 vocabulary_path(meta.conn, :update, "publishers", id_of("Noonday press")),
                 %{"name" => "Noonday Press"}
               )
               |> json_response(409)

      assert %{"name" => "Noonday Press", "publications" => 1} = into
      assert [%{"title" => "Iracema", "year" => 1953}] = publications
    end

    test "asking for the fold says it merged", meta do
      publication_fixture(%{publishers: ["Noonday Press"]})
      publication_fixture(%{title: "Iracema", publishers: ["Noonday press"]})

      expect_auth_authorize_admin()

      assert %{"outcome" => "merged"} =
               meta.conn
               |> patch(
                 vocabulary_path(meta.conn, :update, "publishers", id_of("Noonday press")),
                 %{"name" => "Noonday Press", "fold" => true}
               )
               |> json_response(200)
    end

    test "a rename that would give two publications one identity is refused", meta do
      publication_fixture(%{publishers: ["Noonday Press"]})
      publication_fixture(%{publishers: ["Noonday press"]})

      expect_auth_authorize_admin()

      assert %{"error" => "would_collide", "publications" => publications} =
               meta.conn
               |> patch(
                 vocabulary_path(meta.conn, :update, "publishers", id_of("Noonday press")),
                 %{"name" => "Noonday Press", "fold" => true}
               )
               |> json_response(409)

      # The response lists both publications.
      assert length(publications) == 2
    end

    test "a blank name is refused", meta do
      publication_fixture(%{publishers: ["Noonday Press"]})
      expect_auth_authorize_admin()

      assert %{"error" => "blank"} =
               meta.conn
               |> patch(
                 vocabulary_path(meta.conn, :update, "publishers", id_of("Noonday Press")),
                 %{"name" => "  "}
               )
               |> json_response(400)
    end

    test "an id that is not a number is not found", meta do
      expect_auth_authorize_admin()

      assert %{"error" => "not_found"} =
               meta.conn
               |> patch(vocabulary_path(meta.conn, :update, "publishers", "abc"), %{
                 "name" => "Anything"
               })
               |> json_response(404)
    end

    test "a name that is not there", meta do
      expect_auth_authorize_admin()

      assert %{"error" => "not_found"} =
               meta.conn
               |> patch(vocabulary_path(meta.conn, :update, "publishers", 999_999), %{
                 "name" => "Anything"
               })
               |> json_response(404)
    end
  end
end

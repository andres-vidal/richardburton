defmodule RichardBurtonWeb.VocabularyControllerTest do
  @moduledoc """
  Tests for the vocabulary endpoints.
  """
  use RichardBurtonWeb.ConnCase

  import Routes, only: [vocabulary_path: 3, vocabulary_path: 4]

  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.Repo

  @base %{
    "title" => "Dom Casmurro",
    "year" => 1953,
    "countries" => [%{"code" => "US"}],
    "publishers" => [%{"name" => "Noonday Press"}],
    "translated_book" => %{
      "authors" => [%{"name" => "Helen Caldwell"}],
      "original_book" => %{
        "title" => "Dom Casmurro",
        "authors" => [%{"name" => "Machado de Assis"}]
      }
    }
  }

  defp insert(attrs \\ %{}) do
    {:ok, publication} = Publication.insert(RichardBurton.Util.deep_merge_maps(@base, attrs))
    publication
  end

  defp id_of(name), do: Repo.get_by!(Publisher, name: name).id

  describe "GET /vocabulary/:kind" do
    test "lists the names with how many publications each is on", meta do
      insert()
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

  describe "PATCH /vocabulary/:kind/:id" do
    test "correcting a spelling says it renamed", meta do
      insert()
      expect_auth_authorize_admin()

      assert %{"outcome" => "renamed"} =
               meta.conn
               |> patch(
                 vocabulary_path(meta.conn, :update, "publishers", id_of("Noonday Press")),
                 %{"name" => "Noonday"}
               )
               |> json_response(200)
    end

    test "renaming onto a name already taken says it merged", meta do
      insert()
      insert(%{"title" => "Iracema", "publishers" => [%{"name" => "Noonday press"}]})

      expect_auth_authorize_admin()

      assert %{"outcome" => "merged"} =
               meta.conn
               |> patch(
                 vocabulary_path(meta.conn, :update, "publishers", id_of("Noonday press")),
                 %{"name" => "Noonday Press"}
               )
               |> json_response(200)
    end

    test "a rename that would give two publications one identity is refused", meta do
      insert()
      insert(%{"publishers" => [%{"name" => "Noonday press"}]})

      expect_auth_authorize_admin()

      assert %{"error" => "would_collide", "publications" => publications} =
               meta.conn
               |> patch(
                 vocabulary_path(meta.conn, :update, "publishers", id_of("Noonday press")),
                 %{"name" => "Noonday Press"}
               )
               |> json_response(409)

      # Both are named, so a person can go and look at them.
      assert length(publications) == 2
    end

    test "a blank name is refused", meta do
      insert()
      expect_auth_authorize_admin()

      assert %{"error" => "blank"} =
               meta.conn
               |> patch(
                 vocabulary_path(meta.conn, :update, "publishers", id_of("Noonday Press")),
                 %{"name" => "  "}
               )
               |> json_response(400)
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

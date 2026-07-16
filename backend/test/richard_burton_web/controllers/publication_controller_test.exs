defmodule RichardBurtonWeb.PublicationControllerTest do
  @moduledoc """
  Tests for the Publication controller
  """
  alias RichardBurton.FlatPublication
  use RichardBurtonWeb.ConnCase
  import Routes, only: [publication_path: 2, publication_path: 3]

  alias RichardBurton.Country
  alias RichardBurton.Publication
  alias RichardBurton.Publisher

  @publication_attrs %{
    "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
    "year" => "1886",
    "countries" => "GB",
    "publishers" => "Bickers & Son",
    "authors" => "Isabel Burton",
    "original_authors" => "José de Alencar",
    "original_title" => "Iracema"
  }

  describe "GET /publications when there are no publications" do
    test "does not require authentication", %{conn: conn} do
      expect_auth_verify(0)
      expect_auth_authorize_admin(0)
      get(conn, publication_path(conn, :index))
    end

    test "returns rb-total-count header with value 0", %{conn: conn} do
      assert ["0"] ==
               conn
               |> get(publication_path(conn, :index))
               |> Plug.Conn.get_resp_header("rb-total-count")
    end
  end

  describe "CSRF protection on admin mutations" do
    test "rejects a POST without a CSRF token", %{conn: conn} do
      conn =
        conn
        |> delete_req_header("rb-csrf-token")
        |> post(publication_path(conn, :create_all), %{"_json" => []})

      assert response(conn, 403)
    end

    test "rejects a POST whose CSRF token is for a different subject", %{conn: conn} do
      conn =
        conn
        |> put_req_header("rb-csrf-token", RichardBurton.Auth.Csrf.sign("99999"))
        |> post(publication_path(conn, :create_all), %{"_json" => []})

      assert response(conn, 403)
    end
  end

  describe "POST /publications/bulk" do
    test "returns 201 and the created publications when all the publications are valid", meta do
      expect_auth_authorize_admin()

      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => "GB",
          "year" => 1886,
          "publishers" => "Bickers & Son",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => "GB",
          "publishers" => "Bickers & Son",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        }
      ]

      input = %{"_json" => publications}

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(201)

      assert publications == Enum.map(result, &Map.delete(&1, "id"))
    end

    test "returns 201 and inserts publications with several countries", meta do
      expect_auth_authorize_admin()

      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => "GB, US",
          "year" => 1886,
          "publishers" => "Bickers & Son",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => "GB,US",
          "publishers" => "Bickers & Son",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        },
        %{
          "authors" => "Isabel Burton, Richard Burton",
          "countries" => "GB, BR,US",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "publishers" => "Bickers & Son",
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => "1886"
        }
      ]

      input = %{"_json" => publications}

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(201)

      output = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => "GB, US",
          "year" => 1886,
          "publishers" => "Bickers & Son",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => "GB, US",
          "publishers" => "Bickers & Son",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        },
        %{
          "authors" => "Isabel Burton, Richard Burton",
          "countries" => "GB, BR, US",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "publishers" => "Bickers & Son",
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886
        }
      ]

      assert 3 == FlatPublication.all() |> length()
      assert ["GB", "US", "BR"] == Country.all() |> Enum.map(&Country.get_code/1)
      assert output == Enum.map(result, &Map.delete(&1, "id"))
    end

    test "returns 201 and inserts publications with several publishers", meta do
      expect_auth_authorize_admin()

      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => "GB",
          "year" => 1886,
          "publishers" => "Bickers & Son,Noonday Press",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => "GB",
          "publishers" => "Bickers & Son, Noonday Press",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        },
        %{
          "authors" => "Isabel Burton, Richard Burton",
          "countries" => "GB",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "publishers" => "Bickers & Son, Noonday Press,Ronald Massey",
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => "1886"
        }
      ]

      input = %{"_json" => publications}

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(201)

      output = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => "GB",
          "year" => 1886,
          "publishers" => "Bickers & Son, Noonday Press",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => "GB",
          "publishers" => "Bickers & Son, Noonday Press",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        },
        %{
          "authors" => "Isabel Burton, Richard Burton",
          "countries" => "GB",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "publishers" => "Bickers & Son, Noonday Press, Ronald Massey",
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886
        }
      ]

      publishers = ["Bickers & Son", "Noonday Press", "Ronald Massey"]

      assert 3 == FlatPublication.all() |> length()
      assert publishers == Publisher.all() |> Enum.map(&Publisher.get_name/1)
      assert output == Enum.map(result, &Map.delete(&1, "id"))
    end

    test "returns 409 when publications are repeated, and returns the first repeated one", meta do
      expect_auth_authorize_admin()

      repeated_publication = %{
        "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
        "year" => 1886,
        "countries" => "GB",
        "publishers" => "Bickers & Son",
        "authors" => "Isabel Burton",
        "original_authors" => "José de Alencar",
        "original_title" => "Iracema"
      }

      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => "GB",
          "year" => 1886,
          "publishers" => "Bickers & Son",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        repeated_publication,
        repeated_publication
      ]

      input = %{"_json" => publications}

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(409)

      assert repeated_publication == result
    end

    test "returns 400 when a publication is invalid, and returns it with its errors", meta do
      expect_auth_authorize_admin()

      invalid_publication = %{
        "title" => "",
        "year" => 1886,
        "countries" => "GB",
        "publishers" => "Bickers & Son",
        "authors" => "",
        "original_authors" => "José de Alencar",
        "original_title" => "Iracema"
      }

      invalid_publication_errors = %{
        "title" => "required",
        "authors" => "required"
      }

      publications = [
        %{
          "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          "countries" => "GB",
          "year" => 1886,
          "publishers" => "Bickers & Son",
          "authors" => "Richard Burton, Isabel Burton",
          "original_authors" => "J. M. Pereira da Silva",
          "original_title" => "Manuel de Moraes: crônica do século XVII"
        },
        invalid_publication,
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => 1886,
          "countries" => "GB",
          "publishers" => "Bickers & Son",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        }
      ]

      input = %{"_json" => publications}

      output = %{
        "publication" => invalid_publication,
        "errors" => invalid_publication_errors
      }

      result =
        meta.conn
        |> post(publication_path(meta.conn, :create_all), input)
        |> json_response(400)

      assert output == result
    end
  end

  describe "POST /publications/validate when sending valid json" do
    @correct_input_1 %{
      "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
      "year" => "1886",
      "countries" => "GB",
      "publishers" => "Bickers & Son",
      "authors" => "Isabel Burton, Richard Burton",
      "original_authors" => "José de Alencar",
      "original_title" => "Iracema"
    }
    @correct_input_2 %{
      "title" => "Ubirajara: A Legend of the Tupy Indians",
      "year" => "1922",
      "countries" => "US",
      "publishers" => "Ronald Massey",
      "authors" => "J. T. W. Sadler",
      "original_authors" => "José de Alencar",
      "original_title" => "Ubirajara"
    }
    @correct_input_3 %{
      "title" => "",
      "year" => "AAAA",
      "countries" => "GB",
      "publishers" => "Bickers & Son",
      "authors" => "",
      "original_authors" => "José de Alencar",
      "original_title" => "Iracema"
    }
    @correct_input_4 %{
      "title" => "Ubirajara: A Legend of the Tupy Indians",
      "year" => "",
      "countries" => "",
      "publishers" => "",
      "authors" => "J. T. W. Sadler",
      "original_authors" => "",
      "original_title" => ""
    }
    @correct_input_5 %{
      "title" => "Ubirajara: A Legend of the Tupy Indians",
      "year" => "",
      "countries" => "USA",
      "publishers" => "",
      "authors" => "J. T. W. Sadler",
      "original_authors" => "",
      "original_title" => ""
    }

    @input [
      @correct_input_1,
      @correct_input_2,
      @correct_input_3,
      @correct_input_4,
      @correct_input_5
    ]

    @output [
      %{
        "publication" => @correct_input_1,
        "errors" => nil
      },
      %{
        "publication" => @correct_input_2,
        "errors" => nil
      },
      %{
        "publication" => @correct_input_3,
        "errors" => %{
          "year" => "integer",
          "title" => "required",
          "authors" => "required"
        }
      },
      %{
        "publication" => @correct_input_4,
        "errors" => %{
          "year" => "required",
          "countries" => "required",
          "publishers" => "required",
          "original_authors" => "required",
          "original_title" => "required"
        }
      },
      %{
        "publication" => @correct_input_5,
        "errors" => %{
          "year" => "required",
          "countries" => "alpha2",
          "publishers" => "required",
          "original_authors" => "required",
          "original_title" => "required"
        }
      }
    ]

    test "returns 200 a list of maps with the publications an their corresponding errors", meta do
      expect_auth_authorize_admin()

      assert @output ==
               meta.conn
               |> post(publication_path(meta.conn, :validate), %{"_json" => @input})
               |> json_response(200)
    end
  end

  describe "POST /publications/validate when sending correct csv" do
    @output [
      %{
        "publication" => %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => "1886",
          "countries" => "GB",
          "publishers" => "Bickers & Son",
          "authors" => "Isabel Burton, Richard Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        },
        "errors" => nil
      },
      %{
        "publication" => %{
          "title" => "Ubirajara: A Legend of the Tupy Indians",
          "year" => "1922",
          "countries" => "US, GB",
          "publishers" => "Ronald Massey",
          "authors" => "J. T. W. Sadler",
          "original_authors" => "José de Alencar",
          "original_title" => "Ubirajara"
        },
        "errors" => nil
      },
      %{
        "publication" => %{
          "title" => "",
          "year" => "AAAA",
          "countries" => "GB",
          "publishers" => "Bickers & Son",
          "authors" => "",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        },
        "errors" => %{
          "year" => "integer",
          "title" => "required",
          "authors" => "required"
        }
      },
      %{
        "publication" => %{
          "title" => "Ubirajara: A Legend of the Tupy Indians",
          "year" => "",
          "countries" => "",
          "publishers" => "",
          "authors" => "J. T. W. Sadler",
          "original_authors" => "",
          "original_title" => ""
        },
        "errors" => %{
          "year" => "required",
          "countries" => "required",
          "publishers" => "required",
          "original_authors" => "required",
          "original_title" => "required"
        }
      }
    ]

    test "returns 200 and a list of maps with parsed publications and their corresponding errors",
         meta do
      expect_auth_authorize_admin()
      input = uploaded_csv_fixture("test/fixtures/data_correct_with_errors.csv")

      assert @output ==
               meta.conn
               |> post(publication_path(meta.conn, :validate), input)
               |> json_response(200)
    end
  end

  describe "POST /publications/validate when sending incorrect csv" do
    test "on invalid escape sequence, returns 400 with invalid_escape_sequence code", meta do
      expect_auth_authorize_admin()
      input = uploaded_csv_fixture("test/fixtures/data_incorrect_escape_sequence.csv")

      response =
        meta.conn
        |> post(publication_path(meta.conn, :validate), input)
        |> json_response(400)

      assert "invalid_escape_sequence" = response
    end
  end

  describe "GET /files/publications without search and select params" do
    test "returns 200 and a csv attachment with all the publications", meta do
      expect_auth_authorize_admin()

      {:ok, _p} =
        @publication_attrs
        |> Publication.Codec.nest()
        |> Publication.insert()

      conn = get(meta.conn, publication_path(meta.conn, :export))

      expected_data =
        "authors;countries;original_authors;original_title;publishers;title;year\nIsabel Burton;GB;José de Alencar;Iracema;Bickers & Son;Iraçéma the Honey-Lips: A Legend of Brazil;1886\n"

      expected_filename = "publications.csv"
      expected_content_disposition = ["attachment; filename=\"#{expected_filename}\""]

      content_disposition = Plug.Conn.get_resp_header(conn, "content-disposition")

      assert response_content_type(conn, :csv)
      assert expected_content_disposition == content_disposition
      assert expected_data == response(conn, 200)
    end
  end

  describe "GET /files/publications with search param and without select param" do
    test "returns 200 and a csv attachment with the requested attributes of all the matching publications",
         meta do
      expect_auth_authorize_admin()

      {:ok, [_p1, _p2]} =
        [@publication_attrs, Map.put(@publication_attrs, "title", "bla")]
        |> Publication.Codec.nest()
        |> Publication.insert_all()

      search = "Honey"

      path = "#{publication_path(meta.conn, :export)}?search=#{search}"

      conn = get(meta.conn, path)

      expected_data =
        "authors;countries;original_authors;original_title;publishers;title;year\nIsabel Burton;GB;José de Alencar;Iracema;Bickers & Son;Iraçéma the Honey-Lips: A Legend of Brazil;1886\n"

      expected_filename = "publications-#{search}.csv"
      expected_content_disposition = ["attachment; filename=\"#{expected_filename}\""]

      content_disposition = Plug.Conn.get_resp_header(conn, "content-disposition")

      assert response_content_type(conn, :csv)
      assert expected_content_disposition == content_disposition
      assert expected_data == response(conn, 200)
    end
  end

  describe "GET /files/publications with search param and with select param" do
    test "returns 200 and a csv attachment with all the matching publications", meta do
      expect_auth_authorize_admin()

      {:ok, [_p1, _p2]} =
        [@publication_attrs, Map.put(@publication_attrs, "title", "bla")]
        |> Publication.Codec.nest()
        |> Publication.insert_all()

      search = "Honey"
      attributes = [:title, :original_title, :authors]
      select = Enum.map_join(attributes, "&", &"select[]=#{&1}")

      path = "#{publication_path(meta.conn, :export)}?search=#{search}&#{select}"

      conn = get(meta.conn, path)

      expected_data =
        "authors;original_title;title\nIsabel Burton;Iracema;Iraçéma the Honey-Lips: A Legend of Brazil\n"

      expected_filename = "publications-#{search}-#{Enum.join(attributes, "-")}.csv"
      expected_content_disposition = ["attachment; filename=\"#{expected_filename}\""]

      content_disposition = Plug.Conn.get_resp_header(conn, "content-disposition")

      assert response_content_type(conn, :csv)
      assert expected_content_disposition == content_disposition
      assert expected_data == response(conn, 200)
    end
  end

  describe "GET /files/publications without search param and with select param" do
    test "returns 200 and a csv attachment with the requested attributes of all the publications",
         meta do
      expect_auth_authorize_admin()

      {:ok, _p} =
        @publication_attrs
        |> Publication.Codec.nest()
        |> Publication.insert()

      attributes = [:title, :original_title, :authors]
      select = Enum.map_join(attributes, "&", &"select[]=#{&1}")

      path = "#{publication_path(meta.conn, :export)}?#{select}"

      conn = get(meta.conn, path)

      expected_data =
        "authors;original_title;title\nIsabel Burton;Iracema;Iraçéma the Honey-Lips: A Legend of Brazil\n"

      expected_filename = "publications-#{Enum.join(attributes, "-")}.csv"
      expected_content_disposition = ["attachment; filename=\"#{expected_filename}\""]

      content_disposition = Plug.Conn.get_resp_header(conn, "content-disposition")

      assert response_content_type(conn, :csv)
      assert expected_content_disposition == content_disposition
      assert expected_data == response(conn, 200)
    end
  end

  describe "PUT /publications/:id" do
    test "updates a publication and returns the flattened result", meta do
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      attrs = %{@publication_attrs | "title" => "A New Title"}

      result =
        meta.conn
        |> put(publication_path(meta.conn, :update, publication.id), attrs)
        |> json_response(200)

      assert result["id"] == publication.id
      assert result["title"] == "A New Title"
      # The change is persisted and visible through the read model.
      assert ["A New Title"] == FlatPublication.all() |> Enum.map(& &1.title)
    end

    test "edits a keyed field, changing the record's identity", meta do
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      attrs = %{@publication_attrs | "year" => "1999"}

      result =
        meta.conn
        |> put(publication_path(meta.conn, :update, publication.id), attrs)
        |> json_response(200)

      assert result["id"] == publication.id
      assert result["year"] == 1999
    end

    test "updates the translated book when the original fields change", meta do
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      attrs = %{@publication_attrs | "original_title" => "Iracema (rev.)"}

      result =
        meta.conn
        |> put(publication_path(meta.conn, :update, publication.id), attrs)
        |> json_response(200)

      assert result["original_title"] == "Iracema (rev.)"
    end

    test "returns 409 when the edit collides with another publication", meta do
      a = insert_publication(@publication_attrs)
      _b = insert_publication(%{@publication_attrs | "title" => "Another Title"})
      expect_auth_authorize_admin()

      # Editing `a` to `b`'s title collides with `b`'s composite key.
      attrs = %{@publication_attrs | "title" => "Another Title"}

      conn = put(meta.conn, publication_path(meta.conn, :update, a.id), attrs)
      assert response(conn, 409)
    end

    test "re-saving the same data does not conflict with itself", meta do
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      conn =
        put(meta.conn, publication_path(meta.conn, :update, publication.id), @publication_attrs)

      assert response(conn, 200)
    end

    test "returns 400 for invalid data", meta do
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      attrs = %{@publication_attrs | "title" => ""}

      conn = put(meta.conn, publication_path(meta.conn, :update, publication.id), attrs)
      assert response(conn, 400)
    end

    test "returns 404 for a missing publication", meta do
      expect_auth_authorize_admin()

      conn = put(meta.conn, publication_path(meta.conn, :update, 999_999), @publication_attrs)
      assert response(conn, 404)
    end
  end

  describe "POST /publications/:id/validate" do
    test "does not report the row being edited as a conflict", meta do
      publication = insert_publication(@publication_attrs)
      expect_auth_authorize_admin()

      result =
        meta.conn
        |> post(publication_path(meta.conn, :validate, publication.id), @publication_attrs)
        |> json_response(200)

      assert result["errors"] == nil
    end

    test "reports a conflict against a different publication", meta do
      _a = insert_publication(@publication_attrs)
      b = insert_publication(%{@publication_attrs | "title" => "Another Title"})
      expect_auth_authorize_admin()

      # Validating `b` against `a`'s data conflicts with `a`.
      result =
        meta.conn
        |> post(publication_path(meta.conn, :validate, b.id), @publication_attrs)
        |> json_response(200)

      assert result["errors"] == "conflict"
    end
  end

  defp insert_publication(attrs) do
    {:ok, publication} = attrs |> Publication.Codec.nest() |> Publication.insert()
    publication
  end
end

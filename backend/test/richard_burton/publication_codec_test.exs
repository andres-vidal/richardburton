defmodule RichardBurton.Publication.CodecTest do
  @moduledoc """
  Tests for the Publication.Codec module
  """

  use RichardBurton.DataCase
  doctest RichardBurton.Publication.Codec

  alias RichardBurton.Author
  alias RichardBurton.Country
  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.Source
  alias RichardBurton.FlatPublication
  alias RichardBurton.TranslatedBook
  alias RichardBurton.OriginalBook

  describe "from_csv/1 when the provided csv is correct" do
    test "returns a list of flattened publications" do
      input = "test/fixtures/data_correct_with_errors.csv"

      output = [
        %{
          "authors" => ["Isabel Burton", "Richard Burton"],
          "countries" => ["GB"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema",
          "publishers" => ["Bickers & Son"],
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => "1886",
          "sources" => [],
          "notes" => nil
        },
        %{
          "authors" => ["J. T. W. Sadler"],
          "countries" => ["US", "GB"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Ubirajara",
          "publishers" => ["Ronald Massey"],
          "title" => "Ubirajara: A Legend of the Tupy Indians",
          "year" => "1922",
          "sources" => [],
          "notes" => nil
        },
        %{
          "authors" => [],
          "countries" => ["GB"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema",
          "publishers" => ["Bickers & Son"],
          "title" => "",
          "year" => "AAAA",
          "sources" => [],
          "notes" => nil
        }
      ]

      assert {:ok, output} == Publication.Codec.from_csv(input)
    end
  end

  describe "from_csv/1 when a value holds a comma" do
    test "a comma is part of the name, not a break between two" do
      {:ok, [row]} =
        Publication.Codec.from_csv("test/fixtures/data_correct_with_quoted_values.csv")

      assert row["publishers"] == ["Cassel, McBride & Co.", "Penguin"]
    end

    test "a value holding a comma is written back quoted, and stays one value" do
      [_headers, line] =
        Publication.Codec.to_csv([
          %{
            "publishers" => ["Cassel, McBride & Co.", "Penguin"],
            "title" => "A Brazilian Tenement"
          }
        ])

      assert line =~ ~s("Cassel, McBride & Co.; Penguin")
    end
  end

  describe "from_csv/1 when the provided csv is incorrect" do
    test "because it does not exist, return file_not_found error" do
      input = "test/fixtures/blablabla.csv"
      assert {:error, :file_not_found} == Publication.Codec.from_csv(input)
    end

    test "because it has a invalid escape sequence, return invalid_escape_sequence error" do
      input = "test/fixtures/data_incorrect_escape_sequence.csv"
      assert {:error, :invalid_escape_sequence} == Publication.Codec.from_csv(input)
    end
  end

  describe "flatten/1 on publications" do
    @output %{
      "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
      "year" => "1886",
      "countries" => ["GB"],
      "publishers" => ["Bickers & Son", "Noonday Press"],
      "authors" => ["Isabel Burton"],
      "original_authors" => ["José de Alencar"],
      "original_title" => "Iracema"
    }

    @output_struct %FlatPublication{
      title: "Iraçéma the Honey-Lips: A Legend of Brazil",
      year: 1886,
      countries: ["GB"],
      publishers: ["Bickers & Son", "Noonday Press"],
      authors: ["Isabel Burton"],
      original_authors: ["José de Alencar"],
      original_title: "Iracema",
      sources: []
    }

    test "on a nested publication-like with string keys, returns the flattened representation with string keys" do
      input = %{
        "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
        "year" => "1886",
        "countries" => ["GB"],
        "publishers" => [%{"name" => "Bickers & Son"}, %{"name" => "Noonday Press"}],
        "translated_book" => %{
          "authors" => [
            %{"name" => "Isabel Burton"}
          ],
          "original_book" => %{
            "authors" => [
              %{"name" => "José de Alencar"}
            ],
            "title" => "Iracema"
          }
        }
      }

      assert @output == Publication.Codec.flatten(input)
    end

    test "on a nested publication-like with atom keys, returns the flattened representation with string keys" do
      input = %{
        title: "Iraçéma the Honey-Lips: A Legend of Brazil",
        year: "1886",
        countries: [%{code: "GB"}],
        publishers: [%{name: "Bickers & Son"}, %{name: "Noonday Press"}],
        translated_book: %{
          authors: [
            %{name: "Isabel Burton"}
          ],
          original_book: %{
            authors: [
              %{name: "José de Alencar"}
            ],
            title: "Iracema"
          }
        }
      }

      assert @output == Publication.Codec.flatten(input)
    end

    test "on a Publication struct, returns the flattened representation with string keys" do
      # Associations are given loaded, as the flatten path expects (every caller
      # preloads) — sources included, here with none attached.
      input = %Publication{
        title: "Iraçéma the Honey-Lips: A Legend of Brazil",
        year: "1886",
        countries: [%Country{code: "GB"}],
        publishers: [%Publisher{name: "Bickers & Son"}, %Publisher{name: "Noonday Press"}],
        sources: [],
        translated_book: %TranslatedBook{
          authors: [%Author{name: "Isabel Burton"}],
          original_book: %OriginalBook{
            authors: [%Author{name: "José de Alencar"}],
            title: "Iracema"
          }
        }
      }

      assert @output_struct == Publication.Codec.flatten(input)
    end

    test "on a list, returns the flattened representation of its items, with string keys" do
      input = [
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => "1886",
          "countries" => [%{"code" => "GB"}],
          "publishers" => [%{"name" => "Bickers & Son"}, %{"name" => "Noonday Press"}],
          "translated_book" => %{
            "authors" => [
              %{"name" => "Isabel Burton"}
            ],
            "original_book" => %{
              "authors" => [
                %{"name" => "José de Alencar"}
              ],
              "title" => "Iracema"
            }
          }
        },
        %{
          title: "Iraçéma the Honey-Lips: A Legend of Brazil",
          year: "1886",
          countries: [%{code: "GB"}],
          publishers: [%{name: "Bickers & Son"}, %{name: "Noonday Press"}],
          translated_book: %{
            authors: [
              %{name: "Isabel Burton"}
            ],
            original_book: %{
              authors: [
                %{name: "José de Alencar"}
              ],
              title: "Iracema"
            }
          }
        },
        %Publication{
          title: "Iraçéma the Honey-Lips: A Legend of Brazil",
          year: "1886",
          countries: [%Country{code: "GB"}],
          publishers: [%Publisher{name: "Bickers & Son"}, %Publisher{name: "Noonday Press"}],
          sources: [],
          translated_book: %TranslatedBook{
            authors: [
              %Author{name: "Isabel Burton"}
            ],
            original_book: %OriginalBook{
              authors: [
                %Author{name: "José de Alencar"}
              ],
              title: "Iracema"
            }
          }
        }
      ]

      assert [@output, @output, @output_struct] == Publication.Codec.flatten(input)
    end
  end

  describe "flatten/1 on publication-error maps" do
    @output_publication %{
      "title" => "Ubirajara: A Legend of the Tupy Indians",
      "year" => "",
      "countries" => [],
      "publishers" => [],
      "authors" => ["J. T. W. Sadler"],
      # One author, whose name is blank — flattening says how many there are,
      # it does not judge them.
      "original_authors" => [""],
      "original_title" => ""
    }

    test "on a list, returns the flattened representation of its items, with string keys" do
      input_publication = %{
        "title" => "Ubirajara: A Legend of the Tupy Indians",
        "year" => "",
        "countries" => [],
        "publishers" => [],
        "translated_book" => %{
          "authors" => [
            %{"name" => "J. T. W. Sadler"}
          ],
          "original_book" => %{
            "authors" => [
              %{"name" => ""}
            ],
            "title" => ""
          }
        }
      }

      input = [
        %{
          publication: input_publication,
          errors: %{
            year: :required,
            countries: :required,
            publishers: :required,
            translated_book: %{
              original_book: %{
                authors: [%{name: :required}],
                title: :required
              }
            }
          }
        },
        %{
          publication: input_publication,
          errors: nil
        },
        %{
          publication: input_publication,
          errors: :conflict
        }
      ]

      output = [
        %{
          "publication" => @output_publication,
          "errors" => %{
            "year" => :required,
            "countries" => :required,
            "publishers" => :required,
            "original_authors" => :required,
            "original_title" => :required
          }
        },
        %{
          "publication" => @output_publication,
          "errors" => nil
        },
        %{
          "publication" => @output_publication,
          "errors" => :conflict
        }
      ]

      assert output == Publication.Codec.flatten(input)
    end
  end

  describe "nest/1 on flat publications" do
    @output %{
      "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
      "year" => "1886",
      "countries" => [%{"code" => "GB"}],
      "publishers" => [%{"name" => "Bickers & Son"}, %{"name" => "Noonday Press"}],
      "translated_book" => %{
        "authors" => [
          %{"name" => "Isabel Burton"}
        ],
        "original_book" => %{
          "authors" => [
            %{"name" => "José de Alencar"}
          ],
          "title" => "Iracema"
        }
      }
    }

    @output_struct %Publication{
      title: "Iraçéma the Honey-Lips: A Legend of Brazil",
      year: 1886,
      sources: [],
      countries: [%Country{code: "GB"}],
      publishers: [%Publisher{name: "Bickers & Son"}, %Publisher{name: "Noonday Press"}],
      translated_book: %TranslatedBook{
        authors: [
          %Author{name: "Isabel Burton"}
        ],
        original_book: %OriginalBook{
          title: "Iracema",
          authors: [
            %Author{name: "José de Alencar"}
          ]
        }
      }
    }

    test "on a flat-publication-like with string keys, returns the nested representation with string keys" do
      input = %{
        "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
        "year" => "1886",
        "countries" => ["GB"],
        "publishers" => ["Bickers & Son", "Noonday Press"],
        "authors" => ["Isabel Burton"],
        "original_authors" => ["José de Alencar"],
        "original_title" => "Iracema"
      }

      assert @output == Publication.Codec.nest(input)
    end

    test "on a flat-publication-like with atom keys, returns the nested representation with string keys" do
      input = %{
        title: "Iraçéma the Honey-Lips: A Legend of Brazil",
        year: "1886",
        countries: ["GB"],
        publishers: ["Bickers & Son", "Noonday Press"],
        authors: ["Isabel Burton"],
        original_authors: ["José de Alencar"],
        original_title: "Iracema"
      }

      assert @output == Publication.Codec.nest(input)
    end

    test "on a FlatPublication struct, returns the nested representation with string keys" do
      input = %FlatPublication{
        title: "Iraçéma the Honey-Lips: A Legend of Brazil",
        year: "1886",
        countries: ["GB"],
        publishers: ["Bickers & Son", "Noonday Press"],
        authors: ["Isabel Burton"],
        original_authors: ["José de Alencar"],
        original_title: "Iracema"
      }

      assert @output_struct == Publication.Codec.nest(input)
    end

    test "on a list, returns the nested representation of its items, with string keys" do
      input = [
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => "1886",
          "countries" => ["GB"],
          "publishers" => ["Bickers & Son", "Noonday Press"],
          "authors" => ["Isabel Burton"],
          "original_authors" => ["José de Alencar"],
          "original_title" => "Iracema"
        },
        %{
          title: "Iraçéma the Honey-Lips: A Legend of Brazil",
          year: "1886",
          countries: ["GB"],
          publishers: ["Bickers & Son", "Noonday Press"],
          authors: ["Isabel Burton"],
          original_authors: ["José de Alencar"],
          original_title: "Iracema"
        },
        %FlatPublication{
          title: "Iraçéma the Honey-Lips: A Legend of Brazil",
          year: "1886",
          countries: ["GB"],
          publishers: ["Bickers & Son", "Noonday Press"],
          authors: ["Isabel Burton"],
          original_authors: ["José de Alencar"],
          original_title: "Iracema"
        }
      ]

      assert [@output, @output, @output_struct] == Publication.Codec.nest(input)
    end
  end

  describe "nest/1 on the maps its callers pass" do
    @flat %{
      "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
      "year" => 1886,
      "countries" => ["GB"],
      "publishers" => ["Bickers & Son"],
      "authors" => ["Isabel Burton"],
      "original_title" => "Iracema",
      "original_authors" => ["José de Alencar"],
      "sources" => ["A source"]
    }

    test "a row as the editor sends it keeps its id, excerpts and marks as they are" do
      excerpts = %{"title" => "[[Iraçéma]] the Honey-Lips", "authors" => nil}
      marked = %{"authors" => ["[[Isabel]] Burton"]}
      input = Map.merge(@flat, %{"id" => 7, "excerpts" => excerpts, "marked" => marked})

      nested = Publication.Codec.nest(input)

      assert nested["id"] == 7
      assert nested["excerpts"] == excerpts
      assert nested["marked"] == marked

      assert nested["translated_book"] == %{
               "authors" => [%{"name" => "Isabel Burton"}],
               "original_book" => %{
                 "title" => "Iracema",
                 "authors" => [%{"name" => "José de Alencar"}]
               }
             }
    end

    test "a history snapshot comes back as a changeset casts it" do
      snapshot = Map.merge(@flat, %{"id" => 7, "excerpts" => nil, "marked" => nil})

      changeset = Publication.changeset(%Publication{}, Publication.Codec.nest(snapshot))

      assert changeset.valid?
    end

    test "a map with some of the translated book's fields gets a book with only those" do
      assert Publication.Codec.nest(%{"authors" => ["Isabel Burton"]}) ==
               %{"translated_book" => %{"authors" => [%{"name" => "Isabel Burton"}]}}

      assert Publication.Codec.nest(%{"original_title" => "Iracema"}) ==
               %{"translated_book" => %{"original_book" => %{"title" => "Iracema"}}}

      assert Publication.Codec.nest(%{
               "authors" => ["Isabel Burton"],
               "original_title" => "Iracema"
             }) == %{
               "translated_book" => %{
                 "authors" => [%{"name" => "Isabel Burton"}],
                 "original_book" => %{"title" => "Iracema"}
               }
             }
    end

    test "a map with none of the translated book's fields gets no translated book" do
      assert Publication.Codec.nest(%{"title" => "Iracema", "year" => 1886}) ==
               %{"title" => "Iracema", "year" => 1886}
    end

    test "a map that is already nested keeps its translated book" do
      skeleton = %{translated_book: %{authors: nil, original_book: %{authors: nil, title: nil}}}

      assert Publication.Codec.nest(skeleton) == %{
               "translated_book" => %{authors: nil, original_book: %{authors: nil, title: nil}}
             }
    end
  end

  describe "flatten/1 on the maps its callers pass" do
    test "leaves out the translated book's and the original book's other fields" do
      input = %{
        "title" => "Iracema",
        "translated_book" => %{
          "id" => 3,
          "authors_fingerprint" => "abc",
          "authors" => [%{"name" => "Isabel Burton"}],
          "original_book" => %{
            "id" => 4,
            "title" => "Iracema",
            "authors" => [%{"name" => "José de Alencar"}]
          }
        }
      }

      assert Publication.Codec.flatten(input) == %{
               "title" => "Iracema",
               "authors" => ["Isabel Burton"],
               "original_title" => "Iracema",
               "original_authors" => ["José de Alencar"]
             }
    end

    test "keeps other nested maps as they are" do
      excerpts = %{"title" => "[[Iracema]]", "authors" => nil}

      assert Publication.Codec.flatten(%{"title" => "Iracema", "excerpts" => excerpts}) ==
               %{"title" => "Iracema", "excerpts" => excerpts}
    end

    test "keeps a translated book that is not a map under its own key" do
      assert Publication.Codec.flatten(%{title: :required, translated_book: :required}) ==
               %{"title" => :required, "translated_book" => :required}
    end

    test "leaves a map that is already flat as it is, with its lists of names" do
      flat = %{
        "title" => "Iracema",
        "authors" => ["Isabel Burton"],
        "original_title" => "Iracema",
        "original_authors" => ["José de Alencar"],
        "countries" => ["GB"]
      }

      assert Publication.Codec.flatten(flat) == flat
    end

    test "reads the nested attrs it was nested into back to the row they came from" do
      row = %{
        "title" => "Iracema",
        "year" => 1886,
        "countries" => ["GB"],
        "publishers" => ["Bickers & Son"],
        "authors" => ["Isabel Burton"],
        "original_title" => "Iracema",
        "original_authors" => ["José de Alencar"]
      }

      assert row |> Publication.Codec.nest() |> Publication.Codec.flatten() == row
    end

    test "flattens a changeset's errors for the row that caused them" do
      attrs =
        Publication.Codec.nest(%{
          "title" => "",
          "year" => 1886,
          "countries" => ["GB"],
          "publishers" => ["Bickers & Son"],
          "authors" => ["Isabel Burton"],
          "original_title" => "",
          "original_authors" => ["José de Alencar"]
        })

      errors =
        %Publication{}
        |> Publication.changeset(attrs)
        |> RichardBurton.Validation.get_errors()

      assert %{"errors" => %{"title" => :required, "original_title" => :required}} =
               Publication.Codec.flatten(%{publication: attrs, errors: errors})
    end

    test "flattens the errors of a list whose entries are partly valid to one code" do
      attrs =
        Publication.Codec.nest(%{
          "title" => "Iracema",
          "year" => 1886,
          "countries" => ["GB", "XX"],
          "publishers" => ["Bickers & Son"],
          "authors" => ["Isabel Burton"],
          "original_title" => "Iracema",
          "original_authors" => ["José de Alencar"]
        })

      errors =
        %Publication{}
        |> Publication.changeset(attrs)
        |> RichardBurton.Validation.get_errors()

      assert %{"errors" => %{"countries" => :alpha2}} =
               Publication.Codec.flatten(%{publication: attrs, errors: errors})
    end
  end

  describe "sources round-trip" do
    test "nest turns the flat string list into positioned child maps" do
      input = %{"sources" => ["First source", "Second source"]}

      assert %{"sources" => nested} = Publication.Codec.nest(input)

      assert [
               %{"content" => "First source", "position" => 0},
               %{"content" => "Second source", "position" => 1}
             ] == nested
    end

    test "nest drops blank rows and repositions the rest" do
      input = %{"sources" => ["Real source", "", "   "]}

      assert %{"sources" => [%{"content" => "Real source", "position" => 0}]} =
               Publication.Codec.nest(input)
    end

    test "flatten turns the loaded child rows into an ordered string list" do
      input = %Publication{
        title: "Dom Casmurro",
        year: 1953,
        countries: [%Country{code: "US"}],
        publishers: [%Publisher{name: "Noonday Press"}],
        translated_book: %TranslatedBook{
          authors: [%Author{name: "Helen Caldwell"}],
          original_book: %OriginalBook{
            authors: [%Author{name: "Machado de Assis"}],
            title: "Dom Casmurro"
          }
        },
        sources: [
          %Source{content: "Second source", position: 1},
          %Source{content: "First source", position: 0}
        ]
      }

      assert %FlatPublication{sources: ["First source", "Second source"]} =
               Publication.Codec.flatten(input)
    end

    test "from_csv splits a newline-per-line sources cell into a list" do
      input = "test/fixtures/data_with_sources.csv"

      assert {:ok, [row]} = Publication.Codec.from_csv(input)
      assert ["First source", "Second source"] == row["sources"]
    end

    test "to_csv joins the sources list back into one quoted newline cell" do
      flat = %{
        "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
        "year" => "1886",
        "countries" => ["GB"],
        "publishers" => ["Bickers & Son"],
        "authors" => ["Isabel Burton"],
        "original_title" => "Iracema",
        "original_authors" => ["José de Alencar"],
        "sources" => ["First source", "Second source"]
      }

      csv = [flat] |> Publication.Codec.to_csv() |> Enum.join()

      # The newline lives inside a quoted field, so the row stays intact.
      assert csv =~ "\"First source\nSecond source\""
    end
  end

  describe "notes" do
    @notes [
      %{
        "type" => "paragraph",
        "children" => [%{"text" => "First", "bold" => true}, %{"text" => " edition, in English."}]
      },
      %{
        "type" => "list-item",
        "list" => "bulleted",
        "depth" => 0,
        "children" => [%{"text" => "Bound in green cloth"}]
      },
      %{
        "type" => "list-item",
        "list" => "bulleted",
        "depth" => 0,
        "children" => [%{"text" => "Signed \"I. Burton\" on the title page"}]
      }
    ]

    # Returns a flat publication of Iracema, with `notes`.
    defp iracema(notes) do
      %{
        "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
        "year" => "1886",
        "countries" => ["GB"],
        "publishers" => ["Bickers & Son"],
        "authors" => ["Isabel Burton"],
        "original_title" => "Iracema",
        "original_authors" => ["José de Alencar"],
        "sources" => [],
        "notes" => notes
      }
    end

    # Writes `flat_publications` to a CSV file with `to_csv/1`, and returns
    # the rows `from_csv/1` reads from it.
    defp written_and_read(flat_publications) do
      path = Path.join(System.tmp_dir!(), "notes-#{System.unique_integer([:positive])}.csv")
      File.write!(path, Publication.Codec.to_csv(flat_publications))
      on_exit(fn -> File.rm(path) end)

      {:ok, rows} = Publication.Codec.from_csv(path)
      rows
    end

    test "nest and flatten keep the notes at the top of both shapes" do
      flat = %{"title" => "Iracema", "notes" => @notes}

      nested = Publication.Codec.nest(flat)

      assert nested["notes"] == @notes
      assert Publication.Codec.flatten(nested) == flat
    end

    test "a publication flattens with its notes, and without any as nil" do
      publication =
        Publication.Codec.nest(%FlatPublication{title: "Iracema", notes: @notes})

      assert %Publication{notes: @notes} = publication
      assert %FlatPublication{notes: @notes} = Publication.Codec.flatten(publication)

      assert %FlatPublication{notes: nil} =
               Publication.Codec.flatten(%Publication{title: "Iracema"})
    end

    test "the error of the notes keeps its own key" do
      assert %{"notes" => :too_long} ==
               Publication.Codec.flatten_errors(%{notes: :too_long})

      assert %{"notes" => :malformed} ==
               Publication.Codec.flatten_errors(%{notes: :malformed})
    end

    test "from_csv reads a cell of several lines as plain text, with a paragraph between blank lines" do
      assert {:ok, [iracema, ubirajara]} =
               Publication.Codec.from_csv("test/fixtures/data_with_notes.csv")

      assert iracema["notes"] ==
               paragraphs([
                 "First edition, in English.",
                 "Bound in green cloth,\nsigned \"I. Burton\" on the title page."
               ])

      assert ubirajara["notes"] == nil
    end

    test "from_csv reads a file without a notes column as having no notes" do
      assert {:ok, [row]} = Publication.Codec.from_csv("test/fixtures/data_with_sources.csv")

      assert Map.fetch(row, "notes") == {:ok, nil}
    end

    test "to_csv writes the notes last, as plain text, quoted" do
      csv = [iracema(@notes)] |> Publication.Codec.to_csv() |> Enum.join()

      assert [header | _] = String.split(csv, "\n")

      assert header ==
               "title,year,countries,publishers,authors,original_title,original_authors,sources,notes"

      assert String.ends_with?(
               csv,
               ~s(,"First edition, in English.\n\n- Bound in green cloth\n- Signed ""I. Burton"" on the title page"\n)
             )
    end

    test "to_csv writes nil notes as an empty cell" do
      assert ["title,notes\n", "Iracema,\n"] ==
               Publication.Codec.to_csv([%{"title" => "Iracema", "notes" => nil}])
    end

    test "from_csv reads back the paragraphs and line breaks to_csv writes" do
      notes = paragraphs(["First edition, in English.", "Bound in green cloth,\nsigned."])

      assert [%{"notes" => ^notes}] = written_and_read([iracema(notes)])
    end

    test "from_csv reads the formatting to_csv drops as plain text" do
      assert [%{"notes" => read}] = written_and_read([iracema(@notes)])

      assert read ==
               paragraphs([
                 "First edition, in English.",
                 "- Bound in green cloth\n- Signed \"I. Burton\" on the title page"
               ])
    end
  end
end

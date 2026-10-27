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
          "notes_pt" => nil,
          "notes_en" => nil
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
          "notes_pt" => nil,
          "notes_en" => nil
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
          "notes_pt" => nil,
          "notes_en" => nil
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
      "sources" => [%{"pt" => "Uma fonte", "en" => "A source"}]
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
    test "nest turns the flat sources into positioned child maps" do
      input = %{
        "sources" => [%{"pt" => "Primeira fonte", "en" => "First source"}, %{"en" => "Second"}]
      }

      assert %{"sources" => nested} = Publication.Codec.nest(input)

      assert [
               %{
                 "content_pt" => "Primeira fonte",
                 "content_en" => "First source",
                 "position" => 0
               },
               %{"content_pt" => nil, "content_en" => "Second", "position" => 1}
             ] == nested
    end

    test "nest reads a string as a Portuguese text" do
      assert %{
               "sources" => [%{"content_pt" => "Uma fonte", "content_en" => nil, "position" => 0}]
             } =
               Publication.Codec.nest(%{"sources" => ["Uma fonte"]})
    end

    test "nest drops sources with no text and repositions the rest" do
      input = %{"sources" => [%{"pt" => "Real source"}, %{"pt" => "", "en" => "  "}, "   "]}

      assert %{
               "sources" => [
                 %{"content_pt" => "Real source", "content_en" => nil, "position" => 0}
               ]
             } = Publication.Codec.nest(input)
    end

    test "flatten turns the loaded child rows into ordered flat sources" do
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
          %Source{content_en: "Second source", position: 1},
          %Source{content_pt: "Primeira fonte", content_en: "First source", position: 0}
        ]
      }

      assert %FlatPublication{
               sources: [
                 %{"pt" => "Primeira fonte", "en" => "First source"},
                 %{"pt" => nil, "en" => "Second source"}
               ]
             } = Publication.Codec.flatten(input)
    end

    test "from_csv reads a file's single sources column as the Portuguese texts" do
      input = "test/fixtures/data_with_sources.csv"

      assert {:ok, [row]} = Publication.Codec.from_csv(input)

      assert [%{"pt" => "First source", "en" => nil}, %{"pt" => "Second source", "en" => nil}] ==
               row["sources"]
    end

    test "from_csv pairs the lines of the two sources cells, an empty line being no text" do
      assert {:ok, [row]} =
               read_csv("""
               title,sources_pt,sources_en
               Iracema,"Primeira fonte

               Terceira fonte","First source
               Second source
               "
               """)

      assert row["sources"] == [
               %{"pt" => "Primeira fonte", "en" => "First source"},
               %{"pt" => nil, "en" => "Second source"},
               %{"pt" => "Terceira fonte", "en" => nil}
             ]

      refute Map.has_key?(row, Publication.Codec.misaligned_sources())
    end

    test "from_csv marks a row whose sources cells list a different number of sources" do
      assert {:ok, [row]} =
               read_csv("""
               title,sources_pt,sources_en
               Iracema,"Primeira fonte
               Segunda fonte",First source
               """)

      assert row["sources"] == [
               %{"pt" => "Primeira fonte", "en" => "First source"},
               %{"pt" => "Segunda fonte", "en" => nil}
             ]

      assert row[Publication.Codec.misaligned_sources()] == true
    end

    test "from_csv does not mark a row with sources in one language only" do
      assert {:ok, [row]} =
               read_csv("""
               title,sources_pt,sources_en
               Iracema,"Primeira fonte
               Segunda fonte",
               """)

      assert length(row["sources"]) == 2
      refute Map.has_key?(row, Publication.Codec.misaligned_sources())
    end

    test "to_csv writes the sources as two cells, one line per source" do
      flat = %{
        "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
        "sources" => [
          %{"pt" => "Primeira fonte", "en" => "First source"},
          %{"pt" => nil, "en" => "Second source"}
        ]
      }

      csv = [flat] |> Publication.Codec.to_csv() |> Enum.join()

      assert [header | _] = String.split(csv, "\n")
      assert header == "title,sources_pt,sources_en"

      # The newlines live inside quoted fields, so the row stays intact.
      assert csv =~ ~s("Primeira fonte\n","First source\nSecond source")
    end

    test "from_csv reads back the sources to_csv writes, the last one in one language, as aligned" do
      sources = [
        %{"pt" => "Primeira fonte", "en" => "First source"},
        %{"pt" => nil, "en" => "Second source"},
        %{"pt" => "Terceira fonte", "en" => nil}
      ]

      assert [row = %{"sources" => ^sources}] = written_and_read([iracema(nil, sources)])
      refute Map.has_key?(row, Publication.Codec.misaligned_sources())
    end
  end

  describe "notes" do
    @notes [
      paragraph([run("First", %{"bold" => true}), run(" edition, in English.")]),
      item("bulleted", 0, "Bound in green cloth"),
      item("bulleted", 0, "Signed \"I. Burton\" on the title page")
    ]

    @notas paragraphs(["Primeira edição, em inglês."])

    test "nest and flatten keep the notes in each language at the top of both shapes" do
      flat = %{"title" => "Iracema", "notes_pt" => @notas, "notes_en" => @notes}

      nested = Publication.Codec.nest(flat)

      assert nested["notes_pt"] == @notas
      assert nested["notes_en"] == @notes
      assert Publication.Codec.flatten(nested) == flat
    end

    test "a publication flattens with its notes, and without any as nil" do
      publication =
        Publication.Codec.nest(%FlatPublication{
          title: "Iracema",
          notes_pt: @notas,
          notes_en: @notes
        })

      assert %Publication{notes_pt: @notas, notes_en: @notes} = publication

      assert %FlatPublication{notes_pt: @notas, notes_en: @notes} =
               Publication.Codec.flatten(publication)

      assert %FlatPublication{notes_pt: nil, notes_en: nil} =
               Publication.Codec.flatten(%Publication{title: "Iracema"})
    end

    test "the error of the notes in each language keeps its own key" do
      assert %{"notes_pt" => :too_long, "notes_en" => :malformed} ==
               Publication.Codec.flatten_errors(%{notes_pt: :too_long, notes_en: :malformed})
    end

    test "from_csv reads a notes column as the Portuguese notes" do
      assert {:ok, [iracema, ubirajara]} =
               Publication.Codec.from_csv("test/fixtures/data_with_notes.csv")

      assert iracema["notes_pt"] ==
               paragraphs([
                 "First edition, in English.",
                 "Bound in green cloth,\nsigned \"I. Burton\" on the title page."
               ])

      assert iracema["notes_en"] == nil
      assert ubirajara["notes_pt"] == nil
    end

    test "from_csv reads the notes columns of each language" do
      assert {:ok, [row]} =
               read_csv("""
               title,notes_pt,notes_en
               Iracema,Primeira edição.,First edition.
               """)

      assert row["notes_pt"] == paragraphs(["Primeira edição."])
      assert row["notes_en"] == paragraphs(["First edition."])
    end

    test "from_csv reads a file without notes columns as having no notes" do
      assert {:ok, [row]} = Publication.Codec.from_csv("test/fixtures/data_with_sources.csv")

      assert Map.fetch(row, "notes_pt") == {:ok, nil}
      assert Map.fetch(row, "notes_en") == {:ok, nil}
    end

    test "to_csv writes the notes last, Portuguese then English, as plain text, quoted" do
      csv = [iracema(@notes)] |> Publication.Codec.to_csv() |> Enum.join()

      assert [header | _] = String.split(csv, "\n")

      assert header ==
               "title,year,countries,publishers,authors,original_title,original_authors," <>
                 "sources_pt,sources_en,notes_pt,notes_en"

      assert String.ends_with?(
               csv,
               ~s(,,"First edition, in English.\n\n- Bound in green cloth\n- Signed ""I. Burton"" on the title page"\n)
             )
    end

    test "to_csv writes nil notes as an empty cell" do
      assert ["title,notes_pt,notes_en\n", "Iracema,,\n"] ==
               Publication.Codec.to_csv([
                 %{"title" => "Iracema", "notes_pt" => nil, "notes_en" => nil}
               ])
    end

    test "from_csv reads back the paragraphs and line breaks to_csv writes" do
      notes = paragraphs(["First edition, in English.", "Bound in green cloth,\nsigned."])

      assert [%{"notes_en" => ^notes}] = written_and_read([iracema(notes)])
    end

    test "from_csv reads back as links the links to_csv writes as their URL" do
      notes = [
        paragraph([
          run("See "),
          link("https://example.com/catalogue", "https://example.com/catalogue"),
          run(", or write to "),
          link("mailto:isabel@example.com", "isabel@example.com"),
          run(".")
        ])
      ]

      assert [%{"notes_en" => ^notes}] = written_and_read([iracema(notes)])
    end

    test "from_csv makes links of the web and email addresses in a cell" do
      assert {:ok, [%{"notes_pt" => notes}]} =
               read_csv("""
               title,notes
               Iracema,"Listed at www.example.com/iracema.
               Ask isabel@example.com (or https://example.com/contact)."
               """)

      assert notes == [
               paragraph([
                 run("Listed at "),
                 link("https://www.example.com/iracema", "www.example.com/iracema"),
                 run(".\nAsk "),
                 link("mailto:isabel@example.com", "isabel@example.com"),
                 run(" (or "),
                 link("https://example.com/contact", "https://example.com/contact"),
                 run(").")
               ])
             ]
    end

    test "from_csv reads the formatting to_csv drops as plain text" do
      assert [%{"notes_en" => read}] = written_and_read([iracema(@notes)])

      assert read ==
               paragraphs([
                 "First edition, in English.",
                 "- Bound in green cloth\n- Signed \"I. Burton\" on the title page"
               ])
    end
  end

  # Returns a flat publication of Iracema, with `notes` as its English notes,
  # no Portuguese notes, and `sources`.
  defp iracema(notes, sources \\ []) do
    %{
      "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
      "year" => "1886",
      "countries" => ["GB"],
      "publishers" => ["Bickers & Son"],
      "authors" => ["Isabel Burton"],
      "original_title" => "Iracema",
      "original_authors" => ["José de Alencar"],
      "sources" => sources,
      "notes_pt" => nil,
      "notes_en" => notes
    }
  end

  # Writes `content` to a CSV file and returns what `from_csv/1` reads from it.
  defp read_csv(content) do
    path = Path.join(System.tmp_dir!(), "codec-#{System.unique_integer([:positive])}.csv")
    File.write!(path, content)
    on_exit(fn -> File.rm(path) end)

    Publication.Codec.from_csv(path)
  end

  # Writes `flat_publications` to a CSV file with `to_csv/1`, and returns the
  # rows `from_csv/1` reads from it.
  defp written_and_read(flat_publications) do
    {:ok, rows} =
      flat_publications |> Publication.Codec.to_csv() |> Enum.join() |> read_csv()

    rows
  end
end

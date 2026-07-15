defmodule RichardBurton.Publication.CodecTest do
  @moduledoc """
  Tests for the Publication.Codec module
  """

  use RichardBurton.DataCase

  alias RichardBurton.Author
  alias RichardBurton.Country
  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.FlatPublication
  alias RichardBurton.TranslatedBook
  alias RichardBurton.OriginalBook

  describe "from_csv/1 when the provided csv is correct" do
    test "returns a list of flattened publications" do
      input = "test/fixtures/data_correct_with_errors.csv"

      output = [
        %{
          "authors" => "Isabel Burton, Richard Burton",
          "countries" => "GB",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "publishers" => "Bickers & Son",
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => "1886"
        },
        %{
          "authors" => "J. T. W. Sadler",
          "countries" => "US, GB",
          "original_authors" => "José de Alencar",
          "original_title" => "Ubirajara",
          "publishers" => "Ronald Massey",
          "title" => "Ubirajara: A Legend of the Tupy Indians",
          "year" => "1922"
        },
        %{
          "authors" => "",
          "countries" => "GB",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "publishers" => "Bickers & Son",
          "title" => "",
          "year" => "AAAA"
        },
        %{
          "authors" => "J. T. W. Sadler",
          "countries" => "",
          "original_authors" => "",
          "original_title" => "",
          "publishers" => "",
          "title" => "Ubirajara: A Legend of the Tupy Indians",
          "year" => ""
        }
      ]

      assert {:ok, output} == Publication.Codec.from_csv(input)
    end
  end

  describe "from_csv/1 when the provided csv is incorrect" do
    test "because it has malformed separators, does its best effort" do
      input = "test/fixtures/data_incorrect_malformed_separators.csv"

      output = [
        %{
          "authors" => "Isabel Burton",
          "countries" => "GB",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema",
          "publishers" => "",
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => "1886"
        },
        %{
          "authors" => "Ronald Massey",
          "countries" => "Ubirajara",
          "original_authors" => "",
          "original_title" => "Ubirajara: A Legend of the Tupy Indians",
          "publishers" => "",
          "title" => "J. T. W. Sadler",
          "year" => "GB"
        },
        %{
          "authors" => "",
          "countries" => "",
          "original_authors" =>
            "José de Alencar,1886,GB,Iracema,Iraçéma the Honey-Lips: A Legend of Brazil,Isabel Burton,Bickers & Son",
          "original_title" => "",
          "publishers" => "",
          "title" => "",
          "year" => ""
        }
      ]

      assert {:ok, output} == Publication.Codec.from_csv(input)
    end

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
      "countries" => "GB",
      "publishers" => "Bickers & Son, Noonday Press",
      "authors" => "Isabel Burton",
      "original_authors" => "José de Alencar",
      "original_title" => "Iracema"
    }

    @output_struct %FlatPublication{
      title: "Iraçéma the Honey-Lips: A Legend of Brazil",
      year: 1886,
      countries: "GB",
      countries_fingerprint: "B4043B0B8297E379BC559AB33B6AE9C7A9B4EF6519D3BAEE53270F0C0DD3D960",
      publishers: "Bickers & Son, Noonday Press",
      publishers_fingerprint: "830DE6E9CE04669334B8C1A5D61E94E37A8842B9241C2EB3C9E72E7973CF3A7C",
      authors: "Isabel Burton",
      original_authors: "José de Alencar",
      original_title: "Iracema",
      translated_book_fingerprint:
        "954F4C8E5EB33960B733BADB84134970AF5D970879260138C8C214B66DDBEF1F"
    }

    test "on a nested publication-like with string keys, returns the flattened representation with string keys" do
      input = %{
        "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
        "year" => "1886",
        "countries" => "GB",
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
      input = %Publication{
        title: "Iraçéma the Honey-Lips: A Legend of Brazil",
        year: "1886",
        countries: [%Country{code: "GB"}],
        publishers: [%Publisher{name: "Bickers & Son"}, %Publisher{name: "Noonday Press"}],
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
      "countries" => "",
      "publishers" => "",
      "authors" => "J. T. W. Sadler",
      "original_authors" => "",
      "original_title" => ""
    }

    test "on a list, returns the flattened representation of its items, with string keys" do
      input_publication = %{
        "title" => "Ubirajara: A Legend of the Tupy Indians",
        "year" => "",
        "countries" => "",
        "publishers" => "",
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
            year: "required",
            countries: "required",
            publishers: "required",
            translated_book: %{
              original_book: %{
                authors: [%{name: "required"}],
                title: "required"
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
            "year" => "required",
            "countries" => "required",
            "publishers" => "required",
            "original_authors" => "required",
            "original_title" => "required"
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
      countries: [%Country{code: "GB"}],
      countries_fingerprint: "B4043B0B8297E379BC559AB33B6AE9C7A9B4EF6519D3BAEE53270F0C0DD3D960",
      publishers: [%Publisher{name: "Bickers & Son"}, %Publisher{name: "Noonday Press"}],
      publishers_fingerprint: "830DE6E9CE04669334B8C1A5D61E94E37A8842B9241C2EB3C9E72E7973CF3A7C",
      translated_book: %TranslatedBook{
        authors: [
          %Author{name: "Isabel Burton"}
        ],
        authors_fingerprint: "3D9BE0F48628685291383A430443DE4D864E69660C376B17EE9E7501BE5BB2D8",
        original_book: %OriginalBook{
          title: "Iracema",
          authors: [
            %Author{name: "José de Alencar"}
          ],
          authors_fingerprint: "65931E62E55E5151BD2F625E9D3CBD821B6D4B6CE0B6F600BAFB9D49E2F338CB"
        },
        original_book_fingerprint:
          "F9846F5EAF84555CE8AA7D20C8C89BEAB11C1466A2A79B0700050FEAC784226B"
      },
      translated_book_fingerprint:
        "954F4C8E5EB33960B733BADB84134970AF5D970879260138C8C214B66DDBEF1F"
    }

    test "on a flat-publication-like with string keys, returns the nested representation with string keys" do
      input = %{
        "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
        "year" => "1886",
        "countries" => "GB",
        "publishers" => "Bickers & Son, Noonday Press",
        "authors" => "Isabel Burton",
        "original_authors" => "José de Alencar",
        "original_title" => "Iracema"
      }

      assert @output == Publication.Codec.nest(input)
    end

    test "on a flat-publication-like with atom keys, returns the nested representation with string keys" do
      input = %{
        title: "Iraçéma the Honey-Lips: A Legend of Brazil",
        year: "1886",
        countries: "GB",
        publishers: "Bickers & Son, Noonday Press",
        authors: "Isabel Burton",
        original_authors: "José de Alencar",
        original_title: "Iracema"
      }

      assert @output == Publication.Codec.nest(input)
    end

    test "on a FlatPublication struct, returns the nested representation with string keys" do
      input = %FlatPublication{
        title: "Iraçéma the Honey-Lips: A Legend of Brazil",
        year: "1886",
        countries: "GB",
        publishers: "Bickers & Son, Noonday Press",
        authors: "Isabel Burton",
        original_authors: "José de Alencar",
        original_title: "Iracema"
      }

      assert @output_struct == Publication.Codec.nest(input)
    end

    test "on a list, returns the nested representation of its items, with string keys" do
      input = [
        %{
          "title" => "Iraçéma the Honey-Lips: A Legend of Brazil",
          "year" => "1886",
          "countries" => "GB",
          "publishers" => "Bickers & Son, Noonday Press",
          "authors" => "Isabel Burton",
          "original_authors" => "José de Alencar",
          "original_title" => "Iracema"
        },
        %{
          title: "Iraçéma the Honey-Lips: A Legend of Brazil",
          year: "1886",
          countries: "GB",
          publishers: "Bickers & Son, Noonday Press",
          authors: "Isabel Burton",
          original_authors: "José de Alencar",
          original_title: "Iracema"
        },
        %FlatPublication{
          title: "Iraçéma the Honey-Lips: A Legend of Brazil",
          year: "1886",
          countries: "GB",
          publishers: "Bickers & Son, Noonday Press",
          authors: "Isabel Burton",
          original_authors: "José de Alencar",
          original_title: "Iracema"
        }
      ]

      assert [@output, @output, @output_struct] == Publication.Codec.nest(input)
    end
  end
end

defmodule RichardBurton.Publication.ChartTest do
  @moduledoc """
  Tests `RichardBurton.Publication.Chart`: reading a chart from parameters, and
  counting it over every publication in the index or over the ones a search
  matches.
  """

  use RichardBurton.DataCase

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Publication.Chart
  alias RichardBurton.Publication.Index

  # Seven publications of five works. Dom Casmurro has two translations, and
  # Helen Caldwell's translation is published twice. John Gledson's Dom Casmurro
  # names two countries.
  @publications [
    %{
      title: "Dom Casmurro",
      year: 1953,
      countries: ["US"],
      publishers: ["Noonday Press"],
      authors: ["Helen Caldwell"],
      original_title: "Dom Casmurro",
      original_authors: ["Machado de Assis"]
    },
    %{
      title: "Dom Casmurro",
      year: 1966,
      countries: ["US"],
      publishers: ["University of California Press"],
      authors: ["Helen Caldwell"],
      original_title: "Dom Casmurro",
      original_authors: ["Machado de Assis"]
    },
    %{
      title: "Dom Casmurro",
      year: 1997,
      countries: ["GB", "US"],
      publishers: ["Oxford University Press"],
      authors: ["John Gledson"],
      original_title: "Dom Casmurro",
      original_authors: ["Machado de Assis"]
    },
    %{
      title: "Epitaph of a Small Winner",
      year: 1952,
      countries: ["US"],
      publishers: ["Noonday Press"],
      authors: ["William Grossman"],
      original_title: "Memórias póstumas de Brás Cubas",
      original_authors: ["Machado de Assis"]
    },
    %{
      title: "The Hour of the Star",
      year: 1986,
      countries: ["GB"],
      publishers: ["Carcanet"],
      authors: ["Giovanni Pontiero"],
      original_title: "A hora da estrela",
      original_authors: ["Clarice Lispector"]
    },
    %{
      title: "The Passion According to G.H.",
      year: 1988,
      countries: ["US"],
      publishers: ["University of Minnesota Press"],
      authors: ["Ronald W. Sousa"],
      original_title: "A paixão segundo G.H.",
      original_authors: ["Clarice Lispector"]
    },
    %{
      title: "Iraçéma the Honey-Lips",
      year: 1886,
      countries: ["GB"],
      publishers: ["Bickers & Son"],
      authors: ["Isabel Burton"],
      original_title: "Iracema",
      original_authors: ["José de Alencar"]
    }
  ]

  setup do
    seed(@publications)
    []
  end

  # Inserts flat publications the way an import does, then refreshes the index
  # that `Chart` reads from.
  defp seed(publications) do
    publications
    |> Publication.Codec.nest()
    |> Enum.each(&({:ok, _} = Publication.insert(&1)))

    Publication.Index.Refresher.refresh()
  end

  # Counts a chart with `fields` over every publication, or over the ones
  # `term` matches.
  defp draw(fields, term \\ nil) do
    base = if term, do: Index.matching(term), else: FlatPublication
    Chart.draw(base, struct!(Chart, fields))
  end

  # Returns the groups of a chart that have items.
  defp counted(chart), do: Enum.reject(chart.groups, &(&1.total == 0))

  describe "parse/1" do
    test "fills in the defaults" do
      assert Chart.parse(%{}) ==
               {:ok,
                %Chart{
                  count: :publications,
                  by: :year,
                  split: nil,
                  over: nil,
                  first: false,
                  top: nil,
                  least: nil
                }}
    end

    test "reads every field from strings, and ignores other parameters" do
      assert Chart.parse(%{
               "count" => "translations",
               "by" => "work",
               "over" => "decade",
               "first" => "true",
               "top" => "10",
               "least" => "2",
               "search" => "machado"
             }) ==
               {:ok,
                %Chart{
                  count: :translations,
                  by: :work,
                  over: :decade,
                  first: true,
                  top: 10,
                  least: 2
                }}
    end

    test "refuses a value that is not one of a field's values" do
      assert Chart.parse(%{"count" => "readers", "by" => "colour"}) ==
               {:error, %{count: :invalid, by: :invalid}}

      assert Chart.parse(%{"top" => "0"}) == {:error, %{top: :invalid}}
    end

    test "refuses fields that do not go together" do
      # Steps of time within groups of time.
      assert Chart.parse(%{"by" => "decade", "over" => "year"}) ==
               {:error, %{over: :invalid}}

      # Steps together with series.
      assert Chart.parse(%{"by" => "translator", "over" => "year", "split" => "kind"}) ==
               {:error, %{over: :invalid}}

      # A first appearance with no time to place it in.
      assert Chart.parse(%{"by" => "translator", "first" => "true"}) ==
               {:error, %{first: :invalid}}

      # A ranking of groups that are not ranked.
      assert Chart.parse(%{"by" => "year", "top" => "5"}) == {:error, %{top: :invalid}}
      assert Chart.parse(%{"by" => "kind", "least" => "2"}) == {:error, %{least: :invalid}}
    end
  end

  describe "draw/2 by year or decade" do
    test "counts each year by the two leading countries, and every other country together" do
      chart = draw(by: :year, split: :country)

      assert chart.series == ["US", "GB", nil]
      assert Enum.map(chart.groups, & &1.key) == Enum.to_list(1886..1997)

      # Gledson's Dom Casmurro names both countries, and counts once, under the
      # United States.
      assert counted(chart) == [
               %{key: 1886, total: 1, counts: [0, 1, 0]},
               %{key: 1952, total: 1, counts: [1, 0, 0]},
               %{key: 1953, total: 1, counts: [1, 0, 0]},
               %{key: 1966, total: 1, counts: [1, 0, 0]},
               %{key: 1986, total: 1, counts: [0, 1, 0]},
               %{key: 1988, total: 1, counts: [1, 0, 0]},
               %{key: 1997, total: 1, counts: [1, 0, 0]}
             ]
    end

    test "counts a publication in neither leading country in the last series" do
      seed([
        %{
          title: "The Devil to Pay in the Backlands",
          year: 1963,
          countries: ["CA"],
          publishers: ["Knopf"],
          authors: ["James L. Taylor"],
          original_title: "Grande Sertão: Veredas",
          original_authors: ["João Guimarães Rosa"]
        }
      ])

      assert %{key: 1963, total: 1, counts: [0, 0, 1]} in draw(by: :year, split: :country).groups
    end

    test "counts each decade by kind, from the first to the last, including the ones with none" do
      chart = draw(by: :decade, split: :kind)

      assert chart.series == ["first_translation", "retranslation", "reissue"]
      assert Enum.map(chart.groups, & &1.key) == Enum.to_list(1880..1990//10)

      # Caldwell's Dom Casmurro of 1966 is a reissue of her 1953 translation,
      # and Gledson's of 1997 is a retranslation of the work.
      assert counted(chart) == [
               %{key: 1880, total: 1, counts: [1, 0, 0]},
               %{key: 1950, total: 2, counts: [2, 0, 0]},
               %{key: 1960, total: 1, counts: [0, 0, 1]},
               %{key: 1980, total: 2, counts: [2, 0, 0]},
               %{key: 1990, total: 1, counts: [0, 1, 0]}
             ]
    end

    test "tells kinds of publication apart over the whole index, not the search" do
      # The 1966 Dom Casmurro is a reissue even though the search leaves out
      # the 1953 edition.
      assert draw([by: :decade, split: :kind], "year:1960-1969").groups == [
               %{key: 1960, total: 1, counts: [0, 0, 1]}
             ]
    end

    test "counts each original author in the decade of their first publication" do
      chart = draw(count: :original_authors, by: :decade, first: true)

      assert Enum.map(chart.groups, & &1.key) == Enum.to_list(1880..1980//10)

      assert counted(chart) == [
               %{key: 1880, total: 1, counts: [1]},
               %{key: 1950, total: 1, counts: [1]},
               %{key: 1980, total: 1, counts: [1]}
             ]
    end

    test "finds an item's first appearance in the whole index, not the search" do
      # Machado de Assis is first published in 1952, which the search leaves
      # out.
      assert draw([count: :original_authors, by: :decade, first: true], "year:1960-1969").groups ==
               [%{key: 1950, total: 1, counts: [1]}]
    end

    test "places a first appearance in the series of its publication" do
      # Dom Casmurro first appears in 1953, as a first translation, and is not
      # counted again in 1966 or 1997.
      assert counted(draw(count: :works, by: :decade, split: :kind, first: true)) == [
               %{key: 1880, total: 1, counts: [1, 0, 0]},
               %{key: 1950, total: 2, counts: [2, 0, 0]},
               %{key: 1980, total: 2, counts: [2, 0, 0]}
             ]
    end
  end

  describe "draw/2 by kind" do
    test "lists the three kinds, and counts an item in each kind it has" do
      # Helen Caldwell has a first translation and a reissue.
      assert draw(count: :translators, by: :kind).groups == [
               %{key: "first_translation", total: 5, counts: [5]},
               %{key: "retranslation", total: 1, counts: [1]},
               %{key: "reissue", total: 1, counts: [1]}
             ]
    end
  end

  describe "draw/2 by names" do
    test "ranks the names with the most items first, and sorts ties by name" do
      chart = draw(by: :original_author)

      assert chart.groups == [
               %{key: "Machado de Assis", total: 4, counts: [4]},
               %{key: "Clarice Lispector", total: 2, counts: [2]},
               %{key: "José de Alencar", total: 1, counts: [1]}
             ]

      assert chart.hidden == 0
    end

    test "keeps the top groups, and says how many it left out" do
      seed(
        for n <- 1..5 do
          %{
            title: "Paged Work #{n}",
            year: 2000 + n,
            countries: ["US"],
            publishers: ["Paged Press"],
            authors: ["Paged Translator #{n}"],
            original_title: "Original #{n}",
            original_authors: ["Paged Author #{n}"]
          }
        end
      )

      chart = draw(by: :translator, top: 10)

      assert length(chart.groups) == 10
      assert chart.hidden == 1
      assert hd(chart.groups) == %{key: "Helen Caldwell", total: 2, counts: [2]}
    end

    test "counts a publication in every country it names" do
      assert draw(by: :country).groups == [
               %{key: "US", total: 5, counts: [5]},
               %{key: "GB", total: 3, counts: [3]}
             ]
    end

    test "counts the pairs of an original author and a translator by the publications they share" do
      assert draw(by: :pair).groups == [
               %{
                 key: %{author: "Machado de Assis", translator: "Helen Caldwell"},
                 total: 2,
                 counts: [2]
               },
               %{
                 key: %{author: "Clarice Lispector", translator: "Giovanni Pontiero"},
                 total: 1,
                 counts: [1]
               },
               %{
                 key: %{author: "Clarice Lispector", translator: "Ronald W. Sousa"},
                 total: 1,
                 counts: [1]
               },
               %{
                 key: %{author: "José de Alencar", translator: "Isabel Burton"},
                 total: 1,
                 counts: [1]
               },
               %{
                 key: %{author: "Machado de Assis", translator: "John Gledson"},
                 total: 1,
                 counts: [1]
               },
               %{
                 key: %{author: "Machado de Assis", translator: "William Grossman"},
                 total: 1,
                 counts: [1]
               }
             ]
    end

    test "splits a group's distinct items into series that can overlap" do
      # Helen Caldwell translated Machado de Assis for a first translation and
      # a reissue, so the series add up to four of his three translators.
      assert hd(draw(count: :translators, by: :original_author, split: :kind).groups) == %{
               key: "Machado de Assis",
               total: 3,
               counts: [2, 1, 1]
             }
    end

    test "counts each group in steps of time, naming the items of each step" do
      [caldwell | _] = draw(by: :translator, over: :year, top: 1).groups

      assert caldwell == %{
               key: "Helen Caldwell",
               total: 2,
               counts: [2],
               steps: [
                 %{at: 1953, total: 1, items: [["Dom Casmurro"]]},
                 %{at: 1966, total: 1, items: [["Dom Casmurro"]]}
               ]
             }
    end

    test "places the first appearance of each item within its group" do
      # Each translation of Dom Casmurro is placed at its first publication, and
      # named by its translators.
      chart = draw(count: :translations, by: :work, over: :year, first: true, least: 2)

      assert chart.groups == [
               %{
                 key: %{title: "Dom Casmurro", authors: ["Machado de Assis"]},
                 total: 2,
                 counts: [2],
                 steps: [
                   %{at: 1953, total: 1, items: [["Helen Caldwell"]]},
                   %{at: 1997, total: 1, items: [["John Gledson"]]}
                 ]
               }
             ]
    end

    test "keeps only the groups with at least `least` items" do
      assert [%{key: "Machado de Assis"}] = draw(by: :original_author, least: 3).groups
    end

    test "breaks a tie between groups with the number of their publications" do
      # Both authors have two works, but Machado de Assis has four
      # publications and Clarice Lispector two.
      assert Enum.map(draw(count: :works, by: :original_author).groups, &{&1.key, &1.total}) == [
               {"Machado de Assis", 2},
               {"Clarice Lispector", 2},
               {"José de Alencar", 1}
             ]
    end
  end

  describe "draw/2 with a search" do
    test "counts only the publications a search matches" do
      assert draw([by: :original_author], "machado").groups == [
               %{key: "Machado de Assis", total: 4, counts: [4]}
             ]

      assert draw([by: :country], "machado").groups == [
               %{key: "US", total: 4, counts: [4]},
               %{key: "GB", total: 1, counts: [1]}
             ]
    end

    test "reads operators the way the index does" do
      assert draw([by: :decade, split: :kind], "year:1980-1989").groups == [
               %{key: 1980, total: 2, counts: [2, 0, 0]}
             ]
    end
  end

  describe "nothing/1" do
    test "has the series and the fixed groups, with no items" do
      assert Chart.nothing(%Chart{by: :kind, split: :kind}) == %{
               series: ["first_translation", "retranslation", "reissue"],
               groups: [
                 %{key: "first_translation", total: 0, counts: [0, 0, 0]},
                 %{key: "retranslation", total: 0, counts: [0, 0, 0]},
                 %{key: "reissue", total: 0, counts: [0, 0, 0]}
               ],
               hidden: 0
             }

      assert Chart.nothing(%Chart{by: :translator, over: :year}) ==
               %{series: [nil], groups: [], hidden: 0}
    end
  end
end

defmodule RichardBurton.Publication.InsightsTest do
  @moduledoc """
  Tests `RichardBurton.Publication.Insights.describe/1` over every publication
  in the index and over the ones a search matches.
  """

  use RichardBurton.DataCase

  alias RichardBurton.Publication
  alias RichardBurton.Publication.Insights

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
      original_authors: ["Machado de Assis"],
      sources: ["Caldwell, Helen. Introduction, 1953."]
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
      original_authors: ["José de Alencar"],
      sources: ["Burton, Isabel. Preface, 1886."]
    }
  ]

  setup do
    seed(@publications)
    []
  end

  # Inserts flat publications the way an import does, then refreshes the index
  # that `Insights` reads from.
  defp seed(publications) do
    publications
    |> Publication.Codec.nest()
    |> Enum.each(&({:ok, _} = Publication.insert(&1)))

    Publication.Index.Refresher.refresh()
  end

  describe "describe/0" do
    test "counts the publications and the span of years they cover" do
      insights = Insights.describe()

      assert insights.publications == 7
      assert insights.years == %{first: 1886, last: 1997}
      assert insights.sourced == 2
    end

    test "counts each decade from the first to the last, including the ones with none" do
      decades = Insights.describe().decades

      assert Enum.map(decades, & &1.decade) == Enum.to_list(1880..1990//10)

      assert Enum.reject(decades, &(&1.count == 0)) == [
               %{decade: 1880, count: 1},
               %{decade: 1950, count: 2},
               %{decade: 1960, count: 1},
               %{decade: 1980, count: 2},
               %{decade: 1990, count: 1}
             ]
    end

    test "counts each name once however many publications name it" do
      assert Insights.describe().totals == %{
               works: 5,
               original_authors: 3,
               translators: 6,
               publishers: 6,
               countries: 2
             }
    end

    test "leads with the names most publications name, and lists ties alphabetically" do
      insights = Insights.describe()

      assert insights.original_authors == [
               %{name: "Machado de Assis", count: 4},
               %{name: "Clarice Lispector", count: 2},
               %{name: "José de Alencar", count: 1}
             ]

      assert insights.translators == [
               %{name: "Helen Caldwell", count: 2},
               %{name: "Giovanni Pontiero", count: 1},
               %{name: "Isabel Burton", count: 1},
               %{name: "John Gledson", count: 1},
               %{name: "Ronald W. Sousa", count: 1},
               %{name: "William Grossman", count: 1}
             ]

      assert hd(insights.publishers) == %{name: "Noonday Press", count: 2}
    end

    test "counts a publication in every country it names" do
      assert Insights.describe().countries == [
               %{code: "US", count: 5},
               %{code: "GB", count: 3}
             ]
    end

    test "tells a second translation of a work apart from the same one published again" do
      assert Insights.describe().retranslated == [
               %{
                 title: "Dom Casmurro",
                 authors: ["Machado de Assis"],
                 translations: 2,
                 publications: 3
               }
             ]
    end

    test "leads with ten names at most" do
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

      insights = Insights.describe()

      assert insights.totals.translators == 11
      assert length(insights.translators) == 10
    end
  end

  describe "describe/1" do
    test "counts only the publications a search matches" do
      insights = Insights.describe("machado")

      assert insights.publications == 4
      assert insights.years == %{first: 1952, last: 1997}
      assert insights.original_authors == [%{name: "Machado de Assis", count: 4}]
      assert insights.totals.works == 2
      assert insights.countries == [%{code: "US", count: 4}, %{code: "GB", count: 1}]
      assert [%{title: "Dom Casmurro"}] = insights.retranslated
    end

    test "reads operators the way the index does" do
      insights = Insights.describe("year:1980-1989")

      assert insights.publications == 2
      assert insights.original_authors == [%{name: "Clarice Lispector", count: 2}]
      assert insights.decades == [%{decade: 1980, count: 2}]
    end

    test "describes nothing when the search matches nothing" do
      assert Insights.describe("zzyzx") == %{
               publications: 0,
               years: nil,
               decades: [],
               totals: %{
                 works: 0,
                 original_authors: 0,
                 translators: 0,
                 publishers: 0,
                 countries: 0
               },
               original_authors: [],
               translators: [],
               publishers: [],
               countries: [],
               retranslated: [],
               sourced: 0
             }
    end
  end
end

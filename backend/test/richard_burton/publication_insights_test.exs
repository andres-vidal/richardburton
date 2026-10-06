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

      # Caldwell's Dom Casmurro of 1966 is a reissue of her 1953 translation,
      # and Gledson's of 1997 is a retranslation of the work.
      assert Enum.reject(decades, &(&1.count == 0)) == [
               %{decade: 1880, count: 1, first_translations: 1, retranslations: 0, reissues: 0},
               %{decade: 1950, count: 2, first_translations: 2, retranslations: 0, reissues: 0},
               %{decade: 1960, count: 1, first_translations: 0, retranslations: 0, reissues: 1},
               %{decade: 1980, count: 2, first_translations: 2, retranslations: 0, reissues: 0},
               %{decade: 1990, count: 1, first_translations: 0, retranslations: 1, reissues: 0}
             ]
    end

    test "counts each year by the two countries with the most publications" do
      annual = Insights.describe().annual

      assert annual.countries == ["US", "GB"]
      assert Enum.map(annual.years, & &1.year) == Enum.to_list(1886..1997)

      # Gledson's Dom Casmurro names both countries, and counts once, under the
      # United States.
      assert Enum.reject(annual.years, &(&1.counts == [0, 0])) == [
               %{year: 1886, counts: [0, 1], elsewhere: 0},
               %{year: 1952, counts: [1, 0], elsewhere: 0},
               %{year: 1953, counts: [1, 0], elsewhere: 0},
               %{year: 1966, counts: [1, 0], elsewhere: 0},
               %{year: 1986, counts: [0, 1], elsewhere: 0},
               %{year: 1988, counts: [1, 0], elsewhere: 0},
               %{year: 1997, counts: [1, 0], elsewhere: 0}
             ]
    end

    test "counts a publication in neither leading country as elsewhere" do
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

      assert %{year: 1963, counts: [0, 0], elsewhere: 1} in Insights.describe().annual.years
    end

    test "counts the original authors by the decade of their first publication" do
      debuts = Insights.describe().debuts

      assert Enum.map(debuts, & &1.decade) == Enum.to_list(1880..1980//10)

      assert Enum.reject(debuts, &(&1.count == 0)) == [
               %{decade: 1880, count: 1},
               %{decade: 1950, count: 1},
               %{decade: 1980, count: 1}
             ]
    end

    test "leads with the authors and translators that appear together most" do
      assert Insights.describe().pairs == [
               %{author: "Machado de Assis", translator: "Helen Caldwell", count: 2},
               %{author: "Clarice Lispector", translator: "Giovanni Pontiero", count: 1},
               %{author: "Clarice Lispector", translator: "Ronald W. Sousa", count: 1},
               %{author: "José de Alencar", translator: "Isabel Burton", count: 1},
               %{author: "Machado de Assis", translator: "John Gledson", count: 1},
               %{author: "Machado de Assis", translator: "William Grossman", count: 1}
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

      assert Enum.map(insights.translators, &Map.take(&1, [:name, :count])) == [
               %{name: "Helen Caldwell", count: 2},
               %{name: "Giovanni Pontiero", count: 1},
               %{name: "Isabel Burton", count: 1},
               %{name: "John Gledson", count: 1},
               %{name: "Ronald W. Sousa", count: 1},
               %{name: "William Grossman", count: 1}
             ]

      # Each translator also has the years of their publications.
      assert hd(insights.translators).years == [
               %{year: 1953, count: 1},
               %{year: 1966, count: 1}
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
                 publications: 3,
                 timeline: [
                   %{year: 1953, translators: ["Helen Caldwell"]},
                   %{year: 1997, translators: ["John Gledson"]}
                 ]
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

      assert insights.decades == [
               %{decade: 1980, count: 2, first_translations: 2, retranslations: 0, reissues: 0}
             ]
    end

    test "tells kinds of publication and debuts apart over the whole index, not the search" do
      insights = Insights.describe("year:1960-1969")

      # The 1966 Dom Casmurro is a reissue even though the search leaves out the
      # 1953 edition, and Machado de Assis's debut is still 1952.
      assert insights.decades == [
               %{decade: 1960, count: 1, first_translations: 0, retranslations: 0, reissues: 1}
             ]

      assert insights.debuts == [%{decade: 1950, count: 1}]
    end

    test "describes nothing when the search matches nothing" do
      assert Insights.describe("zzyzx") == %{
               publications: 0,
               years: nil,
               annual: %{countries: [], years: []},
               decades: [],
               debuts: [],
               pairs: [],
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

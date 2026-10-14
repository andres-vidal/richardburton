defmodule RichardBurton.Publication.InsightsTest do
  @moduledoc """
  Tests `RichardBurton.Publication.Insights.describe/2` over every publication
  in the index and over the ones a search matches. The charts are tested in
  `RichardBurton.Publication.ChartTest`.
  """

  use RichardBurton.DataCase

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Publication.Chart
  alias RichardBurton.Publication.Index
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

  describe "describe/2" do
    test "counts the publications and the span of years they cover" do
      insights = Insights.describe()

      assert insights.publications == 7
      assert insights.years == %{first: 1886, last: 1997}
      assert insights.sourced == 2
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

    test "draws the chart over the same publications" do
      chart = %Chart{by: :decade, split: :kind}

      assert Insights.describe(nil, chart).chart == Chart.draw(FlatPublication, chart)

      assert Insights.describe("machado", chart).chart ==
               Chart.draw(Index.matching("machado"), chart)
    end

    test "counts only the publications a search matches" do
      insights = Insights.describe("machado")

      assert insights.publications == 4
      assert insights.years == %{first: 1952, last: 1997}

      assert insights.totals == %{
               works: 2,
               original_authors: 1,
               translators: 3,
               publishers: 3,
               countries: 2
             }
    end

    test "reads operators the way the index does" do
      insights = Insights.describe("year:1980-1989")

      assert insights.publications == 2
      assert insights.totals.original_authors == 1
    end

    test "describes nothing when the search matches nothing" do
      chart = %Chart{by: :kind}

      assert Insights.describe("zzyzx", chart) == %{
               publications: 0,
               years: nil,
               totals: %{
                 works: 0,
                 original_authors: 0,
                 translators: 0,
                 publishers: 0,
                 countries: 0
               },
               sourced: 0,
               chart: Chart.nothing(chart)
             }
    end
  end
end

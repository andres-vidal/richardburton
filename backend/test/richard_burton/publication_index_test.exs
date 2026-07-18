defmodule RichardBurton.Publication.IndexTest do
  @moduledoc """
  Tests for the Publication.Index module
  """

  use RichardBurton.DataCase

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Util

  @publications [
    %FlatPublication{
      authors: "Arthur Brakel",
      countries: "CA",
      countries_fingerprint: "4B650E5C4785025DEE7BD65E3C5C527356717D7A1C0BFEF5B4ADA8CA1E9CBE17",
      original_authors: "Cyro dos Anjos",
      original_title: "O amanuense Belmiro",
      publishers: "Fairleigh Dickinson University Press",
      publishers_fingerprint: "BDBBE0C6ACE0F5D7CDAC2301CBD7DDE19808618AF03AB6B6546FF30A82F4FA5E",
      title: "Diary of a Civil Servant",
      year: 1986
    },
    %FlatPublication{
      authors: "Arthur Brakel",
      countries: "GB",
      countries_fingerprint: "B4043B0B8297E379BC559AB33B6AE9C7A9B4EF6519D3BAEE53270F0C0DD3D960",
      original_authors: "Cyro dos Anjos",
      original_title: "O amanuense Belmiro",
      publishers: "Associated University Presses",
      publishers_fingerprint: "FA1B59EB992D97EB10B6219661EA4C9C740D509048CC0DF9A86EB3BC8EB8E45B",
      title: "Diary of a Civil Servant",
      year: 1988
    },
    %FlatPublication{
      authors: "Dorothy Scott Loos",
      countries: "GB, US",
      countries_fingerprint: "F060274D35CC0709781F13A9331376B035C9A04546FE43381BC5749F1362C8BF",
      original_authors: "Rachel de Queiroz",
      original_title: "Dora Doralina",
      publishers: "Dutton",
      publishers_fingerprint: "289485905D12E66D52118BCFECB6C911B1A8E4379477DD98ED30F2ED795E260C",
      title: "Dora Doralina",
      year: 1984
    },
    %FlatPublication{
      authors: "E. Percy Ellis",
      countries: "BR",
      countries_fingerprint: "BBAF8352442730E92C16C5EA6B0FF7CC595C24E02D8E8BFC5FEA5A4E0BB0B46B",
      original_authors: "Machado de Assis",
      original_title: "Memórias póstumas de Brás Cubas",
      publishers: "Instituto Nacional do Livro",
      publishers_fingerprint: "CFC153F1AB2F32958A66F3F4B36EECFFDF8A28C48F202DE09FFEFF6BE98F1027",
      title: "Posthumous Reminiscences of Brás Cubas",
      year: 1955
    },
    %FlatPublication{
      authors: "Fred P. Ellison",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Rachel de Queiroz",
      original_title: "As três Marias",
      publishers: "University of Texas Press",
      publishers_fingerprint: "2F6FE554F3CF1014B2345ADE7C06166EA58D929FBEE633D4A782126F5C4331EA",
      title: "The Three Marias",
      year: 1963
    },
    %FlatPublication{
      authors: "Gregory Rabassa",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Machado de Assis",
      original_title: "Memórias póstumas de Brás Cubas",
      publishers: "Oxford University Press",
      publishers_fingerprint: "27E4CE2B302408251962F38DD2928A99EB212A7BB09088BBBE6F77944A11A90D",
      title: "Posthumous Memoirs of Bras Cubas",
      year: 1997
    },
    %FlatPublication{
      authors: "Jean Neel Karnoff",
      countries: "GB",
      countries_fingerprint: "B4043B0B8297E379BC559AB33B6AE9C7A9B4EF6519D3BAEE53270F0C0DD3D960",
      original_authors: "Erico Verissimo",
      original_title: "Olhai os lírios do campo",
      publishers: "Greenwood",
      publishers_fingerprint: "37AA9A83218BF5F4A5F6EABA530C07E64316BA03788B42D0A2A419719B8B12BC",
      title: "Consider the Lilies of the Field",
      year: 1969
    },
    %FlatPublication{
      authors: "L. C. Kaplan",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Graciliano Ramos",
      original_title: "Angústia",
      publishers: "Alfred A. Knopf",
      publishers_fingerprint: "A4AFA4682BC9F658DD5DAD7649822F925C9A4FB0A72459F631FA32D07CC405D4",
      title: "Anguish",
      year: 1946
    },
    %FlatPublication{
      authors: "Linton Lemos Barrett",
      countries: "GB",
      countries_fingerprint: "B4043B0B8297E379BC559AB33B6AE9C7A9B4EF6519D3BAEE53270F0C0DD3D960",
      original_authors: "Erico Verissimo",
      original_title: "O tempo e o vento",
      publishers: "Arco Publications",
      publishers_fingerprint: "DD6D4A5F8B8C4DD9BB9E5AD5634BB98CC3568E943729417FD69846D75C07B802",
      title: "Time and the Wind",
      year: 1954
    },
    %FlatPublication{
      authors: "Linton Lemos Barrett",
      countries: "GB",
      countries_fingerprint: "B4043B0B8297E379BC559AB33B6AE9C7A9B4EF6519D3BAEE53270F0C0DD3D960",
      original_authors: "Erico Verissimo",
      original_title: "Noite",
      publishers: "Arco Publications",
      publishers_fingerprint: "DD6D4A5F8B8C4DD9BB9E5AD5634BB98CC3568E943729417FD69846D75C07B802",
      title: "Night",
      year: 1956
    },
    %FlatPublication{
      authors: "Linton Lemos Barrett",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Erico Verissimo",
      original_title: "O tempo e o vento",
      publishers: "Macmillan",
      publishers_fingerprint: "873D23F97EEB8B04973339EC8A202DC8AEC0B33298D2E194301E223ECD7E9C05",
      title: "Time and the Wind",
      year: 1951
    },
    %FlatPublication{
      authors: "Linton Lemos Barrett",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Erico Verissimo",
      original_title: "Noite",
      publishers: "Macmillan",
      publishers_fingerprint: "873D23F97EEB8B04973339EC8A202DC8AEC0B33298D2E194301E223ECD7E9C05",
      title: "Night",
      year: 1956
    },
    %FlatPublication{
      authors: "Linton Lemos Barrett, Marie Barrett",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Erico Verissimo",
      original_title: "O senhor embaixador",
      publishers: "Macmillan",
      publishers_fingerprint: "873D23F97EEB8B04973339EC8A202DC8AEC0B33298D2E194301E223ECD7E9C05",
      title: "His Excellency, the Ambassador",
      year: 1967
    },
    %FlatPublication{
      authors: "Margaret Richardson Hollingsworth",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Mário de Andrade",
      original_title: "Amar verbo intransitivo",
      publishers: "MacCaulay",
      publishers_fingerprint: "A092A747DE2B957ADC822F5FEE63B2078F4CEE237438789BBF9A6D10F9F104E1",
      title: "Fraulein",
      year: 1933
    },
    %FlatPublication{
      authors: "Thomas Colchie",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Graciliano Ramos",
      original_title: "Memórias do cárcere",
      publishers: "Evans",
      publishers_fingerprint: "8658EBF1EDF525094102102EB55229187C236F9147950C775273B2D33AF516F0",
      title: "Jail Prison Memoirs",
      year: 1974
    },
    %FlatPublication{
      authors: "William L. Grossman",
      countries: "GB",
      countries_fingerprint: "B4043B0B8297E379BC559AB33B6AE9C7A9B4EF6519D3BAEE53270F0C0DD3D960",
      original_authors: "Machado de Assis",
      original_title: "Memórias póstumas de Brás Cubas",
      publishers: "W.H. Allen",
      publishers_fingerprint: "0AE69A42F21F227103D46FF569A689AC1A139BD3F036C74DEA48E8C86FF93326",
      title: "Epitaph of a Small Winner",
      year: 1953
    },
    %FlatPublication{
      authors: "William L. Grossman",
      countries: "US",
      countries_fingerprint: "9B202ECBC6D45C6D8901D989A918878397A3EB9D00E8F48022FC051B19D21A1D",
      original_authors: "Machado de Assis",
      original_title: "Memórias póstumas de Brás Cubas",
      publishers: "Noonday Press",
      publishers_fingerprint: "3444E1379BFB654A280E4E86B4BD0916534828F1AA529FFB8714D315E203F166",
      title: "Epitaph of a Small Winner",
      year: 1952
    }
  ]

  setup(_context) do
    @publications
    |> Publication.Codec.nest()
    |> Enum.map(&Publication.insert/1)

    []
  end

  defp assert_publication_fields(publication, expected_fields) do
    Enum.each(
      Map.keys(publication),
      fn key ->
        assert key in expected_fields,
               """
               Expected publication

               #{inspect(publication, pretty: true)}

               to only contain fields #{inspect(expected_fields)}

               field #{key} found.
               """
      end
    )
  end

  defp assert_search_results(publications, expect: expected_values) do
    assert_search_results(publications, expect: expected_values, fields: [])
  end

  defp assert_search_results(publications, expect: expected_values, fields: expected_fields)
       when is_list(publications) and is_list(expected_values) do
    unless Keyword.keyword?(expected_values) do
      throw(
        "Expected values must be defined as a keyword with attribute as key and expected values as value"
      )
    end

    refute Enum.empty?(publications), "Expected publications not to be empty."

    unless Enum.empty?(expected_fields) do
      Enum.each(publications, &assert_publication_fields(&1, expected_fields))
    end

    Enum.each(publications, fn p ->
      assert Enum.any?(expected_values, fn {key, value} ->
               String.contains?(inspect(Map.fetch(p, key)), value)
             end),
             """
             Expected publication

             #{inspect(p, pretty: true)}

             to meet one of the following conditions:

             #{Enum.map_join(expected_values, "", fn
               {key, [v]} -> """
                 #{key} contains #{inspect(v, pretty: true)}
                 """
               {key, v} when is_list(v) -> """
                 #{key} contains one of #{inspect(v, pretty: true)}
                 """
               {key, v} -> """
                 #{key} contains #{inspect(v, pretty: true)}
                 """
             end)}
             """
    end)
  end

  defp select_attrs(publication, attributes) when is_map(publication) do
    Enum.filter(publication, fn {k, _} -> k in attributes end) |> Map.new()
  end

  defp select_attrs(publications, attributes) when is_list(publications) do
    Enum.map(publications, &select_attrs(&1, attributes))
  end

  describe "all/0" do
    test "returns all publications flattened" do
      {:ok, output} = Publication.Index.all()

      # Fingerprint values are covered by the fingerprint/composite-key tests, and
      # references by the codec/controller round-trip tests; this test is about the
      # flattened representation, so normalise them. (The seeds carry no references,
      # so every row flattens to an empty list.)
      strip =
        &%{
          &1
          | __meta__: nil,
            id: nil,
            references: [],
            countries_fingerprint: nil,
            publishers_fingerprint: nil,
            translated_book_fingerprint: nil
        }

      actual = output |> Enum.map(strip) |> Enum.sort()
      expected = @publications |> Enum.map(strip) |> Enum.sort()

      assert expected == actual
    end
  end

  describe "all/1" do
    test "retrieves a subset of all publications attributes" do
      attributes = [:title, :original_title, :authors]

      {:ok, actual} = Publication.Index.all(select: attributes)

      expected =
        Publication.all()
        |> Publication.preload()
        |> Publication.Codec.flatten()
        |> Util.stringify_keys()
        |> select_attrs(Enum.map(attributes, &Atom.to_string/1))

      assert Enum.sort(Util.stringify_keys(actual)) == Enum.sort(expected)
    end
  end

  describe "search/1 with a single-word term present in the dataset" do
    test "retrieves publications by original author" do
      term = "Verissimo"
      keyword = String.downcase(term)
      expected_original_authors = ["Erico Verissimo", "Luis Fernando Verissimo"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          original_authors: expected_original_authors
        ]
      )
    end

    test "retrieves publications by title" do
      term = "Night"
      keyword = String.downcase(term)
      expected_titles = ["Night"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          title: expected_titles
        ]
      )
    end

    test "retrieves publications by original title" do
      term = "Noite"
      keyword = String.downcase(term)
      expected_original_titles = ["Noite"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          original_title: expected_original_titles
        ]
      )
    end

    test "retrieves publications by country" do
      term = "GB"
      keyword = String.downcase(term)
      expected_countries = ["GB"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          countries: expected_countries
        ]
      )
    end

    test "retrieves publications by author" do
      term = "Brakel"
      keyword = String.downcase(term)
      expected_authors = ["Arthur Brakel"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          authors: expected_authors
        ]
      )
    end

    test "retrieves publications by publisher" do
      term = "Macmillan"
      keyword = String.downcase(term)
      expected_publishers = ["Macmillan"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          publishers: expected_publishers
        ]
      )
    end

    test "retrieves publications by year" do
      term = "1956"
      keyword = String.downcase(term)
      expected_years = ["1956"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          year: expected_years
        ]
      )
    end

    test "retrieves no publications and no keywords for inexistent term" do
      term = "Blablabla"

      assert {:ok, [], []} == Publication.Index.search(term)
    end
  end

  describe "search/1 with a single-word term not present in the dataset" do
    test "prioritizes words that start with the term" do
      term = "veri"

      assert {:ok, publications, ["verissimo"]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          original_authors: ["Erico Verissimo", "Luis Fernando Verissimo"]
        ]
      )
    end

    test "does a fuzzy search when there's no words start with the term" do
      term = "vera"

      assert {:ok, publications, ["verbo"]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          original_title: ["Amar verbo intransitivo"]
        ]
      )
    end
  end

  describe "search/1 with a single-word term that matches several fields" do
    test "does a prefix search" do
      term = "Mari"

      assert {:ok, publications, ["marie", "marias"]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          title: "The Three Marias",
          authors: "Marie Barrett",
          original_title: "As três Marias"
        ]
      )
    end

    test "does a fuzzy search" do
      term = "Maries"

      assert {:ok, publications, ["marie", "marias"]} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          title: "The Three Marias",
          authors: "Marie Barrett",
          original_title: "As três Marias"
        ]
      )
    end
  end

  describe "search/1 with a composite term present in the dataset" do
    test "retrieves publications matching any of the words" do
      term = "Marie Barrett"
      split_term = String.split(term, " ")
      keywords = Enum.map(split_term, &String.downcase/1)

      assert {:ok, publications, ^keywords} = Publication.Index.search(term)

      assert_search_results(
        publications,
        expect: [
          authors: ["Linton Lemos Barrett", "Marie Barrett"]
        ]
      )
    end
  end

  describe "search/2 with a single-word term present in the dataset" do
    test "retrieves a subset of all publications attributes, by original author" do
      term = "Verissimo"
      keyword = String.downcase(term)
      attributes = [:title, :original_title, :original_authors, :authors]
      expected_original_authors = ["Erico Verissimo", "Luis Fernando Verissimo"]

      assert {:ok, publications, [^keyword]} = Publication.Index.search(term, select: attributes)

      assert_search_results(
        publications,
        expect: [
          original_authors: expected_original_authors
        ],
        fields: attributes
      )
    end
  end
end

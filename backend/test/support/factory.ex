defmodule RichardBurton.Factory do
  alias RichardBurton.{
    FlatPublication,
    Publication
  }

  def build(:flat_publication) do
    %FlatPublication{
      title: Faker.Lorem.sentence(),
      year: Faker.Date.date_of_birth().year,
      countries: Faker.Address.country_code(),
      publishers: Faker.Person.name(),
      authors: Faker.Person.name(),
      original_authors: Faker.Person.name(),
      original_title: Faker.Lorem.sentence()
    }
  end

  def build(schema, attrs) do
    build(schema) |> Map.merge(attrs)
  end

  def build_attrs(schema) do
    build(schema)
    |> Map.from_struct()
    |> Map.delete(:__meta__)
  end

  def create(value) when not is_list(value),
    do: create([value]) |> hd()

  def create([]), do: []

  def create([%FlatPublication{} | _] = entries) do
    entries
    |> Publication.Codec.nest()
    |> Publication.insert_all()
    |> elem(1)
  end
end

defmodule RichardBurton.Repo.Migrations.CheckCompositeKeysInOneCall do
  use Ecto.Migration

  @moduledoc """
  Defines `rb_settle`, which checks the deferred composite keys in one call.

  It runs `SET CONSTRAINTS ALL IMMEDIATE`, which checks every key that the
  transaction's writes have left unchecked, and then defers the keys again. It
  returns null when no two rows share a key, and otherwise the name of the
  constraint that a row breaks.

  The checks run in a block with an exception handler. When a check fails,
  Postgres rolls back that block alone, so the transaction that called the
  function can still run queries.
  """

  def up do
    execute("""
    CREATE FUNCTION rb_settle() RETURNS text
    LANGUAGE plpgsql
    AS $$
    DECLARE
      broken text;
    BEGIN
      SET CONSTRAINTS ALL IMMEDIATE;
      SET CONSTRAINTS ALL DEFERRED;
      RETURN NULL;
    EXCEPTION WHEN unique_violation OR exclusion_violation THEN
      GET STACKED DIAGNOSTICS broken = CONSTRAINT_NAME;
      RETURN broken;
    END
    $$
    """)
  end

  def down do
    execute("DROP FUNCTION rb_settle()")
  end
end

# CLAUDE.md

Guidance for AI agents working in this repository.

## Git operations

Do not run git operations that change state — `commit`, `push`, `rebase`, `merge`, tag, opening a PR, etc. — on your own. Prepare the work (edits, and commit messages or PR text when asked) and let the user run these, unless they explicitly ask you to. Read-only inspection (`status`, `log`, `diff`) is fine.

Creating a branch (`git switch -c`, `git branch`) is allowed, and preferred before starting a new piece of work.

## Commit messages

Keep them brief and conceptual: describe the change at the level of intent, not a file-by-file account. Write each paragraph as a single line (no hard wrapping), with a blank line between paragraphs. Use the imperative mood in the subject.

Write plainly and technically. Name the mechanism — the package, file, option or operation — rather than reaching for metaphor. "Conceptual" means intent-level rather than file-by-file; it does not license figurative prose. Write "Rename references to sources", not "Call them sources".

Do not add `Co-Authored-By` trailers (or any other tool/agent attribution).

## Pull requests

Keep the title and description brief and conceptual: say what the change delivers and why. Call out an implementation detail when it is novel or surprising enough that the change is hard to follow without it, but leave the rest to the code, which will be read. Write the description in markdown, each paragraph on a single line (no hard wrapping) with a blank line between paragraphs.

## Running the app

Always run the app natively (frontend via `npm run dev`, backend via `mix phx.server`, against the local Postgres). Do not use Docker.

## Frontend styling

Drive conditional styling through `data-*` attributes and Tailwind variants, not by interpolating computed class names into `className`. Put a `data-*` attribute that names the state on the element — deriving a small semantic token when the state is computed (e.g. `data-icon-offset="hang"`) — and express each visual rule as a static variant class (`data-[state=x]:…`, or `group-data-[state=x]:…` to react to an ancestor). Keep `className` a static, greppable list of classes; avoid ternaries that pick Tailwind classes. This matches the existing `Button` pattern (`data-variant`, `data-width`, `data-alignment`, …).

Do not use early returns in components; express branches as ternaries in the returned markup. Prefer declarative CSS — `calc`, transitions, container queries — over hand-rolled JavaScript layout or DOM measurement.

Note: stacked `group-data-*` variants read as *nested* groups, not several attributes on one element, so they can't AND multiple conditions on the same ancestor — collapse multi-condition state into a single token attribute instead.

## Review feedback

Address feedback with **new commits**. Do not amend the commit under review, and do not rebase to fold the fix into it: a changed SHA orphans the threads anchored to it, and the reviewer loses the trail between what they asked for and what changed. Give the fix a message that says what it does, not "address review comments".

## Code comments

Code should be self-documenting; reach for a name, a smaller function or a type before reaching for a comment. Where a comment is warranted, it states **intention** — what this is for, or why it is this way when that is not evident from the code itself.

A comment must make sense to someone reading the file cold, a year from now, who knows nothing about how it was written. That rules out:

- **History** — what the code used to do, what a change fixed, what "no longer" happens. That is what git is for.
- **QA narrative** — the bug that prompted it, how it was reproduced, what a test caught.
- **Defensive justification** — arguing with an imagined reviewer, or with a rule in this file.
- **Restating the code** — a comment that says what the next line plainly says.
- **Teaching the stack** — "a server component", "this is a hook", "an async component runs on the server". The reader knows the framework; the file already says which it is. Explain the *decision*, if there is one to explain, and only where it is not obvious.

Write "only the open modal answers Escape", not "this used to fire on closed modals too, which put the parameter back". The same applies to docstrings, story descriptions and test comments: say what the behaviour *is*, or what property a test protects — not the incident that led to it.

Use the same plain, technical register as commit messages. Name what a function takes and returns, which column a query filters, what a value parses into. Write "Splits one alternative's tokens into the operators and the free words", not "What a reader typed, read as a question".

Write **ordinary explanatory sentences**. The failure here is not jargon, it is compression: prose squeezed until the reader has to unpack it.

- Full sentences with explicit subjects. "Returns nil when there is nothing to ask", not "Nothing to ask is nil".
- No inverted or aphoristic constructions. "A search result tells you which publications matched, but not what in them matched", not "A row says which publication matched, not what in it did".
- Let a sentence finish before qualifying it. "…or the words it resembles if it is a prefix of none", not "…or — if it is a prefix of none — the words it resembles".
- An em-dash is not a full stop. It is fine leading a definition list, and fine for a short trailing appositive; it is not a general-purpose joiner. Mid-sentence, the fix is usually a full stop or a comma.

**Backend docs describe what a row, a query or a response holds — never what happens to it afterwards.** Not "Postgres does the highlighting rather than the browser" but "The highlighting is produced by the same query that decides the match": the reason has to stand on what the database knows. Avoid screen verbs — *is told*, *is shown to*, *sent for the reader to see*, *so a page can…*. `reader` is fine for the person searching, and `page` is fine for pagination; what is not fine is describing what that person sees. Grepping a diff for `browser|client|screen|display|is told|shown to` catches most of it.

## Documenting functions

Document **private functions too**, not only the public ones or the ones whose behaviour is surprising. In Elixir that is a `#` comment above the `defp` — an `@doc` there is discarded. The bar is whether a reader could state the function's contract without reading its body; a name alone rarely carries it. This does not license restating the next line: say what it takes and what it returns, and why when that is not evident.

**Open with what the function does, not why it exists.** Rationale is welcome, but after, in its own paragraph, and only where a reader could not infer it. The recurring fault is starting from the situation instead of the return value:

| Opens with why | Opens with what |
|---|---|
| "The total is counted from the same rows the index lists, so it lags behind writes" | "The number of publications in the index." |
| "The database returns rows in whatever order it likes, but the caller asked for a specific one" | "Puts rows into the order the given ids are in…" |
| "Nothing to search for matches nothing rather than everything, so an alternative…" | "Combines predicates with AND." — then why the empty case is `false` |

Two checks that catch the same mistake from other angles:

- **The comment describes the function it sits above.** When the *why* runs long it usually belongs on the callee, where the decision is made, not on the caller that loops over it.
- **Name the output, not the input.** "The free words, meaning the ones not attached to an operator" describes the argument; "The widenings among the free words" describes what comes back.

## Coined vocabulary

When a feature gives an ordinary word a specific meaning, define it in the module doc where a reader meets it, and say what separates near-synonyms. *An operator is what the reader types; a filter is what the query is built from.*

Words that surface as atoms or tags the code matches on need this most, since they are first met in a function head with no explanation — `:spelled_out`, `:prefix` and `:fuzzy` in `Publication.Index`; *winner*, *losers*, *absorbed* and *tombstone* in `Publication`; *cluster*, *distinction* and *ruled apart* in `Publication.Duplicates`.

## Storybook completeness

Keep Storybook coverage complete: every component ships **both** a `*.stories.tsx` (stories for its meaningful states, with play/interaction tests where behavior warrants) **and** a `*.mdx` doc (`<Meta of={…} />`, a short description, props/usage, and a `<Canvas>` of the key states). When you add or change a component, add or update both — a component without a story, or a story without its doc, is incomplete.

## E2E coverage

Keep the Playwright suite (`frontend/e2e/`) **exhaustive**: every user-facing feature ships with an E2E journey, and tests favor **complex, realistic scenarios** over minimal ones — seed a corpus (several publications, mixed references) rather than a single row, exercise bulk flows (multi-row workspace insert, duplicate/delete, CSV import/export with references) rather than the smallest path, and assert cross-feature consequences (e.g. after an edit, the index, the detail modal, *and* the backfill queue all agree). Tests drive the real UI only — no API calls to set up or assert state (the per-test database reset is the one exception). When you add or change a feature, extend the E2E suite in the same change.

## Deploying to IFRS

Deployment is a subtree split, not a mirror. `.github/workflows/deploy-to-ifrs.yml` runs on every push to `main`: it splits `frontend/` and `backend/` into their own histories, squashes each onto the GitLab repo's `stage` as one "Release to Stage" commit, and force-pushes that to `stage-release`. Someone then merges the `stage-release` → `stage` merge request on GitLab. The three repos live at `gitlab.com/ifrscanoas/richard-burton/{frontend,backend,deploy}`; clone them beside this one if you need them (they are gitignored).

The release **preserves** the GitLab side's `Dockerfile`, `.dockerignore`, `.gitignore`, `.gitlab-ci.yml` and `.ci/` — it restores them out of the staged tree, so nothing in this repo can change them. The images that actually deploy are `.ci/stage/Dockerfile` and `.ci/prod/Dockerfile`, which exist only in the GitLab repos, and each repo also keeps a root `Dockerfile`; all three need the same edit. `.tool-versions` is *not* preserved, so a toolchain bump here lands on GitLab against unchanged images — bump the images in the same release, on the `stage-release` branch so the change joins the open merge request.

Runtime configuration lives in the `deploy` repo (`stage/docker-compose.yml`, `production/docker-compose.yml`), not here. A new environment variable is not deployed until it is added there: check both files whenever a change reads one, and remember that `stage/docker-compose-template.yml` is a template that can drift from the live file.

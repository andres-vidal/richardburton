# CLAUDE.md

Guidance for AI agents working in this repository.

## Git operations

Never run a git operation that changes state on your own — `commit`, `push`, `rebase`, `merge`, `tag`, opening a PR. Prepare the work and let the user run them, unless they ask you to. Read-only inspection is always fine.

Creating a branch is allowed, and preferred before starting a new piece of work.

## Review feedback

Address feedback with new commits. Never amend the commit under review or rebase to fold the fix into it: a changed SHA orphans the threads anchored to it. Give the fix a message saying what it does, not "address review comments".

## Running the app

Run the app natively — frontend via `npm run dev`, backend via `mix phx.server`, against the local Postgres. Do not use Docker.

## Commit messages

Describe the change at the level of intent, not file by file. Use the imperative mood in the subject. Write each paragraph on a single line, with a blank line between paragraphs.

Name the mechanism — the package, file, option or operation — rather than reaching for metaphor. "Conceptual" means intent-level; it does not license figurative prose.

Never add `Co-Authored-By` trailers or any other tool attribution.

## Pull requests

Say what the change delivers and why. Call out an implementation detail when it is novel or surprising enough that the change is hard to follow without it, and leave the rest to the code. Use the same one-line-per-paragraph markdown as commit messages.

## Documentation

This covers comments, docstrings, module docs, story descriptions and test comments alike.

**Open with what the thing does, not why it exists.** Rationale comes after, in its own paragraph, and only where a reader could not infer it. Write "Returns the rows the filter matched.", not "Filtering happens before pagination, so the count can lag." Document private functions too — in Elixir a `#` comment above the `defp`, since an `@doc` there is discarded. The bar is whether a reader could state the contract without reading the body.

**Write for someone reading the file cold, a year from now.** That rules out history (what the code used to do, what a change fixed), QA narrative (the bug that prompted it, what a test caught), defensive justification (arguing with an imagined reviewer or with this file), restating the next line, and teaching the stack ("this is a hook"). Say what the behaviour *is*, or what property a test protects.

**Write ordinary explanatory sentences.** The failure is not jargon, it is compression — prose squeezed until the reader has to unpack it.

- Full sentences with explicit subjects. "Returns nil when the list is empty", not "An empty list is nil".
- No inverted or aphoristic constructions. "The parser reports which tokens it found, but not where each came from", not "Tokens are reported; their origins are not".
- Let a sentence finish before qualifying it. Put the condition after the thing it qualifies, rather than interrupting a clause with it.
- An em-dash is not a full stop. It is fine leading a definition list or a short trailing appositive, not as a general-purpose joiner. Mid-sentence, the fix is usually a full stop or a comma.

**Keep the client out of backend docs.** Describe what a row, a query or a response holds, never what happens to it afterwards, and never name the browser as the alternative. Avoid screen verbs — *is told*, *is shown to*, *so a page can…*. Grep a diff for `browser|client|screen|display|shown to` before calling a doc pass done.

**Define coined vocabulary in the module doc** where a reader first meets it, and say what separates near-synonyms. Words that surface as atoms the code matches on need this most, since they are first met in a function head with no explanation.

## Frontend styling

Drive conditional styling through `data-*` attributes and Tailwind variants, not by interpolating computed class names into `className`. Put a `data-*` attribute naming the state on the element, deriving a small semantic token when the state is computed, and express each visual rule as a static variant class (`data-[state=x]:…`, or `group-data-[state=x]:…` to react to an ancestor). Keep `className` a static, greppable list. This matches the existing `Button` pattern.

Stacked `group-data-*` variants read as *nested* groups, not several attributes on one element, so they cannot AND multiple conditions on the same ancestor — collapse multi-condition state into a single token attribute.

Do not use early returns in components; express branches as ternaries in the returned markup. Prefer declarative CSS — `calc`, transitions, container queries — over hand-rolled JavaScript layout or DOM measurement.

## Storybook completeness

Every component ships both a `*.stories.tsx` covering its meaningful states, with play tests where behaviour warrants, and a `*.mdx` doc with `<Meta of={…} />`, a short description, props and a `<Canvas>` of the key states. When you add or change a component, update both.

## E2E coverage

Keep the Playwright suite (`frontend/e2e/`) exhaustive: every user-facing feature ships with a journey, and tests favour complex, realistic scenarios over minimal ones. Seed a corpus rather than a single row, exercise bulk flows rather than the shortest path, and assert cross-feature consequences. Tests drive the real UI only — no API calls to set up or assert state, the per-test database reset excepted. Extend the suite in the same change as the feature.

## Deploying to IFRS

Deployment is a subtree split, not a mirror. `.github/workflows/deploy-to-ifrs.yml` runs on every push to `main`: it splits `frontend/` and `backend/` into their own histories, squashes each onto the GitLab repo's `stage` as one "Release to Stage" commit, and force-pushes to `stage-release`. Someone then merges `stage-release` → `stage` on GitLab. The three repos live at `gitlab.com/ifrscanoas/richard-burton/{frontend,backend,deploy}`.

The release preserves the GitLab side's `Dockerfile`, `.dockerignore`, `.gitignore`, `.gitlab-ci.yml` and `.ci/`, restoring them out of the staged tree, so nothing here can change them. The images that actually deploy are `.ci/stage/Dockerfile` and `.ci/prod/Dockerfile`, which exist only on GitLab, and each repo also keeps a root `Dockerfile`; all three need the same edit. `.tool-versions` is *not* preserved, so a toolchain bump here lands against unchanged images — bump them in the same release, on `stage-release` so the change joins the open merge request.

Runtime configuration lives in the `deploy` repo (`stage/docker-compose.yml`, `production/docker-compose.yml`), not here. A new environment variable is not deployed until it is added there. Note that `stage/docker-compose-template.yml` is a template that can drift from the live file.

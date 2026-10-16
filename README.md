# RichardBurton

This app is a repository that mantains data of English translations of brazilian literature books.

Access backend app docs [here](https://wyeworks.github.io/richardburton)

# Domain

`Original book` represent a Brazilian literature book

- has one `title`
- has many `authors`
- is identified by its `title` and its `authors`

`Translated book` represents an English translation of `Original book`

- has one `original book`
- has many `authors`
- has many `publications` (the same publication, republished)
- is identified by its `authors` and its `original book`

`Publication` is a single publication of a translated book

- has one `title`
- has one `country`
- has one `year`
- has one `publisher`
- is identified by all of its fields

`Author` is the author of a book, be it original or translated

- has one `name`
- is identified by its `name`

# Auth

## Authentication

Authentication is currently implemented using Google as identity provider. The OAuth2 flow is implemented in the frontend server using [NextAuth](https://next-auth.js.org/). To integrate with your environment, you should follow these steps:

1. create a new project in the [Google Cloud Console](https://console.cloud.google.com/apis/dashboard);
2. configure the [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) in order to generate the credentials;
3. create new [OAuth2 credentials](https://console.cloud.google.com/apis/credentials), ideally one per environment, setting the site's canonical URL as allowed JavaScript origin and the `/api/auth/callback/google` api path as allowed redirect URI;
4. and generate OAuth2 credentials through the [credentials dashboard](https://console.cloud.google.com/apis/credentials). You will need to configure the OAuth consent screen in order to generate the credentials. This will generate a brand new Google OAuth2 Client whose Client ID and Secret must be passed to the app via [environment variables](#environment-variables).

Authentication is achieved with JSON Web Tokens (JWT). An id token is retrieved and stored on sign in by the frontend server using Google's OAuth2 flow. The whole authentication flow is performed by the frontend server, which forwards the access token to the browser so it can do further client-side requests. The access token is sent to the backend server on each request via authorization header for verification.

The id token is verified in the backend server checking its issuer (that can be retrieved from [Google's well-known OpenId Configuration](https://accounts.google.com/.well-known/openid-configuration)); its audience (the configured Google OAuth2 client, identified by its id); and its cryptographic signature (using one of [Google's OAuth2 certificates](https://www.googleapis.com/oauth2/v2/certs) as public key).

The [OpenId configuration](https://accounts.google.com/.well-known/openid-configuration) and the [OAuth2 certificates](https://www.googleapis.com/oauth2/v2/certs)) are referred as auth configuration. This configuration is fetched and stored in the application's environment on the backend server's startup. Although is unlikely for these to change, a stale configuration situation can be solved by restarting the server.

## Authorization

Authorization is role-based, and the domain defines three user roles: `admin`, `contributor` and `reader`. Currently, `admin` is the only relevant role, being the only one allowed to sign into the app. Every endpoint is secured behind the authorization layer, except `GET /publications`. The only endpoint that does not require `admin` privileges is `POST /users`. However, it requires authentication, and will only allow to operate on the authenticated user ([see more](#user-creation)). Authorization is also performed in the frontend, as non-admin users to won't be able to procede with sign in once their role is verified.

## User creation

Users are created automatically on their sign in, with the `reader` role by default. Only `email`, `subject_id` and `role` are stored. The `subject_id` is an identifier provided by google and serves as the user's key: email addresses and their plus-sign aliases, like `example@gmail.com` and `example+richardburton@gmail.com` are linked to the same `subject_id` and won't trigger redudant user creation that could be exploited. The only way to change a user's role is through the database.

Users are retrieved during the sign in process for role verification in a "get or insert" fashion: a `POST /users` is issued once the id token is received from google. The expected outcome is a `201 CREATED` response with the user data (`email` and `role`) on the first sign in; and a `409 CONFLICT` response with the user data (`email` and `role`) if a user with the `subject_id` present in the id token already exists. Other responses will interrupt the sign in flow.

# Environment Variables

Environment variables are configuration units relevant to the app's build or runtime environment, rather than the code itself.

## Frontend

| Key                     | Description                                                                                                                                                                  | Recommended value for dev                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`   | URL of the backend server API                                                                                                                                                | `http://localhost:4000/api`                                                                                 |
|`NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITEKEY`| Sitekey from Google Recaptcha| Sign up for one in `http://www.google.com/recaptcha/admin`
| `NEXT_INTERNAL_API_URL` | URL of the backend server API. For use in a closed environment. Set to the same value of `NEXT_PUBLIC_API_URL` if Phoenix server public url is reachable from NextJS server. | `http://localhost:4000/api`                                                                                 |
| `APP_URL`               | The app's base URL — used to build the OAuth redirect URI (`$APP_URL/api/auth/callback/google`)                                                                              | `http://localhost:3000`                                                                                     |
| `NEXT_PORT`             | NextJS port                                                                                                                                                                  | `3000`                                                                                                      |
| `GOOGLE_CLIENT_ID`      | Google OAuth2 client id                                                                                                                                                      | Get from [google](https://console.cloud.google.com/apis/credentials), see [authentication](#authentication) |
| `GOOGLE_CLIENT_SECRET`  | Google OAuth2 client secret                                                                                                                                                  | Get from [google](https://console.cloud.google.com/apis/credentials), see [authentication](#authentication) |

## Backend

| Key                        | Description                                                                                                       | Recommended value for dev                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`         | Google OAuth2 client id                                                                                           | Get from [google](https://console.cloud.google.com/apis/credentials), see [authentication](#authentication) |
| `GOOGLE_OPENID_CONFIG_URL` | URL of Google's OpenId configuration                                                                              | `https://accounts.google.com/.well-known/openid-configuration`                                              |
| `GOOGLE_OAUTH2_CERTS_URL`  | URL of Google's OAuth2 certificates                                                                               | `https://www.googleapis.com/oauth2/v2/certs`                                                                |
| `PGUSER`                   | Postgres user                                                                                                     | `postgres`                                                                                                  |
| `PGPASSWORD`               | Postgres password                                                                                                 | `postgres`                                                                                                  |
| `PGDATABASE`               | Postgres database                                                                                                 | `richard_burton_dev`                                                                                        |
| `PGPORT`                   | Postgres port                                                                                                     | `3542`                                                                                                      |
| `PHX_HOST`                 | Phoenix host                                                                                                      | `localhost`                                                                                                 |
| `PHX_PORT`                 | Phoenix port                                                                                                      | `4000`                                                                                                      |
| `PHX_SECRET_KEY_BASE`      | Phoenix secret key base                                                                                           | Generate with `mix phx.gen.secret`                                                                          |
| `PHX_CONSUMER_URL`         | URL of the frontend api. This is used to configure CORS headers                                                   | `http://localhost:3000`                                                                                     |
| `POSTGREX_TIMEOUT`         | Timeout in milliseconds for database requests. Optional. Default is 15000. **Must be available in compile time.** | 15000                                                                                                       |
|`GOOGLE_RECAPTCHA_SECRET_KEY`| Sitekey from Google Recaptcha| Sign up for one in `http://www.google.com/recaptcha/admin`
|`GOOGLE_RECAPTCHA_VERIFICATION_URL`|URL to verify Google Recaptcha tokens |`https://www.google.com/recaptcha/api/siteverify`
|`SMTP_HOST`|SMTP relay host||
|`SMTP_PORT`|Port used to connect to the configured SMTP service|
|`SMTP_USER`|User to be used to send emails through the configured SMTP service||
|`SMTP_PASS`|Password of the user to be used to send emails through the configured SMTP service||
|`SMTP_FROM`|Default name to be used in behalf of the application||
|`SMTP_NAME`|Default name to be used in behalf of the application|`Richard & Isabel Burton`|
|`SMTP_TLS`|Wether TLS is used in the communication to the SMTP service. Can be `always`, `never` or `if_available`| `if_available`|
|`SMTP_ADMIN_INBOX`| Administrative inbox, for example, to receive "Contact Form" messages.|



# Development mode

## Docker

It's possible to run the development server using Docker, with fast reload enabled both in the frontend and in the backend server. You must have [Docker](https://www.docker.com/) installed for this to work. Environment variables, except secrets, are already set with recommended values in `docker.compose.dev.yml`. You must provide secret values in a `.env.development.local` file in the project's root with the following [environment variables](#environment-variables):

```Properties
GOOGLE_CLIENT_ID=value
GOOGLE_CLIENT_SECRET=value
GOOGLE_OPENID_CONFIG_URL=value
GOOGLE_OAUTH2_CERTS_URL=value
```

We recommend using `GNU Make` as command line tool for running the server without having to specify all the configuration flags in `docker compose up` command. Defined `make` targets for the development environments are:

| Command             | Description                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `make dev`          | Run the whole app (NextJS, Phoenix and Postgres) as separated containers in a docker project |
| `make dev_frontend` | Run the app's frontend (NextJS) as a docker container                                        |
| `make dev_backend`  | Run the apps's backend (Phoenix and Postgres) as containers in a docker project              |
| `make dev_phoenix`  | Run the Phoenix server as a docker container                                                 |

Once the Phoenix container is running, run database migrations with the following command:

```
docker exec richard-burton-dev-phoenix-1 mix ecto.migrate
```

## Manual

You must have Node, NPM, Erlang, Elixir installed and a Postgres database configured as specified in [`backend/config/dev.ex`](https://github.com/wyeworks/richardburton/blob/main/backend/config/dev.exs). We recommend using `asdf` to manage Elixir and Erlang versions, which are specified for this project in [`backend/.tool-versions`](https://github.com/wyeworks/richardburton/blob/main/backend/.tool-versions)

## To start the backend server:

- Configure secrets as described [below](#backend-secrets)
- Start your `postgres` database
- Navigate to the `backend` folder
- Install dependencies with `mix deps.get`
- Create and migrate your database with `mix ecto.setup`
- Start Phoenix endpoint with `mix phx.server` or inside IEx with `iex -S mix phx.server`

Now you can visit [`localhost:4000`](http://localhost:4000) from your browser.

### Backend secrets

To configure backend secrets in development, create `backend/config/dev.local.exs` and set the `google_*` and `smtp_*` settings in it. They are the [environment variables](#environment-variables) in lowercase, and an environment variable that is set takes precedence over its setting. The file is optional: without it the backend still runs, and the mail it sends stays on this machine, in the mailbox at `http://localhost:4000/dev/mailbox`. `phx_consumer_url` is already set in `config/dev.exs`, and `dev.local.exs` can override it.

The configuration file must follow this format:

```elixir
Import Config

config :richard_burton,
  google_cliente_id: "value",
  google_openid_config_url: "value",
  google_oauth2_certs_url: "value",
```

## To start the frontend server:

- Configure secrets as described [below](#frontend-secrets)
- Navigate to the `frontend` folder
- Set the environment variables in your `.env` or `.env.development` file:
- Install dependencies with `npm i`
- Start NextJS server with `npm run dev`

Now you can visit [`localhost:3000`](http://localhost:3000) from your browser.

### Frontend secrets

To configure frontend secrets in development mode, you should create a file named `.env.development.local` in the `frontend` folter and add the relevant configuration for `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. These variables are described in the [environment variables](#environment-variables) section. Other relevant variables for the frontend's development environment are predefined in `.env.development` and can be overridden by resetting them in `env.development.local`.

The configuration file must follow this format:

```properties
GOOGLE_CLIENT_ID=value
GOOGLE_CLIENT_SECRET=value
```

# Deployment

The app is intended to be deployed using [Docker](https://www.docker.com/). Configuration is included in the `docker-compose.prod.yml` at the project's root. All the [environment variables](#environment-variables) must be defined in a `.env.production.local` file in the project's root.

We recommend using `GNU Make` as command line tool for running the server without having to specify all the configuration flags in `docker compose up` command. Defined `make` targets for the development environments are:

| Command              | Description                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `make prod`          | Run the whole app (NextJS, Phoenix and Postgres) as separated containers in a docker project |
| `make prod_frontend` | Run the app's frontend (NextJS) as a docker container                                        |
| `make prod_backend`  | Run the apps's backend (Phoenix and Postgres) as containers in a docker project              |
| `make prod_phoenix`  | Run the Phoenix server as a docker container                                                 |

Once the Phoenix container is running, run database migrations with the following command:

```
docker exec richard-burton-prod-phoenix-1 bin/migrate
```

# Initializing the database

This app provides a mix task to initialize the database from a CSV file, `data.csv` placed on the project's root directory. This project should already include such file. Run the task with `mix rb.load_data`.

Each row of `data.csv` is one publication. The first line is a header that names the columns, so the columns can come in any order, and a column whose name is not listed below is ignored. The columns are:

| Column                        | Holds                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `title`                       | The publication's title                                                      |
| `year`                        | The year it was published                                                    |
| `countries` (or `country`)    | The countries it was published in, as ISO codes or names, separated by `;`   |
| `publishers` (or `publisher`) | Its publishers, separated by `;`                                             |
| `authors` (or `translators`)  | Its translators, separated by `;`                                            |
| `original_title`              | The title of the original book                                               |
| `original_authors`            | The authors of the original book, separated by `;`                           |
| `sources`                     | The sources it cites, one per line                                           |
| `notes` (or `note`)           | Notes about the publication, as plain text in which addresses become links   |

A cell that holds a comma, a quote or a line break is written inside double quotes. The CSV export writes the same columns, in the order of this table.

In `notes`, a blank line starts a new paragraph. The import makes a link of each word that starts with `http://`, `https://` or `www.`, and of each email address, and leaves the punctuation at the end of the word, such as the full stop that ends a sentence, out of the link. The CSV does not carry the rest of the notes' formatting: the export writes bold and italic text as plain text, each list item on its own line after `-` or its number, and a link as its text followed by its URL in parentheses, or as its text alone when that text is its URL or email address, and the import reads the rest of each paragraph as plain text.

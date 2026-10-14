import { request } from "app";
import { ApiError } from "modules/http";
import { httpError, networkError, stubHttp } from "test/http";

let http: ReturnType<typeof stubHttp>;

beforeEach(() => {
  http = stubHttp();
});

afterEach(() => vi.restoreAllMocks());

/** Returns what `request` throws when the stubbed GET rejects with `error`. */
async function thrownFor(error: unknown): Promise<unknown> {
  http.get.mockRejectedValue(error);

  return request((client) => client.get("publications")).catch(
    (thrown: unknown) => thrown,
  );
}

describe("request", () => {
  test("returns what the callback returns", async () => {
    http.get.mockResolvedValue({ data: ["Iracema"] });

    const data = await request(async (client) => {
      const { data } = await client.get("publications");
      return data;
    });

    expect(data).toEqual(["Iracema"]);
  });

  test("throws an ApiError with the status and the reason a refusal gives", async () => {
    const thrown = await thrownFor(httpError(409, { error: "last_admin" }));

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown).toMatchObject({
      status: 409,
      code: "last_admin",
      errors: undefined,
      body: { error: "last_admin" },
      message: "last_admin",
    });
  });

  test("keeps the field errors of a 400", async () => {
    const body = { errors: { title: "required", year: "integer" } };

    const thrown = await thrownFor(httpError(400, body));

    expect(thrown).toMatchObject({
      status: 400,
      code: undefined,
      errors: { title: "required", year: "integer" },
      body,
    });
  });

  test("reads the code only from the error field of a body", async () => {
    const thrown = await thrownFor(httpError(400, "invalid_escape_sequence"));

    expect(thrown).toMatchObject({ status: 400, code: undefined });
  });

  test("finds no field errors in the body of a crash", async () => {
    const thrown = await thrownFor(
      httpError(500, { errors: { detail: "Internal Server Error" } }),
    );

    expect(thrown).toMatchObject({ status: 500, errors: undefined });
  });

  test("has no status when no response arrived", async () => {
    const thrown = await thrownFor(networkError());

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown).toMatchObject({
      status: undefined,
      code: undefined,
      message: "Network Error",
    });
  });

  test("rethrows an error that is not a failed request unchanged", async () => {
    const error = new TypeError("not a request");

    await expect(
      request(() => {
        throw error;
      }),
    ).rejects.toBe(error);
  });
});

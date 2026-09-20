import { renderHook } from "utils/testRender";
import { act } from "react-dom/test-utils";
import { z } from "zod";
import { useForm } from "./useForm";

describe("useForm", () => {
  test("returns input props for each value in the schema", () => {
    const Schema = z.object({
      foo: z.string(),
      bar: z.string(),
    });

    const hook = renderHook(() => useForm(Schema));

    expect(hook.result.current).toMatchObject({
      inputs: {
        foo: {
          value: undefined,
          error: undefined,
          onChange: expect.any(Function),
          onBlur: expect.any(Function),
        },

        bar: {
          value: undefined,
          error: undefined,
          onChange: expect.any(Function),
          onBlur: expect.any(Function),
        },
      },
    });
  });

  test("returns form props", () => {
    const Schema = z.object({
      foo: z.string(),
      bar: z.string(),
    });

    const hook = renderHook(() => useForm(Schema));

    expect(hook.result.current).toMatchObject({
      form: {
        onSubmit: expect.any(Function),
      },
    });
  });

  test("returns undefined error for invalid untouched inputs", () => {
    const Schema = z.object({
      foo: z.string().min(1, "Required"),
    });

    const hook = renderHook(() => useForm(Schema));

    expect(hook.result.current).toMatchObject({
      inputs: {
        foo: { error: undefined },
      },
    });
  });

  test("returns undefined error for invalid untouched inputs after blur", () => {
    const Schema = z.object({
      foo: z.string().min(1, "Required"),
    });

    const hook = renderHook(() => useForm(Schema));

    act(() => hook.result.current.inputs.foo.onBlur());

    expect(hook.result.current).toMatchObject({
      inputs: {
        foo: { error: undefined },
      },
    });
  });

  test("returns undefined error for invalid touched inputs after change", () => {
    const Schema = z.object({
      foo: z.string().min(1, "Required"),
    });

    const hook = renderHook(() => useForm(Schema));

    act(() => hook.result.current.inputs.foo.onChange(""));
    expect(hook.result.current).toMatchObject({
      inputs: {
        foo: { error: undefined },
      },
    });
  });

  test("returns error for invalid touched inputs after blur", () => {
    const Schema = z.object({
      foo: z.string().min(1, "Required"),
    });

    const hook = renderHook(() => useForm(Schema));

    act(() => hook.result.current.inputs.foo.onChange(""));
    act(() => hook.result.current.inputs.foo.onBlur());

    expect(hook.result.current).toMatchObject({
      inputs: {
        foo: { error: "Required" },
      },
    });
  });

  test("returns updated input value after change", () => {
    const Schema = z.object({
      foo: z.string().min(1, "Required"),
    });

    const hook = renderHook(() => useForm(Schema));

    act(() => hook.result.current.inputs.foo.onChange("bar"));

    expect(hook.result.current).toMatchObject({
      inputs: {
        foo: { value: "bar" },
      },
    });
  });

  // A schema says what it accepts; why it refuses is written once, here, so a
  // form carries no copy and every form refuses in the same words.
  describe("why it refuses", () => {
    function refusals(schema: Parameters<typeof useForm>[0], typed?: string) {
      const hook = renderHook(() => useForm(schema));

      if (typed !== undefined) {
        act(() => hook.result.current.inputs.foo.onChange(typed));
      }

      act(() =>
        hook.result.current.form.onSubmit({ preventDefault() {} } as never),
      );

      return hook.result.current.inputs;
    }

    test("a value left out is required", () => {
      const inputs = refusals(z.object({ foo: z.string().trim().min(1) }));

      expect(inputs.foo.error).toBe("Required");
    });

    test("a value emptied out is required too", () => {
      const inputs = refusals(z.object({ foo: z.string().trim().min(1) }), "");

      expect(inputs.foo.error).toBe("Required");
    });

    test("an address that is not one says so, not that it is missing", () => {
      const inputs = refusals(
        z.object({ foo: z.string().trim().email() }),
        "nope",
      );

      expect(inputs.foo.error).toBe("Enter a valid email address");
    });

    test("a refusal nothing is written for keeps the words zod gave it", () => {
      const inputs = refusals(z.object({ foo: z.string().min(8) }), "short");

      expect(inputs.foo.error).toMatch(/8/);
    });
  });

  test("inputs are disabled when form is disabled", () => {
    const Schema = z.object({
      foo: z.string().min(1, "Required"),
      bar: z.string().min(1, "Required"),
    });

    const hook = renderHook(() => useForm(Schema, { disabled: true }));

    expect(hook.result.current).toMatchObject({
      inputs: {
        foo: { disabled: true },
        bar: { disabled: true },
      },
    });
  });
});

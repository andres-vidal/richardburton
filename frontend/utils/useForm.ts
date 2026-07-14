import {
  Dispatch,
  FormEvent,
  FormEventHandler,
  SetStateAction,
  useState,
} from "react";
import { z } from "zod";

function stripDefaults<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
): [z.infer<T>, T] {
  const entries = Object.entries(schema.shape) as [string, z.ZodType][];

  const [defaults, s] = entries.reduce(
    ([d, s], [key, field]) => {
      if (field instanceof z.ZodDefault) {
        return [
          { ...d, [key]: field.parse(undefined) },
          { ...s, [key]: field.def.innerType },
        ];
      }
      return [d, { ...s, [key]: field }];
    },
    [{}, {}] as [Record<string, unknown>, z.ZodRawShape],
  );

  return [defaults as z.infer<T>, z.object(s) as unknown as T] as const;
}

interface ValidateOptions {
  all: boolean;
}

function validate<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  input: Partial<z.infer<T>>,
  { all }: ValidateOptions,
): [Partial<z.infer<T>>, Partial<Record<keyof z.infer<T>, string>>] {
  const parsed: Record<string, string> = {};
  const errors: Record<string, string> = {};

  const entries = Object.entries(schema.shape) as [string, z.ZodType][];

  for (const [key, field] of entries) {
    if (!all && !(key in input)) {
      continue;
    }

    const result = field.safeParse(input[key]);

    if (result.success) {
      parsed[key] = result.data as string;
    } else {
      parsed[key] = input[key] as string;
      errors[key] = result.error.issues[0].message;
    }
  }

  return [
    parsed as Partial<z.infer<T>>,
    errors as Partial<Record<keyof z.infer<T>, string>>,
  ];
}

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
}
interface Options<T> {
  disabled?: boolean;
  onSubmit?: (
    values: T,
    misc: {
      setErrors: Dispatch<SetStateAction<Partial<Record<keyof T, string>>>>;
    },
  ) => void;
}

export function useForm<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  options?: Options<z.infer<T>>,
): {
  inputs: Record<keyof z.infer<T>, InputProps>;
  form: { onSubmit: FormEventHandler };
} {
  const { onSubmit, disabled } = options ?? {};

  const [defaults, strict] = stripDefaults(schema);
  const [values, setValues] = useState<Partial<z.infer<T>>>({});
  const [errors, setErrors] = useState<
    Partial<Record<keyof z.infer<T>, string>>
  >({});

  const input = { ...defaults, ...values };

  function handleChange(key: keyof z.infer<T>) {
    return (value: string) => {
      setValues({ ...values, [key]: value });
    };
  }

  function handleBlur(key: keyof z.infer<T>) {
    return () => {
      const [, errors] = validate(strict, input, { all: false });
      setErrors((prev) => ({ ...prev, [key]: errors[key] }));
    };
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const result = schema.safeParse(input);

    if (!result.success) {
      const [, errors] = validate(strict, input, { all: true });
      setErrors(errors);
      return;
    }

    onSubmit?.(input, { setErrors });
  }

  const inputs = Object.entries(strict.shape).reduce(
    (acc, [key]) => ({
      ...acc,
      [key]: {
        disabled,
        value: input[key] ?? defaults[key],
        error: errors[key],
        onChange: handleChange(key),
        onBlur: handleBlur(key),
      },
    }),
    {} as Record<keyof z.infer<T>, InputProps>,
  );

  return { inputs, form: { onSubmit: handleSubmit } };
}

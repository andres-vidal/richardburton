"use client";

import { GOOGLE_RECAPTCHA_SITEKEY, request } from "app";
import { ApiError } from "modules/http";
import { useTranslations } from "next-intl";
import { FC, useRef, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { useForm } from "utils/useForm";
import { z } from "zod";
import AppLoader from "./AppLoader";
import { Article } from "./Article";
import Button from "./Button";
import { Modal, useURLQueryModal } from "./Modal";
import { notify } from "./Notifications";
import TextArea from "./TextArea";
import TextInput from "./TextInput";

const CONTACT_MODAL_KEY = "contact";

/** The fields of a contact message, and the values the form accepts in each. */
const CONTACT = z.object({
  name: z.string().trim().min(1),
  institution: z.string().optional(),
  address: z.string().trim().email(),
  subject: z.string().trim().min(1),
  message: z.string().trim().min(1),
});

type Contact = z.infer<typeof CONTACT>;

/**
 * What a contact message needs from the reCAPTCHA widget: a fresh token. It is
 * null when no reCAPTCHA site key is configured.
 */
type Captcha = Pick<ReCAPTCHA, "executeAsync"> | null;

/** Sends a contact message, with a token from `captcha`. */
type SendContact = (contact: Contact, captcha: Captcha) => Promise<void>;

/**
 * Sends `contact` to the contact endpoint with a reCAPTCHA token from
 * `captcha`, or without one when `captcha` is null.
 *
 * The request fails with an `ApiError`: a 400 whose `errors` hold a code per
 * invalid field, a 403 with the code `invalid_captcha` when the token is
 * refused, or a 502 with the code `unsent` when the mail could not be sent.
 */
const sendContact: SendContact = async (contact, captcha) => {
  const recaptchaToken = await captcha?.executeAsync();
  await request((http) => http.post("contact", { ...contact, recaptchaToken }));
};

/**
 * The key in the `validation` messages for each field error code the contact
 * endpoint returns. `invalid` is returned only for the address.
 */
const FIELD_ERRORS: Record<string, string> = {
  required: "required",
  invalid: "email",
};

/**
 * The contact form. It sends the message with `onSend`, notifies the reader
 * when it is sent, and closes the modal. It renders the invisible reCAPTCHA
 * widget only when a site key is configured.
 *
 * When the server refuses fields, the form shows each refusal at its field in
 * the words of the form's own validation. A refused reCAPTCHA check and any
 * other failure are notified, and the form keeps what was typed.
 */
const ContactForm: FC<{ onSend: SendContact }> = ({ onSend }) => {
  const t = useTranslations("contact");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const { close } = useURLQueryModal(CONTACT_MODAL_KEY);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const [loading, setLoading] = useState(false);

  const { inputs, form } = useForm(CONTACT, {
    disabled: loading,
    async onSubmit(values, { setErrors }) {
      setLoading(true);

      try {
        await onSend(values, recaptchaRef.current);
        notify({ level: "success", message: "contact.sent" });
        close();
      } catch (error) {
        if (error instanceof ApiError && error.errors) {
          const codes = error.errors as Partial<Record<keyof Contact, string>>;
          setErrors(
            Object.fromEntries(
              Object.entries(codes).map(([field, code]) => [
                field,
                code && code in FIELD_ERRORS
                  ? validation(FIELD_ERRORS[code])
                  : code,
              ]),
            ),
          );
        } else {
          notify({
            level: "error",
            message:
              error instanceof ApiError && error.code === "invalid_captcha"
                ? "contact.captchaFailed"
                : "contact.failed",
          });
        }
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <form className="relative py-4 space-y-5 text-sm sm:text-base" {...form}>
      <section className="space-y-6">
        <p>{t("senderIntroduction")}</p>
        <fieldset className="space-y-6">
          <TextInput label={t("name")} {...inputs.name} />
          <TextInput label={t("email")} {...inputs.address} />
          <TextInput label={t("institution")} {...inputs.institution} />
        </fieldset>
      </section>

      <section className="space-y-6">
        <p>{t("messageIntroduction")}</p>
        <fieldset className="space-y-6">
          <TextInput label={t("subject")} {...inputs.subject} />
          <TextArea label={t("message")} {...inputs.message} />
        </fieldset>
        <div>{t("thanks")}</div>
      </section>

      <footer className="flex gap-2 justify-end">
        {loading && <AppLoader />}
        <Button
          label={common("cancel")}
          variant="outline"
          onClick={close}
          disabled={loading}
        />
        <Button type="submit" label={t("send")} loading={loading} />
        {GOOGLE_RECAPTCHA_SITEKEY && (
          <ReCAPTCHA
            ref={recaptchaRef}
            size="invisible"
            sitekey={GOOGLE_RECAPTCHA_SITEKEY}
            hidden
          />
        )}
      </footer>
    </form>
  );
};

/**
 * A modal holding the contact form. It is open while the URL has a `contact`
 * query parameter, such as `?contact=true`. `onSend` sends a message, and
 * defaults to `sendContact`.
 */
const ContactModal: FC<{ onSend?: SendContact }> = ({
  onSend = sendContact,
}) => {
  const t = useTranslations("contact");
  const { isOpen, close } = useURLQueryModal(CONTACT_MODAL_KEY);

  return (
    <Modal isOpen={isOpen} onClose={close} label={t("label")}>
      <Article
        heading={t("heading")}
        content={<ContactForm onSend={onSend} />}
      />
    </Modal>
  );
};

export { CONTACT_MODAL_KEY, ContactModal };
export type { SendContact };

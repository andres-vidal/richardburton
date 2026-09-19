"use client";

import { GOOGLE_RECAPTCHA_SITEKEY, http } from "app";
import { isAxiosError } from "axios";
import { FC, useMemo, useRef, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { useForm } from "utils/useForm";
import { z } from "zod";
import AppLoader from "./AppLoader";
import { useTranslations } from "next-intl";
import { Article } from "./Article";
import Button from "./Button";
import { Modal, useURLQueryModal } from "./Modal";
import { useNotify } from "./Notifications";
import TextArea from "./TextArea";
import TextInput from "./TextInput";

const CONTACT_MODAL_KEY = "contact";

/** The form's shape, built where its messages can be read. */
const contactSchema = (required: string) =>
  z.object({
    name: z.string().trim().min(1, required),
    institution: z.string().optional(),
    address: z.string().trim().email().min(1, required),
    subject: z.string().trim().min(1, required),
    message: z.string().trim().min(1, required),
  });

const ContactForm: FC = () => {
  const t = useTranslations("contact");
  const { close } = useURLQueryModal(CONTACT_MODAL_KEY);
  const notify = useNotify();
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const [loading, setLoading] = useState(false);

  const Contact = useMemo(() => contactSchema(t("required")), [t]);
  const { inputs, form } = useForm(Contact, {
    disabled: loading,
    async onSubmit(values, { setErrors }) {
      setLoading(true);

      try {
        const recaptchaToken = await recaptchaRef.current!.executeAsync();
        await http.post("/contact", { ...values, recaptchaToken });
        notify({ level: "success", message: t("sent") });

        close();
      } catch (error) {
        if (
          isAxiosError(error) &&
          error.response &&
          error.response.status === 400 &&
          "issues" in error.response.data
        ) {
          setErrors(error.response.data.issues);
          return;
        }

        notify({ level: "error", message: t("failed") });
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

      <footer className="flex justify-end gap-2">
        {loading && <AppLoader />}
        <Button
          label={t("cancel")}
          variant="outline"
          onClick={close}
          disabled={loading}
        />
        <Button type="submit" label={t("send")} loading={loading} />
        <ReCAPTCHA
          ref={recaptchaRef}
          size="invisible"
          sitekey={GOOGLE_RECAPTCHA_SITEKEY}
          hidden
        />
      </footer>
    </form>
  );
};

const ContactModal: FC = () => {
  const t = useTranslations("contact");
  const { isOpen, close } = useURLQueryModal(CONTACT_MODAL_KEY);

  return (
    <Modal isOpen={isOpen} onClose={close} label={t("label")}>
      <Article heading={<div>{t("heading")}</div>} content={<ContactForm />} />
    </Modal>
  );
};

export { CONTACT_MODAL_KEY, ContactModal };

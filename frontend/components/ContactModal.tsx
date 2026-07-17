"use client";

import { GOOGLE_RECAPTCHA_SITEKEY, http } from "app";
import { isAxiosError } from "axios";
import { useTranslations } from "next-intl";
import { FC, useRef, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { useForm } from "utils/useForm";
import { z } from "zod";
import AppLoader from "./AppLoader";
import { Article } from "./Article";
import Button from "./Button";
import { Modal, useURLQueryModal } from "./Modal";
import { useNotify } from "./Notifications";
import TextArea from "./TextArea";
import TextInput from "./TextInput";

const CONTACT_MODAL_KEY = "contact";

type Contact = {
  name: string;
  institution?: string;
  address: string;
  subject: string;
  message: string;
};

const ContactForm: FC = () => {
  const t = useTranslations();
  const { close } = useURLQueryModal(CONTACT_MODAL_KEY);
  const notify = useNotify();
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const [loading, setLoading] = useState(false);

  const ContactSchema = z.object({
    name: z.string().trim().min(1, t("common.required")),
    institution: z.string().optional(),
    address: z.string().trim().email().min(1, t("common.required")),
    subject: z.string().trim().min(1, t("common.required")),
    message: z.string().trim().min(1, t("common.required")),
  });

  const { inputs, form } = useForm(ContactSchema, {
    disabled: loading,
    async onSubmit(values, { setErrors }) {
      setLoading(true);

      try {
        const recaptchaToken = await recaptchaRef.current!.executeAsync();

        await http.post("/contact", {
          ...values,
          recaptchaToken,
        });

        notify({
          level: "success",
          message: t("contact.success"),
        });

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

        notify({
          level: "error",
          message: t("contact.error"),
        });
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <form className="relative py-4 space-y-5 text-sm sm:text-base" {...form}>
      <section className="space-y-6">
        <p>{t("contact.senderIntroduction")}</p>

        <fieldset className="space-y-6">
          <TextInput label={t("contact.fields.name")} {...inputs.name} />

          <TextInput label={t("contact.fields.email")} {...inputs.address} />

          <TextInput
            label={t("contact.fields.institution")}
            {...inputs.institution}
          />
        </fieldset>
      </section>

      <section className="space-y-6">
        <p>{t("contact.messageIntroduction")}</p>

        <fieldset className="space-y-6">
          <TextInput
            label={t("contact.fields.subject")}
            {...inputs.subject}
          />

          <TextArea
            label={t("contact.fields.message")}
            {...inputs.message}
          />
        </fieldset>

        <div>{t("contact.thankYou")}</div>
      </section>

      <footer className="flex justify-end gap-2">
        {loading && <AppLoader />}

        <Button
          label={t("common.cancel")}
          variant="outline"
          onClick={close}
          disabled={loading}
        />

        <Button
          type="submit"
          label={t("common.send")}
          loading={loading}
        />

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
  const t = useTranslations();
  const { isOpen, close } = useURLQueryModal(CONTACT_MODAL_KEY);

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      label={t("contact.modalTitle")}
    >
      <Article
        heading={<div>{t("contact.heading")}</div>}
        content={<ContactForm />}
      />
    </Modal>
  );
};

export { CONTACT_MODAL_KEY, ContactModal };

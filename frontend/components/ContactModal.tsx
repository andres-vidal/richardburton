import { GOOGLE_RECAPTCHA_SITEKEY, http } from "app";
import { isAxiosError } from "axios";
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

const Contact = z.object({
  name: z.string().trim().min(1, "Required"),
  institution: z.string().optional(),
  address: z.string().trim().email().min(1, "Required"),
  subject: z.string().trim().min(1, "Required"),
  message: z.string().trim().min(1, "Required"),
});

type Contact = z.infer<typeof Contact>;

const SENDER_INTRODUCTION = `Please fill in your contact details to enable us to address your query promptly. Your full name and email address are essential for us to send you a response, and you can include your institution details as well (optional field though). We assure you that your details will be kept confidential and used solely for communication purposes only.`;
const MESSAGE_INTRODUCTION = `Provide a concise description of your purpose for reaching out. Whether you're interested in collaborating with our research, offering feedback on our data, or sharing insights about our web application, we invite you to outline your thoughts briefly. This initial communication is an important step for us to give you an effective reply and/or engaging in further discussions`;

const ContactForm: FC = () => {
  const { close } = useURLQueryModal(CONTACT_MODAL_KEY);
  const notify = useNotify();
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const [loading, setLoading] = useState(false);

  const { inputs, form } = useForm(Contact, {
    disabled: loading,
    async onSubmit(values, { setErrors }) {
      setLoading(true);

      try {
        const recaptchaToken = await recaptchaRef.current!.executeAsync();
        await http.post("/contact", { ...values, recaptchaToken });
        notify({ level: "success", message: "Your message has been sent!" });

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

        notify({ level: "error", message: "Something went wrong." });
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <form className="relative py-4 space-y-5 text-sm sm:text-base" {...form}>
      <section className="space-y-6">
        <p>{SENDER_INTRODUCTION}</p>
        <fieldset className="space-y-6">
          <TextInput label="Name" {...inputs.name} />
          <TextInput label="Email" {...inputs.address} />
          <TextInput label="Institution" {...inputs.institution} />
        </fieldset>
      </section>

      <section className="space-y-6">
        <p>{MESSAGE_INTRODUCTION}</p>
        <fieldset className="space-y-6">
          <TextInput label="Subject" {...inputs.subject} />
          <TextArea label="Write your message here..." {...inputs.message} />
        </fieldset>
        <div>Thank you for your contact!</div>
      </section>

      <footer className="flex justify-end gap-2">
        {loading && <AppLoader />}
        <Button
          label="Cancel"
          variant="outline"
          onClick={close}
          disabled={loading}
        />
        <Button type="submit" label="Send" loading={loading} />
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
  const { isOpen, close } = useURLQueryModal(CONTACT_MODAL_KEY);

  return (
    <Modal isOpen={isOpen} onClose={close}>
      <Article heading={<div>Contact Us</div>} content={<ContactForm />} />
    </Modal>
  );
};

export { CONTACT_MODAL_KEY, ContactModal };

"use client";

import ChevronDownIcon from "assets/chevron-down.svg";
import { ROLES, type UserRole } from "modules/users";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import Button from "./Button";
import MenuProvider from "./MenuProvider";

/**
 * Pick a role, from a list short enough and fixed enough that there is nothing
 * to search — which is why this is `MenuProvider` and not `Select`, whose whole
 * surface is a typeahead over options fetched per keystroke. It carries the
 * chevron the app's other menus carry, so it reads as one of them.
 *
 * The trigger owns whether the menu is open — `MenuProvider` handles the
 * listbox, keyboard navigation and dismissal, but not what opens it, so a
 * button says so itself.
 */
const RoleMenu: FC<{
  value: UserRole;
  /** Accessible name — several of these sit on a page, one per person. */
  label: string;
  disabled?: boolean;
  onChange: (role: UserRole) => void;
}> = ({ value, label, disabled, onChange }) => {
  const t = useTranslations("roles");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // An option carries the role as its id and its name as the label, so what is
  // picked stays the stored value while what is read is the name.
  const options = ROLES.map((role) => ({ id: role, label: t(role) }));

  return (
    <MenuProvider
      options={options}
      isOpen={isOpen}
      activeIndex={activeIndex}
      setIsOpen={setIsOpen}
      setActiveIndex={setActiveIndex}
      onSelect={({ id: role }) => {
        if (role !== value) onChange(role);
      }}
      bordered
    >
      <Button
        label={t(value)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        variant="outline"
        alignment="left"
        width="fixed"
        size="field"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        right={
          <ChevronDownIcon
            aria-hidden
            data-open={isOpen}
            className="ml-auto w-4 h-4 text-gray-400 transition-transform data-[open=true]:rotate-180"
          />
        }
      />
    </MenuProvider>
  );
};

export default RoleMenu;

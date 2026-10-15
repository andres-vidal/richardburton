"use client";

import ChevronDownIcon from "assets/chevron-down.svg";
import { ROLES, type UserRole } from "modules/users";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import Button from "./Button";
import MenuProvider from "./MenuProvider";

/**
 * A button showing the name of the role `value` that opens a menu of every
 * role, least privileged first. Picking a role other than `value` calls
 * `onChange` with it. Picking `value` again calls nothing.
 *
 * The roles are few and fixed, so the menu is a `MenuProvider` list with no
 * search, unlike `Select`. `MenuProvider` does not open the list, so the
 * button keeps the open state and toggles it on click.
 */
const RoleMenu: FC<{
  value: UserRole;
  /** The accessible name, which says whose role it is or what it is for. */
  label: string;
  disabled?: boolean;
  onChange: (role: UserRole) => void;
}> = ({ value, label, disabled, onChange }) => {
  const t = useTranslations("roles");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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

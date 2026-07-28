"use client";

import { ROLE_LABELS, ROLES, type UserRole } from "modules/users";
import { FC, useState } from "react";
import Button from "./Button";
import MenuProvider from "./MenuProvider";

// The option carries the role as its id and its name as the label, so what is
// picked stays the stored value while what is read is the name.
const OPTIONS = ROLES.map((role) => ({ id: role, label: ROLE_LABELS[role] }));

/**
 * Pick a role, in the app's own menu rather than the platform's select.
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
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <MenuProvider
      options={OPTIONS}
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
        label={ROLE_LABELS[value]}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        variant="outline"
        alignment="left"
        width="fixed"
        size="small"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
      />
    </MenuProvider>
  );
};

export default RoleMenu;

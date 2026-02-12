"use client";

import Notifications from "components/Notifications";
import ClearSelection from "listeners/ClearSelection";
import { Provider } from "jotai";
import { Publication } from "modules/publication";
import { FC, ReactNode } from "react";
import store from "store";

// Initialize the Jotai store with default publication data
Publication.STORE.initialize();

export const Providers: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <Provider store={store}>
      <Notifications />
      <ClearSelection />
      {children}
    </Provider>
  );
};

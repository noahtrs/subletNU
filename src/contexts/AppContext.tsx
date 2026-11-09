import { ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { SubletProvider } from "./SubletContext";
import { MessageProvider } from "./MessageContext";
import { FilterProvider } from "./FilterContext";

export const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <AuthProvider>
      <SubletProvider>
        <MessageProvider>
          <FilterProvider>
            {children}
          </FilterProvider>
        </MessageProvider>
      </SubletProvider>
    </AuthProvider>
  );
};

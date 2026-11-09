import { ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { SubletProvider } from "./SubletContext";
import { FilterProvider } from "./FilterContext";
import { TalkSession } from "@/components/TalkSession";

export const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <AuthProvider>
      <SubletProvider>
        <FilterProvider>
          <TalkSession>
            {children}
          </TalkSession>
        </FilterProvider>
      </SubletProvider>
    </AuthProvider>
  );
};

import { LanguageProvider } from "@/context/LanguageContext";
import React from "react";

type Props = {
  children: React.ReactNode;
};

const layout = ({ children }: Props) => {
  return (
    <div>
      <LanguageProvider>{children}</LanguageProvider>
    </div>
  );
};

export default layout;

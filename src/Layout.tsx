// src/Layout.tsx
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";

export type LayoutOutletCtx = {
  nightmode: boolean;
  toggleNightmode: () => void;
};

export default function Layout() {
  const [nightmode, setNightmode] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", nightmode ? "dark" : "light");
  }, [nightmode]);

  const toggleNightmode = () => setNightmode((v) => !v);

  return (
    <>
      <Header nightmode={nightmode} onToggleNightmode={toggleNightmode} />
      {/* Passe le nightmode aux pages enfants via Outlet context */}
      <Outlet context={{ nightmode, toggleNightmode } satisfies LayoutOutletCtx} />
    </>
  );
}

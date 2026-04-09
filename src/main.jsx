import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import RickyR from "./RickyR.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RickyR />
  </StrictMode>,
);

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this repo at https://<user>.github.io/training-manager/,
// so all asset URLs need that path prefix baked in.
export default defineConfig({
  base: "/training-manager/",
  plugins: [react()],
});

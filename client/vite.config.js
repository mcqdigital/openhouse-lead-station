import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true
      },
      manifest: {
        name: "Open House Lead Station",
        short_name: "OpenHouse",
        description: "Tablet-first open house sign-in kiosk for realtors",
        theme_color: "#0f172a",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "https://dummyimage.com/192x192/0f172a/ffffff.png&text=OH",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "https://dummyimage.com/512x512/0f172a/ffffff.png&text=OH",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true
      }
    }
  }
});
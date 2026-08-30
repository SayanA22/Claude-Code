import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DayOS",
    short_name: "DayOS",
    description:
      "Your day, planned. DayOS turns your tasks, deadlines and goals into a realistic schedule.",
    start_url: "/today",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfbfd",
    theme_color: "#fbfbfd",
    categories: ["productivity", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

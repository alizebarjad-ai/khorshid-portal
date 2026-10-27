import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "سامانه داخلی خورشید مفاخر",
    short_name: "خورشید",
    description: "سامانه مدیریت اعضا، باشگاه‌ها و گردش کار سازمان مردم‌نهاد خورشید مفاخر",
    lang: "fa",
    dir: "rtl",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#F7F5F0",
    theme_color: "#172F48",
    orientation: "any",
    icons: [
      { src: "/khorshid-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/khorshid-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
    ],
    categories: ["business", "productivity"]
  };
}

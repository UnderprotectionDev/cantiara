import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "Cantiara Web Capture",
    description: "Send explicit web captures to the Cantiara Capture Inbox.",
    permissions: ["activeTab", "scripting", "storage"],
    action: {
      default_title: "Web Capture",
    },
  },
  modules: ["@wxt-dev/module-react"],
});

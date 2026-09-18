import { defineConfig } from "wxt";

function webCaptureApiHostPermission() {
  const environment = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  const serverUrl = environment?.VITE_SERVER_URL ?? "http://localhost:3000";
  return `${new URL(serverUrl).origin}/*`;
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "Cantiara Web Capture",
    description: "Send explicit web captures to the Cantiara Capture Inbox.",
    browser_specific_settings: {
      gecko: {
        data_collection_permissions: {
          required: ["browsingActivity", "websiteContent"],
        },
        id: "web-capture@cantiara.local",
      },
    },
    host_permissions: [webCaptureApiHostPermission()],
    permissions: ["activeTab", "scripting", "storage"],
    action: {
      default_title: "Web Capture",
    },
  },
  modules: ["@wxt-dev/module-react"],
});

import { initLogger } from "evlog";

initLogger({
	env: { service: "cantiara-server" },
});

export default {
	fetch(request: Request) {
		return import("./hono-app").then((mod) => mod.app.fetch(request));
	},
	port: 3000,
};

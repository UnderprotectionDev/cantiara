import { resetPrismaClientCache } from "@cantiara/db";
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

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(() => {
		resetPrismaClientCache();
	});
}

import { forgetPrismaClientCache } from "@cantiara/db";
import { initLogger } from "evlog";

import { app } from "./hono-app";

initLogger({
	env: { service: "cantiara-server" },
});

export default {
	fetch(request: Request) {
		return app.fetch(request);
	},
	hostname: "0.0.0.0",
	port: 3000,
};

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(() => {
		forgetPrismaClientCache();
	});
}

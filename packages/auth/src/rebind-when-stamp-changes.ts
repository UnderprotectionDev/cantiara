export function rebindWhenStampChanges<T extends object>(
	create: () => T,
	readStamp: () => string
): T {
	let stamp = readStamp();
	let current = create();
	return new Proxy(current, {
		get(_target, property) {
			const nextStamp = readStamp();
			if (nextStamp !== stamp) {
				stamp = nextStamp;
				current = create();
			}
			const value = Reflect.get(current, property, current);
			if (typeof value === "function") {
				return value.bind(current);
			}
			return value;
		},
	});
}

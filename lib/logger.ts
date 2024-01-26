export type LogLevel = (typeof levels)[number];

const levels = ["debug", "info", "warn", "error"] as const;

export const logger = {
	debug: console.debug,
	info: console.info,
	warn: console.warn,
	error: console.error,
};

export function setLevel(level: string) {
	if (!isLogLevel(level)) {
		logger.warn(`Invalid log level: ${level}, leaving unchanged`);
		return;
	}

	const levelIndex = levels.indexOf(level);

	for (let i = 0; i < levelIndex; i++) {
		const level = levels[i];
		logger[level] = () => {};
	}
}

export function disable() {
	for (const level of levels) {
		logger[level] = () => {};
	}
}

function isLogLevel(level: string): level is LogLevel {
	return levels.includes(level as LogLevel);
}

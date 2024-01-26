export type Logger = typeof all;
export type LogLevel = keyof Logger;

export const all = {
	debug: console.debug,
	info: console.info,
	warn: console.warn,
	error: console.error,
} as const;

export const disabled: Logger = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
};

export function atLevelStr(level: string): Logger {
	if (!isLogLevel(level)) {
		throw new Error(`Invalid log level: ${level}`);
	}

	return atLevel(level);
}

export function atLevel(level: LogLevel): Logger {
	if (!isLogLevel(level)) {
		`Invalid log level: ${level}, leaving unchanged`;
	}

	const levels = ["debug", "info", "warn", "error"] as const;
	const levelIndex = levels.indexOf(level);

	const logger: Record<LogLevel, (...data: unknown[]) => void> = Object.assign(
		{},
		all,
	);

	for (let i = 0; i < levelIndex; i++) {
		const level = levels[i];
		logger[level] = () => {};
	}

	return logger;
}

function isLogLevel(level: string): level is LogLevel {
	return Object.hasOwn(all, level as LogLevel);
}

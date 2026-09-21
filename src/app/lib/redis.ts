import { createClient } from "redis";
import config from "../config";

export const redisClient = createClient({
	username: config.redis_user,
	password: config.redis_password,
	socket: {
		host: config.redis_host,
		port: Number(config.redis_port),
		reconnectStrategy: (retries) => {
			const delay = Math.min(1000 * 2 ** retries, 30000);
			return delay;
		},
	},
});

redisClient.on("error", (error) => {
	console.error("Redis connection error:", error.message);
});
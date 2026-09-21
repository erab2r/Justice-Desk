import { spawn, type ChildProcess } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const processes: ChildProcess[] = [];

const startProcess = (command: string, args: string[]) => {
	const child = spawn(command, args, {
		stdio: "inherit",
		shell: process.platform === "win32",
	});

	processes.push(child);
	return child;
};

const backend = startProcess(npmCommand, ["run", "dev:server"]);
const stripe = startProcess("stripe", [
	"listen",
	"--forward-to",
	"localhost:5000/api/v1/appointment/stripe/webhook",
]);

const stopProcesses = () => {
	for (const child of processes) {
		if (!child.killed) {
			child.kill();
		}
	}
};

process.on("SIGINT", () => {
	stopProcesses();
	process.exit(0);
});

process.on("SIGTERM", () => {
	stopProcesses();
	process.exit(0);
});

backend.on("exit", (code) => {
	if (code !== 0) {
		console.error(`Backend exited with code ${code ?? "unknown"}`);
	}
	stopProcesses();
	process.exit(code ?? 1);
});

stripe.on("error", (error) => {
	console.error("Stripe CLI failed to start:", error.message);
});

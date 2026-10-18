const fs = require('fs');
const path = require('path');

// Load KEY=value pairs from .env (optional) so PM2 runs with the same settings
// as the foreground fallback in run.sh.
function loadEnv(file) {
	const out = {};
	try {
		const txt = fs.readFileSync(path.join(__dirname, file), 'utf8');
		for (const line of txt.split('\n')) {
			const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
			if (!m) continue; // skip blanks and # comments
			out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
		}
	} catch { /* .env is optional */ }
	return out;
}

module.exports = {
	apps: [
		{
			name:         'huddle',
			script:       'host/src/main.ts',
			interpreter:  'node',
			interpreter_args: '--import tsx', // run the TypeScript server directly, as `npm start` does
			cwd:          __dirname,
			exec_mode:    'fork', // rooms live in memory: exactly one instance
			autorestart:  true,
			max_restarts: 10,
			min_uptime:   '30s',
			max_memory_restart: '500M',
			merge_logs:   true,
			out_file:     './logs/out.log',
			error_file:   './logs/err.log',
			time:         true,
			env: {
				HOST: '0.0.0.0',
				PORT: '3001',
				...loadEnv('.env'),
				NODE_ENV: 'production',
			},
		},
	],
};

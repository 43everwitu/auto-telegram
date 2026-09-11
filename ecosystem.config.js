module.exports = {
  apps: [
    {
      name: "telegram-post-backend",
      cwd: "./backend",
      script: "./venv/bin/uvicorn",
      args: "app.main:app --host 0.0.0.0 --port 8010",
      interpreter: "none",
      env: {
        // app.main loads backend/.env itself via python-dotenv;
        // nothing needed here.
      },
    },
    {
      name: "telegram-post-frontend",
      cwd: "./frontend",
      script: "npm",
      args: "run dev -- --host 0.0.0.0 --port 5173",
      interpreter: "none",
    },
  ],
};

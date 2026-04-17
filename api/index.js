require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "*",
    methods: ["GET", "POST", "OPTIONS"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    service: "CodeFlow backend",
    status: "ok",
    mode: "vercel-serverless",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/execute", async (req, res) => {
  const { source_code, compiler, stdin } = req.body || {};

  if (!source_code || !compiler) {
    return res.status(400).json({
      error: "source_code and compiler are required",
    });
  }

  const timeoutMs = 30000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: source_code,
        compiler,
        stdin: stdin || "",
        save: false,
      }),
      signal: controller.signal,
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Execution service error",
        details: result?.message || result,
      });
    }

    return res.json({
      stdout: result.program_output || "",
      stderr: result.program_error || "",
      compile_output: result.compiler_error || result.compiler_output || "",
      status: {
        id: result.status === "0" || result.status === 0 ? 3 : 11,
        description:
          result.status === "0" || result.status === 0
            ? "Accepted"
            : "Runtime Error",
      },
      time: null,
      memory: null,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Execution timed out",
      });
    }

    return res.status(500).json({
      error: "Failed to execute code. Please try again.",
    });
  } finally {
    clearTimeout(timeout);
  }
});

module.exports = app;

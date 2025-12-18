import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const REQUIRED_ENV = ["OPENAI_API_KEY", "EMAIL_USER", "EMAIL_PASS", "PORT"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = Number(process.env.PORT) || 8080;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Health Check
app.get("/", (req, res) => res.status(200).send("OK"));

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// AI Email Agent endpoint
app.post("/agent/send-email", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, message: "Prompt required" });

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `
You are an AI Email Agent.
Return ONLY valid JSON in this format:

{
  "to": "email@example.com",
  "subject": "Email subject",
  "body": "Professional email body only. No subject line here."
}

Do not add explanations or extra text.
`
        },
        { role: "user", content: prompt }
      ]
    });

    const raw = aiResponse.choices[0].message.content;

    let emailData;
    try {
      emailData = JSON.parse(raw);
    } catch {
      return res.status(500).json({ success: false, message: "AI response parsing failed", raw });
    }

    const { to, subject, body } = emailData;
    if (!to || !subject || !body) {
      return res.status(400).json({ success: false, message: "Incomplete email data from AI", emailData });
    }

    await transporter.sendMail({
      from: `"AI Agent" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: body
    });

    res.json({ success: true, message: "Email sent successfully", email: { to, subject } });

  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Agentic Email AI running on port ${PORT}`);
});

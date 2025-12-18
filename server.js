import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Email transporter (Gmail App Password required)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Health check (optional but helpful)
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// Agent Endpoint
app.post("/agent/send-email", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "Prompt required"
      });
    }

    // OpenAI request (NEW API)
    const aiResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      input: [
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

    const raw = aiResponse.output_text;

    if (!raw) {
      return res.status(500).json({
        success: false,
        message: "Empty AI response"
      });
    }

    // Parse AI JSON
    let emailData;
    try {
      emailData = JSON.parse(raw);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to parse AI JSON",
        raw
      });
    }

    const { to, subject, body } = emailData;

    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: "Incomplete email data from AI",
        emailData
      });
    }

    // Send email
    await transporter.sendMail({
      from: `"AI Agent" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: body
    });

    return res.json({
      success: true,
      message: "Email sent successfully",
      email: { to, subject }
    });

  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// REQUIRED FOR DIGITALOCEAN
const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Agentic Email AI running on port ${PORT}`);
});

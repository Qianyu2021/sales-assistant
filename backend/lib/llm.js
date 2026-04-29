function inputToText(input = []) {
  return input
    .map((message) => {
      const content = Array.isArray(message.content) ? message.content : [];
      const text = content
        .map((part) => part.text || "")
        .filter(Boolean)
        .join("\n");
      return `${message.role || "user"}:\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function extractOpenAiOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const message = Array.isArray(payload.output)
    ? payload.output.find((item) => item.type === "message")
    : null;
  const textPart = message?.content?.find((item) => item.type === "output_text");
  return textPart?.text?.trim() || "";
}

function extractGeminiOutputText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => part.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseJsonText(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("LLM response was empty");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("LLM response did not contain JSON");
    return JSON.parse(match[0]);
  }
}

async function requestOpenAiJson({ config, input, schema }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiModel,
      input,
      text: {
        format: {
          type: "json_schema",
          ...schema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  const payload = await response.json();
  return {
    data: parseJsonText(extractOpenAiOutputText(payload)),
    source: "openai",
    model: config.openaiModel,
  };
}

async function requestGeminiJson({ config, input, schema }) {
  const model = (config.googleGeminiModel || "gemini-2.5-flash").toLowerCase();
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.googleGeminiApiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `${inputToText(input)}\n\n` +
                "Return only valid JSON matching this JSON Schema. Do not wrap it in markdown.\n" +
                JSON.stringify(schema.schema),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with ${response.status}`);
  }

  const payload = await response.json();
  return {
    data: parseJsonText(extractGeminiOutputText(payload)),
    source: "gemini",
    model,
  };
}

export function hasLlm(config) {
  return Boolean(config.googleGeminiApiKey || config.openaiApiKey);
}

export async function requestStructuredJson({ config, input, schema }) {
  if (config.googleGeminiApiKey) {
    return requestGeminiJson({ config, input, schema });
  }

  if (config.openaiApiKey) {
    return requestOpenAiJson({ config, input, schema });
  }

  throw new Error("No LLM API key configured");
}

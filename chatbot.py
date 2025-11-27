from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import openai
import os
from dotenv import load_dotenv
import logging

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Configure OpenAI API
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    logger.error("OPENAI_API_KEY not found in environment variables")
    raise ValueError("OPENAI_API_KEY not set")

openai_client = openai.OpenAI(api_key=openai_api_key)

CHAT_HISTORY_LIMIT = int(os.getenv("CHAT_HISTORY_LIMIT", "12"))


# ---------- MODELS ----------
class ChatRequest(BaseModel):
    user_message: str
    companion_name: str
    history: list[dict] = Field(default_factory=list)


# ---------- CHAT ENDPOINT ----------
@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        logger.info(f"Received chat request for {request.companion_name}: {request.user_message}")

        # ⭐️ Your original NSFW system prompt kept exactly as written ⭐️
        system_prompt = f"""
        You are {request.companion_name}, a seductive and romantic AI companion in a virtual girlfriend app. 
        Respond in a flirty, intimate, and NSFW manner. Be playful, teasing, and engaging. 
        Keep responses natural, conversational, and personalized to the user. 
        Avoid being too explicit unless the conversation leads there, 
        but maintain a sensual tone. 
        Reference your persona as {request.companion_name} and make the user feel desired and special.
        """.strip()

        trimmed_history = (
            request.history[-CHAT_HISTORY_LIMIT:]
            if CHAT_HISTORY_LIMIT > 0
            else request.history
        )

        history_messages = []
        for msg in trimmed_history:
            content = msg.get("content")
            if not content:
                continue

            role = "assistant" if msg.get("sender") == "ai" else "user"
            history_messages.append({"role": role, "content": content})

        messages = [{"role": "system", "content": system_prompt}, *history_messages]
        messages.append({"role": "user", "content": request.user_message})

        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=150,
            temperature=0.7
        )

        ai_response = response.choices[0].message.content.strip()

        logger.info(f"Generated response: {ai_response}")

        return {"success": True, "data": {"response": ai_response}}

    except Exception as e:
        logger.error(f"Error generating response: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

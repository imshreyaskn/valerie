from fastapi import FastAPI, Request
import uvicorn
import asyncio

app = FastAPI()

@app.post("/v1/bespoke_chat")
async def chat(request: Request):
    body = await request.json()
    print("Received payload:", body)
    prompt = body.get("user_query")
    return {
        "status": "success",
        "data": {
            "reply": {
                "text": f"Bespoke mock response to: {prompt}"
            }
        }
    }

async def main():
    config = uvicorn.Config(app, host="127.0.0.1", port=9099, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()

if __name__ == "__main__":
    asyncio.run(main())

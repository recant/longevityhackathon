"""Quick local test: OLLAMA_API_KEY from parent .env → generate_insights."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

from database import get_default_profile, init_db
from insights import generate_insights


async def main() -> None:
    await init_db()
    profile = await get_default_profile()
    snapshot = {
        "categories": [{"label": "Mobility", "score": 72, "interpretation": "steady"}],
        "overall": {"overall_score": 70, "headline": "test"},
    }
    result = generate_insights(profile, snapshot)
    print("mock:", result.get("mock"))
    print("summary:", result.get("summary", "")[:300])
    print("tip:", result.get("conversation_tip", "")[:200])


if __name__ == "__main__":
    asyncio.run(main())

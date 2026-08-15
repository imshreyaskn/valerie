import asyncio
from valerie.db.engine import db

async def main():
    users = await db.users.find().to_list(10)
    for u in users:
        print(f"User: {u.get('email')}, ID: {u.get('_id')}")

if __name__ == "__main__":
    asyncio.run(main())

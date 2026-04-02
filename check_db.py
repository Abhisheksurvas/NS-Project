import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def main():
    load_dotenv('backend/.env')
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.auth_db
    users = await db.users.find().to_list(100)
    print(f"Total users found: {len(users)}")
    for user in users:
        print(f"- {user['email']}")

if __name__ == "__main__":
    asyncio.run(main())

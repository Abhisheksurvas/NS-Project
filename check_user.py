import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def main():
    load_dotenv('backend/.env')
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.auth_db
    
    email = "abhisheksurvase00@gmail.com"
    user = await db.users.find_one({"email": email})
    
    if user:
        print(f"User found: {user['email']}")
        print(f"Has TOTP Secret: {'Yes' if 'totp_secret' in user else 'No'}")
        if 'totp_secret' in user:
            print(f"Secret: {user['totp_secret']}")
    else:
        print(f"User {email} not found.")

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime

async def main():
    load_dotenv('backend/.env')
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.auth_db
    
    email = "abhisheksurvase00@gmail.com"
    user = await db.users.find_one({"email": email})
    
    if user:
        print(f"User: {user['email']}")
        print(f"Current OTP: {user.get('current_otp')}")
        print(f"Expiry: {user.get('otp_expiry')}")
        print(f"Server Now (UTC): {datetime.utcnow()}")
        if user.get('otp_expiry'):
            diff = user.get('otp_expiry') - datetime.utcnow()
            print(f"Time left: {diff.total_seconds()} seconds")
    else:
        print(f"User {email} not found.")

if __name__ == "__main__":
    asyncio.run(main())

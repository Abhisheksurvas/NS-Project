from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from datetime import datetime, timedelta
import bcrypt
import os
import secrets
import asyncio
import aiosmtplib
import pyotp
import qrcode
import io
import base64
from email.message import EmailMessage
from dotenv import load_dotenv
from user_agents import parse

load_dotenv()

# ---------------- CONFIG ----------------

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
MAIL_FROM = os.getenv("MAIL_FROM")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")

# ---------------- APP ----------------

app = FastAPI()

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    for error in exc.errors():
        if "email" in error.get("loc", []):
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={"detail": "email not found/ invaild"},
            )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- DATABASE at mongodb ----------------

client = AsyncIOMotorClient(MONGO_URL)
db = client.auth_db
users_collection = db.users
activity_collection = db.activity_logs

# ---------------- MODELS ----------------

class UserRegister(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class VerifyOTP(BaseModel):
    email: EmailStr
    otp: str

# ---------------- HELPERS ----------------

async def log_activity(email: str, action: str, request: Request):
    ua_string = request.headers.get("user-agent", "")
    user_agent = parse(ua_string)
    
    log_entry = {
        "email": email,
        "action": action,
        "browser": f"{user_agent.browser.family} {user_agent.browser.version_string}",
        "os": f"{user_agent.os.family} {user_agent.os.version_string}",
        "ip": request.client.host,
        "timestamp": datetime.utcnow()
    }
    await activity_collection.insert_one(log_entry)

def log_otp_to_file(email: str, otp: str):
    root_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "otp_debug.txt")
    with open(root_path, "a") as f:
        f.write(f"[{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}] OTP for {email}: {otp}\n")

def hash_password(password: str):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str):
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await users_collection.find_one({"email": email})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def send_otp_email(email: str, otp: str):
    log_otp_to_file(email, otp)
    if not SMTP_USER or not SMTP_PASS:
        print(f"\n--- DEBUG: SMTP not configured. OTP for {email} is: {otp} ---\n")
        return

    message = EmailMessage()
    message["From"] = MAIL_FROM
    message["To"] = email
    message["Subject"] = "Your Verification OTP"

    message.set_content(f"Hello,\n\nYour verification code is: {otp}\n\nThis OTP will expire in 5 minutes.\n\nSecure Auth System\n")

    try:
        await aiosmtplib.send(
            message,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASS,
            start_tls=True
        )
        print(f"SUCCESS: Email sent to {email}")
    except Exception as e:
        print(f"FAILED to send email: {e}")

# ---------------- ROUTES ----------------

@app.post("/register")
async def register(user: UserRegister):
    # Check if the email exists in our system (authorized users)
    existing_user = await users_collection.find_one({"email": user.email})
    
    # 1. If user NOT in database at all -> email not authorized
    if not existing_user:
        raise HTTPException(status_code=400, detail="email not found/ invaild")

    # 2. If user IS in database but ALREADY verified -> redirect to login (or show error)
    if existing_user.get("is_verified", False):
        raise HTTPException(status_code=400, detail="email not found/ invaild")

    # 3. User is in database but NOT yet verified -> Generate OTP for registration
    otp = str(secrets.randbelow(1000000)).zfill(6)
    expiry = datetime.utcnow() + timedelta(minutes=5)

    # Update the existing user record with the password and new OTP
    await users_collection.update_one(
        {"email": user.email},
        {"$set": {
            "password": hash_password(user.password),
            "current_otp": otp,
            "otp_expiry": expiry,
            "totp_secret": pyotp.random_base32(),
            "created_at": datetime.utcnow(),
            "recovery_codes": [secrets.token_hex(4).upper() for _ in range(5)]
        }}
    )

    asyncio.create_task(send_otp_email(user.email, otp))
    return {"message": "OTP sent to email for registration verification"}

@app.post("/verify-registration")
async def verify_registration(data: VerifyOTP):
    user = await users_collection.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("current_otp") == data.otp:
        if datetime.utcnow() < user.get("otp_expiry"):
            await users_collection.update_one(
                {"email": data.email},
                {"$set": {"is_verified": True, "current_otp": None, "otp_expiry": None}}
            )
            return {"message": "Email verified successfully. You can now login."}
        else:
            raise HTTPException(status_code=400, detail="OTP expired")
    else:
        raise HTTPException(status_code=400, detail="Invalid OTP")

@app.post("/login")
async def login(user: UserLogin, request: Request):
    db_user = await users_collection.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        await log_activity(user.email, "Failed Login Attempt", request)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not db_user.get("is_verified", True):
        raise HTTPException(status_code=401, detail="Email not verified. Please register again.")

    otp = str(secrets.randbelow(1000000)).zfill(6)
    expiry = datetime.utcnow() + timedelta(minutes=5)

    await users_collection.update_one(
        {"email": user.email},
        {"$set": {"current_otp": otp, "otp_expiry": expiry}}
    )

    await log_activity(user.email, "OTP Sent (Step 1)", request)
    asyncio.create_task(send_otp_email(user.email, otp))
    return {"message": "OTP sent to email"}

@app.get("/setup-2fa")
async def setup_2fa(email: str):
    try:
        user = await users_collection.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        secret = user.get("totp_secret")
        if not secret:
            secret = pyotp.random_base32()
            await users_collection.update_one({"email": email}, {"$set": {"totp_secret": secret}})
        
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(name=email, issuer_name="SecureAuth")
        
        img = qrcode.make(provisioning_uri)
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return {"qr_code": f"data:image/png;base64,{img_str}", "secret": secret}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/verify-2fa")
async def verify_2fa(data: VerifyOTP, request: Request):
    try:
        user = await users_collection.find_one({"email": data.email})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        is_valid = False
        secret = user.get("totp_secret")
        if secret:
            totp = pyotp.TOTP(secret)
            if totp.verify(data.otp):
                is_valid = True
        
        if not is_valid:
            curr_otp = user.get("current_otp")
            expiry = user.get("otp_expiry")
            if curr_otp == data.otp and datetime.utcnow() < expiry:
                is_valid = True
                await users_collection.update_one({"email": data.email}, {"$set": {"current_otp": None}})
        
        if not is_valid:
            if data.otp.upper() in user.get("recovery_codes", []):
                is_valid = True
                await users_collection.update_one(
                    {"email": data.email}, 
                    {"$pull": {"recovery_codes": data.otp.upper()}}
                )

        if is_valid:
            token = create_access_token({"sub": user["email"]})
            await users_collection.update_one({"email": data.email}, {"$set": {"last_login": datetime.utcnow()}})
            await log_activity(data.email, "Login Successful (2FA)", request)
            return {"access_token": token, "token_type": "bearer"}
        else:
            await log_activity(data.email, "Failed 2FA Attempt", request)
            raise HTTPException(status_code=400, detail="Invalid or expired code")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user/me")
async def read_users_me(user = Depends(get_current_user)):
    logs_cursor = activity_collection.find({"email": user["email"]}).sort("timestamp", -1).limit(10)
    logs = await logs_cursor.to_list(length=10)
    
    formatted_logs = []
    for log in logs:
        formatted_logs.append({
            "action": log["action"],
            "browser": log["browser"],
            "os": log["os"],
            "timestamp": log["timestamp"].isoformat()
        })

    return {
        "email": user["email"],
        "last_login": user.get("last_login"),
        "recovery_codes_count": len(user.get("recovery_codes", [])),
        "activity_logs": formatted_logs,
        "otp_enabled": True 
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

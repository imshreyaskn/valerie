from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import uuid
import datetime
from valerie.db.engine import db
from valerie.api.auth import require_api_key, create_access_token, pwd_context

router = APIRouter(prefix="/users", tags=["Users"])

class AuthRequest(BaseModel):
    email: str
    password: str

@router.post("/register")
async def register(req: AuthRequest):
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(400, "Email already registered")
        
    uid = str(uuid.uuid4())
    hashed_pwd = pwd_context.hash(req.password)
    
    await db.users.insert_one({
        "uid": uid,
        "email": req.email,
        "hashed_password": hashed_pwd,
        "display_name": req.email.split("@")[0],
        "created_at": datetime.datetime.utcnow()
    })
    
    token = create_access_token({"sub": uid})
    return {"token": token, "uid": uid, "email": req.email}

@router.post("/login")
async def login(req: AuthRequest):
    user = await db.users.find_one({"email": req.email})
    if not user or not user.get("hashed_password"):
        raise HTTPException(401, "Invalid email or password")
        
    if not pwd_context.verify(req.password, user["hashed_password"]):
        raise HTTPException(401, "Invalid email or password")
        
    token = create_access_token({"sub": user["uid"]})
    return {"token": token, "uid": user["uid"], "email": req.email}

@router.get("/me")
async def get_me(user=Depends(require_api_key)):
    user_doc = await db.users.find_one({"uid": user["id"]})
    if not user_doc:
        raise HTTPException(404, "User not found")
    user_doc.pop("_id", None)
    user_doc.pop("hashed_password", None)
    return user_doc

@router.delete("/me")
async def delete_me(user=Depends(require_api_key)):
    await db.users.update_one({"uid": user["id"]}, {"$set": {"is_deleted": True}})
    return {"success": True}

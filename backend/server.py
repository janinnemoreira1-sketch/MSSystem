from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated, Literal

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, BeforeValidator, ConfigDict
from starlette.middleware.cors import CORSMiddleware

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 24  # 24h
REFRESH_TTL_DAYS = 30

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

app = FastAPI(title="CrediFlux API")
api_router = APIRouter(prefix="/api")

# -----------------------------------------------------------------------------
# Utils
# -----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                        max_age=ACCESS_TTL_MIN * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none",
                        max_age=REFRESH_TTL_DAYS * 24 * 3600, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


def oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str = "admin"


class Installment(BaseModel):
    number: int
    due_date: str  # ISO date YYYY-MM-DD
    amount: float
    paid: bool = False
    paid_at: Optional[str] = None
    paid_amount: Optional[float] = None
    payment_method: Optional[str] = None
    note: Optional[str] = None


class ClientIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    loan_amount: float
    loan_date: str  # YYYY-MM-DD
    interest_rate: float = 0.0
    collection_method: Literal["a_vista", "parcelado"] = "a_vista"
    collection_frequency: Optional[Literal["semanal", "quinzenal", "mensal"]] = "mensal"
    installments_count: int = 1
    installment_amount: Optional[float] = None
    first_payment_date: str
    notes: Optional[str] = ""


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    loan_amount: Optional[float] = None
    loan_date: Optional[str] = None
    interest_rate: Optional[float] = None
    collection_method: Optional[Literal["a_vista", "parcelado"]] = None
    collection_frequency: Optional[Literal["semanal", "quinzenal", "mensal"]] = None
    installments_count: Optional[int] = None
    installment_amount: Optional[float] = None
    first_payment_date: Optional[str] = None
    notes: Optional[str] = None


class PaymentIn(BaseModel):
    installment_number: int
    paid_amount: float
    paid_at: str  # YYYY-MM-DD
    payment_method: Literal["pix", "dinheiro", "transferencia", "cartao", "outro"] = "pix"
    note: Optional[str] = ""


class ClientOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    phone: str = ""
    loan_amount: float
    loan_date: str
    interest_rate: float
    collection_method: str
    collection_frequency: Optional[str] = None
    installments_count: int
    installment_amount: float
    first_payment_date: str
    notes: str = ""
    installments: List[Installment] = []
    total_due: float = 0.0
    total_paid: float = 0.0
    balance: float = 0.0
    status: str = "pendente"
    next_due_date: Optional[str] = None
    created_at: str


# -----------------------------------------------------------------------------
# Business helpers
# -----------------------------------------------------------------------------
def _add_period(base: datetime, freq: str, n: int) -> datetime:
    if freq == "semanal":
        return base + timedelta(days=7 * n)
    if freq == "quinzenal":
        return base + timedelta(days=15 * n)
    # mensal
    month = base.month - 1 + n
    year = base.year + month // 12
    month = month % 12 + 1
    day = min(base.day, 28)
    return base.replace(year=year, month=month, day=day)


def build_installments(client_in: ClientIn) -> List[dict]:
    total_with_interest = client_in.loan_amount * (1 + (client_in.interest_rate or 0) / 100.0)
    if client_in.collection_method == "a_vista":
        return [Installment(
            number=1,
            due_date=client_in.first_payment_date,
            amount=round(total_with_interest, 2),
        ).model_dump()]
    count = max(1, int(client_in.installments_count or 1))
    per = client_in.installment_amount if client_in.installment_amount else round(total_with_interest / count, 2)
    first = datetime.fromisoformat(client_in.first_payment_date)
    freq = client_in.collection_frequency or "mensal"
    items = []
    for i in range(count):
        due = _add_period(first, freq, i)
        items.append(Installment(
            number=i + 1,
            due_date=due.strftime("%Y-%m-%d"),
            amount=round(per, 2),
        ).model_dump())
    return items


def compute_status(doc: dict) -> dict:
    today = datetime.now(timezone.utc).date()
    installments = doc.get("installments", [])
    total_due = round(sum(i["amount"] for i in installments), 2)
    total_paid = round(sum((i.get("paid_amount") or 0) for i in installments if i.get("paid")), 2)
    balance = round(total_due - total_paid, 2)

    next_due = None
    status = "pago"
    for it in installments:
        if it.get("paid"):
            continue
        due = datetime.fromisoformat(it["due_date"]).date()
        if next_due is None or due < datetime.fromisoformat(next_due).date():
            next_due = it["due_date"]
        if due < today:
            status = "atrasado"
            break
        elif (due - today).days <= 3:
            status = "a_vencer" if status != "atrasado" else status
        else:
            if status not in ("atrasado", "a_vencer"):
                status = "pendente"
    if all(i.get("paid") for i in installments) and installments:
        status = "pago"
        next_due = None
    doc["total_due"] = total_due
    doc["total_paid"] = total_paid
    doc["balance"] = balance
    doc["status"] = status
    doc["next_due_date"] = next_due
    return doc


def serialize_client(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    compute_status(doc)
    return doc


# -----------------------------------------------------------------------------
# Auth endpoints
# -----------------------------------------------------------------------------
@api_router.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    attempt = await db.login_attempts.find_one({"identifier": identifier})
    now = datetime.now(timezone.utc)
    if attempt and attempt.get("locked_until") and attempt["locked_until"] > now:
        raise HTTPException(status_code=429, detail="Muitas tentativas. Tente novamente em 15 minutos.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        count = (attempt or {}).get("count", 0) + 1
        update = {"identifier": identifier, "count": count, "updated_at": now}
        if count >= 5:
            update["locked_until"] = now + timedelta(minutes=15)
            update["count"] = 0
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")

    await db.login_attempts.delete_one({"identifier": identifier})

    uid = str(user["_id"])
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": user.get("name", "Admin"), "role": user.get("role", "admin")}


@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], email=user["email"], name=user.get("name", "Admin"), role=user.get("role", "admin"))


# -----------------------------------------------------------------------------
# Clients endpoints
# -----------------------------------------------------------------------------
@api_router.post("/clients", response_model=ClientOut)
async def create_client(body: ClientIn, user: dict = Depends(get_current_user)):
    installments = build_installments(body)
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "owner_id": user["id"],
        "name": body.name.strip(),
        "phone": (body.phone or "").strip(),
        "loan_amount": float(body.loan_amount),
        "loan_date": body.loan_date,
        "interest_rate": float(body.interest_rate or 0),
        "collection_method": body.collection_method,
        "collection_frequency": body.collection_frequency,
        "installments_count": len(installments),
        "installment_amount": installments[0]["amount"] if installments else 0,
        "first_payment_date": body.first_payment_date,
        "notes": body.notes or "",
        "installments": installments,
        "created_at": now,
    }
    res = await db.clients.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_client(doc)


@api_router.get("/clients", response_model=List[ClientOut])
async def list_clients(user: dict = Depends(get_current_user)):
    cursor = db.clients.find({"owner_id": user["id"]}).sort("created_at", -1)
    return [serialize_client(d) async for d in cursor]


@api_router.get("/clients/{client_id}", response_model=ClientOut)
async def get_client(client_id: str, user: dict = Depends(get_current_user)):
    doc = await db.clients.find_one({"_id": oid(client_id), "owner_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return serialize_client(doc)


@api_router.patch("/clients/{client_id}", response_model=ClientOut)
async def update_client(client_id: str, body: ClientUpdate, user: dict = Depends(get_current_user)):
    doc = await db.clients.find_one({"_id": oid(client_id), "owner_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}

    schedule_fields = {"loan_amount", "interest_rate", "collection_method", "collection_frequency",
                       "installments_count", "installment_amount", "first_payment_date"}
    if schedule_fields.intersection(updates.keys()):
        merged = {**doc, **updates}
        new_in = ClientIn(
            name=merged["name"],
            phone=merged.get("phone", ""),
            loan_amount=merged["loan_amount"],
            loan_date=merged["loan_date"],
            interest_rate=merged.get("interest_rate", 0),
            collection_method=merged["collection_method"],
            collection_frequency=merged.get("collection_frequency", "mensal"),
            installments_count=merged.get("installments_count", 1),
            installment_amount=merged.get("installment_amount"),
            first_payment_date=merged["first_payment_date"],
            notes=merged.get("notes", ""),
        )
        new_installments = build_installments(new_in)
        # preserve paid status by matching number when possible
        old_by_num = {i["number"]: i for i in doc.get("installments", [])}
        for it in new_installments:
            old = old_by_num.get(it["number"])
            if old and old.get("paid"):
                it.update({"paid": True, "paid_at": old.get("paid_at"),
                           "paid_amount": old.get("paid_amount"),
                           "payment_method": old.get("payment_method"),
                           "note": old.get("note")})
        updates["installments"] = new_installments
        updates["installments_count"] = len(new_installments)

    await db.clients.update_one({"_id": oid(client_id)}, {"$set": updates})
    doc = await db.clients.find_one({"_id": oid(client_id)})
    return serialize_client(doc)


@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user: dict = Depends(get_current_user)):
    res = await db.clients.delete_one({"_id": oid(client_id), "owner_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {"ok": True}


@api_router.post("/clients/{client_id}/payments", response_model=ClientOut)
async def register_payment(client_id: str, body: PaymentIn, user: dict = Depends(get_current_user)):
    doc = await db.clients.find_one({"_id": oid(client_id), "owner_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    installments = doc.get("installments", [])
    found = False
    for it in installments:
        if it["number"] == body.installment_number:
            it["paid"] = True
            it["paid_at"] = body.paid_at
            it["paid_amount"] = float(body.paid_amount)
            it["payment_method"] = body.payment_method
            it["note"] = body.note or ""
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Parcela não encontrada")
    await db.clients.update_one({"_id": oid(client_id)}, {"$set": {"installments": installments}})
    doc["installments"] = installments
    return serialize_client(doc)


@api_router.delete("/clients/{client_id}/payments/{installment_number}", response_model=ClientOut)
async def undo_payment(client_id: str, installment_number: int, user: dict = Depends(get_current_user)):
    doc = await db.clients.find_one({"_id": oid(client_id), "owner_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    installments = doc.get("installments", [])
    for it in installments:
        if it["number"] == installment_number:
            it["paid"] = False
            it["paid_at"] = None
            it["paid_amount"] = None
            it["payment_method"] = None
            it["note"] = None
            break
    await db.clients.update_one({"_id": oid(client_id)}, {"$set": {"installments": installments}})
    doc["installments"] = installments
    return serialize_client(doc)


@api_router.get("/dashboard/summary")
async def dashboard_summary(user: dict = Depends(get_current_user)):
    docs = [serialize_client(d) async for d in db.clients.find({"owner_id": user["id"]})]
    total_lent = sum(d["loan_amount"] for d in docs)
    total_due = sum(d["total_due"] for d in docs)
    total_paid = sum(d["total_paid"] for d in docs)
    balance = sum(d["balance"] for d in docs)
    overdue = sum(1 for d in docs if d["status"] == "atrasado")
    upcoming = sum(1 for d in docs if d["status"] == "a_vencer")
    paid = sum(1 for d in docs if d["status"] == "pago")
    pending = sum(1 for d in docs if d["status"] == "pendente")
    return {
        "total_clients": len(docs),
        "total_lent": round(total_lent, 2),
        "total_due": round(total_due, 2),
        "total_paid": round(total_paid, 2),
        "balance": round(balance, 2),
        "overdue": overdue,
        "upcoming": upcoming,
        "paid": paid,
        "pending": pending,
    }


# -----------------------------------------------------------------------------
# Startup
# -----------------------------------------------------------------------------
async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower().strip()
    password = os.environ["ADMIN_PASSWORD"]
    name = os.environ.get("ADMIN_NAME", "Admin")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "email": email,
            "password_hash": hash_password(password),
            "name": name,
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin user {email}")
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password), "name": name}})
        logger.info(f"Updated admin password for {email}")


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.clients.create_index("owner_id")
    await seed_admin()


@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()


# CORS - must include credentials
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
allowed = [frontend_url, "http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

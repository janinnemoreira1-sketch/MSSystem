from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import ipaddress
import logging
import secrets
from datetime import datetime, timezone, timedelta
from html import escape
from html.parser import HTMLParser
from typing import List, Optional, Annotated, Literal
from urllib.parse import urlparse

import bcrypt
import httpx
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

# --- Email (Resend via Emergent managed proxy) ---------------------------------
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "MS Soluções Financeiras")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = (
    "reply with your password", "reply with the code", "send your password", "cvv",
    "send us your password", "enter your password below", "confirm your card number",
    "your full card number", "seed phrase", "recovery phrase", "verify your card",
    "social security number", "confirm your bank details",
    "responda com sua senha", "informe sua senha", "envie sua senha",
)
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("Emails não podem conter formulários (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email solicita credenciais: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Links/assets devem ser https absolutos: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"URL encurtada, IP ou com credenciais: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Texto do link {m.group(1)!r} ≠ host real {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY ausente — envio ignorado (to=%s)", to)
        return None
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error("Falha no envio de email: %s %s", e.response.status_code, e.response.text)
        return None
    except Exception as e:
        logger.error("Erro no envio de email: %s", e)
        return None


def _wrap_email(title: str, body_html: str, cta_url: Optional[str] = None, cta_text: Optional[str] = None) -> str:
    cta = ""
    if cta_url and cta_text:
        cta = (
            f'<tr><td align="center" style="padding:20px 0 8px 0">'
            f'<a href="{escape(cta_url)}" '
            f'style="display:inline-block;background:#2563eb;color:#ffffff;'
            f'text-decoration:none;padding:12px 22px;border-radius:10px;'
            f'font-weight:600;font-family:Arial,sans-serif">{escape(cta_text)}</a>'
            f"</td></tr>"
        )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#0b1424;padding:32px 12px"><tr><td align="center">'
        '<table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        'style="max-width:560px;width:100%;background:#0f172a;border:1px solid #1e293b;'
        'border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;color:#e2e8f0">'
        '<tr><td style="padding:24px 28px;border-bottom:1px solid #1e293b">'
        '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#60a5fa;'
        'font-weight:700">MS Soluções Financeiras</div>'
        f'<div style="font-size:20px;font-weight:800;color:#ffffff;margin-top:4px">{escape(title)}</div>'
        '</td></tr>'
        f'<tr><td style="padding:24px 28px;font-size:14px;line-height:1.6;color:#cbd5e1">{body_html}</td></tr>'
        f"{cta}"
        '<tr><td style="padding:18px 28px;border-top:1px solid #1e293b;font-size:11px;color:#64748b">'
        f'Enviado por {escape(EMAIL_FROM_NAME)}. Nunca pedimos senhas ou dados bancários por email.'
        '</td></tr></table></td></tr></table>'
    )

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


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    business_name: Optional[str] = ""


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class ApprovalIn(BaseModel):
    status: Literal["approved", "rejected", "pending"]


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str = "admin"
    business_name: Optional[str] = ""
    status: str = "approved"


class Installment(BaseModel):
    number: int
    due_date: str  # ISO date YYYY-MM-DD
    amount: float
    paid: bool = False
    paid_at: Optional[str] = None
    paid_amount: Optional[float] = None
    payment_method: Optional[str] = None
    note: Optional[str] = None
    receipt_token: Optional[str] = None


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
@api_router.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="A senha deve ter ao menos 6 caracteres.")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")
    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name.strip() or "Usuário",
        "business_name": (body.business_name or "").strip(),
        "role": "owner",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)

    # Envia emails (não falha o cadastro se o envio falhar)
    try:
        applicant_name = escape(doc["name"] or email)
        admin_email = os.environ.get("ADMIN_EMAIL", "").lower().strip()
        # 1) Boas-vindas ao solicitante
        welcome_html = _wrap_email(
            "Cadastro recebido",
            f"<p>Olá {applicant_name},</p>"
            f"<p>Recebemos seu cadastro em <strong>MS Soluções Financeiras</strong>. "
            f"Por segurança, novos painéis passam por aprovação do administrador antes do primeiro acesso.</p>"
            f"<p>Você receberá outro email assim que a sua conta for aprovada.</p>",
            cta_url=f"{FRONTEND_URL}/login",
            cta_text="Abrir painel",
        )
        await send_email(to=email, subject="Recebemos seu cadastro — MS Soluções Financeiras", html=welcome_html)

        # 2) Aviso ao administrador
        if admin_email:
            admin_html = _wrap_email(
                "Novo cadastro aguardando aprovação",
                f"<p>Um novo painel foi solicitado:</p>"
                f"<ul>"
                f"<li><strong>Nome:</strong> {applicant_name}</li>"
                f"<li><strong>E-mail:</strong> {escape(email)}</li>"
                f"<li><strong>Painel:</strong> {escape(doc.get('business_name') or '-')}</li>"
                f"</ul>"
                f"<p>Acesse o painel administrativo para aprovar ou recusar essa solicitação.</p>",
                cta_url=f"{FRONTEND_URL}/",
                cta_text="Revisar cadastros",
            )
            await send_email(to=admin_email, subject="Novo cadastro aguardando aprovação", html=admin_html)
    except Exception as e:
        logger.error("Falha ao notificar cadastro: %s", e)

    return {
        "status": "pending",
        "message": "Cadastro recebido. Aguarde a aprovação do administrador para acessar o painel.",
    }


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

    status = user.get("status", "approved")
    if status == "pending":
        raise HTTPException(status_code=403, detail="Sua conta está aguardando aprovação do administrador.")
    if status == "rejected":
        raise HTTPException(status_code=403, detail="Seu cadastro foi recusado. Entre em contato com o administrador.")

    uid = str(user["_id"])
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": user.get("name", "Admin"), "role": user.get("role", "admin"), "business_name": user.get("business_name", ""), "status": status}


@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], email=user["email"], name=user.get("name", "Admin"),
                   role=user.get("role", "admin"), business_name=user.get("business_name", ""),
                   status=user.get("status", "approved"))


@api_router.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(get_current_user)):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="A nova senha deve ter ao menos 6 caracteres.")
    if body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="A nova senha deve ser diferente da atual.")
    doc = await db.users.find_one({"_id": oid(user["id"])})
    if not doc or not verify_password(body.current_password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Senha atual incorreta.")
    await db.users.update_one({"_id": oid(user["id"])}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}


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
            if not it.get("receipt_token"):
                it["receipt_token"] = secrets.token_urlsafe(16)
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
    pending_registrations = 0
    if user.get("role") == "admin":
        pending_registrations = await db.users.count_documents({"status": "pending"})
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
        "pending_registrations": pending_registrations,
    }


# -----------------------------------------------------------------------------
# Reports, chart & public receipts
# -----------------------------------------------------------------------------
@api_router.get("/dashboard/chart")
async def dashboard_chart(months: int = 6, user: dict = Depends(get_current_user)):
    docs = [serialize_client(d) async for d in db.clients.find({"owner_id": user["id"]})]
    today = datetime.now(timezone.utc).date().replace(day=1)
    buckets = []
    for i in range(months - 1, -1, -1):
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        buckets.append({"key": f"{y:04d}-{m:02d}", "label": f"{m:02d}/{y}", "recebido": 0.0, "previsto": 0.0})
    idx = {b["key"]: b for b in buckets}
    for d in docs:
        for it in d.get("installments", []):
            due = it["due_date"][:7]
            if due in idx:
                idx[due]["previsto"] += it["amount"]
            if it.get("paid") and it.get("paid_at"):
                paid_month = it["paid_at"][:7]
                if paid_month in idx:
                    idx[paid_month]["recebido"] += it.get("paid_amount") or 0
    for b in buckets:
        b["recebido"] = round(b["recebido"], 2)
        b["previsto"] = round(b["previsto"], 2)
    return {"buckets": buckets}


@api_router.get("/reports/monthly")
async def monthly_report(year: int, month: int, user: dict = Depends(get_current_user)):
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Mês inválido")
    prefix = f"{year:04d}-{month:02d}"
    docs = [serialize_client(d) async for d in db.clients.find({"owner_id": user["id"]})]
    received = []  # payments received in month
    expected = []  # installments due in month
    for d in docs:
        for it in d.get("installments", []):
            if it["due_date"].startswith(prefix):
                expected.append({
                    "client_id": d["id"], "client_name": d["name"], "phone": d.get("phone", ""),
                    "installment_number": it["number"], "due_date": it["due_date"],
                    "amount": it["amount"], "paid": bool(it.get("paid")),
                    "paid_at": it.get("paid_at"), "paid_amount": it.get("paid_amount"),
                    "payment_method": it.get("payment_method"),
                })
            if it.get("paid") and (it.get("paid_at") or "").startswith(prefix):
                received.append({
                    "client_id": d["id"], "client_name": d["name"],
                    "installment_number": it["number"], "paid_at": it["paid_at"],
                    "paid_amount": it.get("paid_amount") or 0,
                    "payment_method": it.get("payment_method"),
                    "receipt_token": it.get("receipt_token"),
                })
    total_received = round(sum(r["paid_amount"] for r in received), 2)
    total_expected = round(sum(e["amount"] for e in expected), 2)
    outstanding = round(sum(e["amount"] for e in expected if not e["paid"]), 2)
    return {
        "year": year, "month": month, "prefix": prefix,
        "total_received": total_received,
        "total_expected": total_expected,
        "outstanding": outstanding,
        "count_received": len(received),
        "count_expected": len(expected),
        "received": sorted(received, key=lambda x: x["paid_at"]),
        "expected": sorted(expected, key=lambda x: x["due_date"]),
    }


@api_router.get("/receipts/{token}")
async def public_receipt(token: str):
    doc = await db.clients.find_one({"installments.receipt_token": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Recibo não encontrado")
    inst = next((i for i in doc.get("installments", []) if i.get("receipt_token") == token), None)
    if not inst:
        raise HTTPException(status_code=404, detail="Recibo não encontrado")
    owner = await db.users.find_one({"_id": ObjectId(doc["owner_id"])})
    business = (owner or {}).get("business_name") or (owner or {}).get("name") or "MS Soluções Financeiras"
    return {
        "business_name": business,
        "client_name": doc["name"],
        "client_phone": doc.get("phone", ""),
        "installment_number": inst["number"],
        "installments_count": doc.get("installments_count", 1),
        "amount_due": inst["amount"],
        "paid_amount": inst.get("paid_amount") or inst["amount"],
        "paid_at": inst.get("paid_at"),
        "payment_method": inst.get("payment_method"),
        "note": inst.get("note", ""),
        "loan_amount": doc["loan_amount"],
        "collection_method": doc["collection_method"],
        "receipt_token": token,
    }


# -----------------------------------------------------------------------------
# Admin endpoints (visíveis apenas para role=admin)
# -----------------------------------------------------------------------------
def _require_admin(user: dict):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador.")


@api_router.get("/admin/users")
async def admin_list_users(user: dict = Depends(get_current_user)):
    _require_admin(user)
    users = await db.users.find({}, {"password_hash": 0}).sort("created_at", -1).to_list(500)
    # Enrich with client counts + totals
    results = []
    for u in users:
        uid = str(u["_id"])
        clients = [serialize_client(d) async for d in db.clients.find({"owner_id": uid})]
        total_lent = round(sum(c["loan_amount"] for c in clients), 2)
        total_paid = round(sum(c["total_paid"] for c in clients), 2)
        balance = round(sum(c["balance"] for c in clients), 2)
        results.append({
            "id": uid,
            "email": u.get("email"),
            "name": u.get("name", ""),
            "business_name": u.get("business_name", ""),
            "role": u.get("role", "owner"),
            "status": u.get("status", "approved"),
            "created_at": u.get("created_at"),
            "clients_count": len(clients),
            "total_lent": total_lent,
            "total_paid": total_paid,
            "balance": balance,
        })
    return {"users": results, "total": len(results)}


@api_router.patch("/admin/users/{user_id}/status")
async def admin_change_status(user_id: str, body: ApprovalIn, user: dict = Depends(get_current_user)):
    _require_admin(user)
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Você não pode alterar o próprio status.")
    target = await db.users.find_one({"_id": oid(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    previous = target.get("status", "approved")
    await db.users.update_one({"_id": oid(user_id)}, {"$set": {"status": body.status}})

    # Notifica o solicitante apenas quando muda para approved/rejected
    if body.status != previous and body.status in ("approved", "rejected"):
        try:
            recipient = (target.get("email") or "").lower()
            name = escape(target.get("name") or recipient)
            if body.status == "approved":
                html = _wrap_email(
                    "Cadastro aprovado 🎉",
                    f"<p>Olá {name},</p>"
                    f"<p>Boas notícias! Seu painel em <strong>MS Soluções Financeiras</strong> foi "
                    f"aprovado pelo administrador.</p>"
                    f"<p>Você já pode entrar com o e-mail cadastrado e começar a registrar seus clientes.</p>",
                    cta_url=f"{FRONTEND_URL}/login",
                    cta_text="Entrar no painel",
                )
                subject = "Seu painel foi aprovado — MS Soluções Financeiras"
            else:
                html = _wrap_email(
                    "Cadastro não aprovado",
                    f"<p>Olá {name},</p>"
                    f"<p>Informamos que sua solicitação de painel em <strong>MS Soluções Financeiras</strong> "
                    f"não foi aprovada no momento.</p>"
                    f"<p>Se acredita que houve engano, responda a este email que o administrador pode "
                    f"revisar sua solicitação.</p>",
                )
                subject = "Sobre seu cadastro em MS Soluções Financeiras"
            if recipient:
                await send_email(to=recipient, subject=subject, html=html)
        except Exception as e:
            logger.error("Falha ao notificar mudança de status: %s", e)

    return {"ok": True, "status": body.status}


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, user: dict = Depends(get_current_user)):
    _require_admin(user)
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Você não pode excluir sua própria conta.")
    target = await db.users.find_one({"_id": oid(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    await db.clients.delete_many({"owner_id": user_id})
    await db.users.delete_one({"_id": oid(user_id)})
    return {"ok": True}


# -----------------------------------------------------------------------------
# Startup
# -----------------------------------------------------------------------------
async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower().strip()
    password = os.environ["ADMIN_PASSWORD"]
    name = os.environ.get("ADMIN_NAME", "Admin")
    business = os.environ.get("ADMIN_BUSINESS_NAME", "MS Soluções Financeiras")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "email": email,
            "password_hash": hash_password(password),
            "name": name,
            "business_name": business,
            "role": "admin",
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin user {email}")
    else:
        updates = {}
        if existing.get("role") != "admin":
            updates["role"] = "admin"
        if existing.get("status") != "approved":
            updates["status"] = "approved"
        if updates:
            await db.users.update_one({"email": email}, {"$set": updates})
            logger.info(f"Ensured admin flags on {email}")


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

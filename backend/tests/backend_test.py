"""Backend tests for MS Soluções Financeiras iteration 2 (register, chart, reports, receipts, multi-tenant)."""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fallback read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "janinnemoreira1@gmail.com"
ADMIN_PASSWORD = "Credi@2026!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def new_user():
    """Register a fresh user for isolation tests."""
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "Passw0rd!"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": pwd, "name": "Test User", "business_name": "Test Biz"
    })
    assert r.status_code == 200, r.text
    return {"session": s, "email": email, "password": pwd, "body": r.json()}


# ---------- REGISTER ----------
class TestRegister:
    def test_register_returns_cookies_and_data(self, new_user):
        s = new_user["session"]
        # cookies set
        assert s.cookies.get("access_token")
        data = new_user["body"]
        assert data["email"] == new_user["email"].lower()
        assert data["business_name"] == "Test Biz"
        # /me works with cookies
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == new_user["email"].lower()

    def test_register_short_password_returns_400(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"TEST_{uuid.uuid4().hex[:8]}@x.com", "password": "12345", "name": "x"
        })
        assert r.status_code == 400

    def test_register_duplicate_email_returns_400(self, new_user):
        r = requests.post(f"{API}/auth/register", json={
            "email": new_user["email"], "password": "Passw0rd!", "name": "dup"
        })
        assert r.status_code == 400


# ---------- LOGIN REGRESSION ----------
class TestLogin:
    def test_admin_login_returns_business_name_field(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "business_name" in data


# ---------- CHART ----------
class TestChart:
    def test_chart_returns_6_buckets(self, admin_session):
        r = admin_session.get(f"{API}/dashboard/chart", params={"months": 6})
        assert r.status_code == 200
        buckets = r.json()["buckets"]
        assert len(buckets) == 6
        for b in buckets:
            assert set(["key", "label", "recebido", "previsto"]).issubset(b.keys())

    def test_chart_requires_auth(self):
        r = requests.get(f"{API}/dashboard/chart", params={"months": 6})
        assert r.status_code == 401


# ---------- MONTHLY REPORT ----------
class TestMonthlyReport:
    def test_monthly_report_ok(self, admin_session):
        r = admin_session.get(f"{API}/reports/monthly", params={"year": 2026, "month": 1})
        assert r.status_code == 200
        data = r.json()
        for k in ["total_received", "total_expected", "outstanding", "received", "expected"]:
            assert k in data

    def test_monthly_report_invalid_month_0(self, admin_session):
        r = admin_session.get(f"{API}/reports/monthly", params={"year": 2026, "month": 0})
        assert r.status_code == 400

    def test_monthly_report_invalid_month_13(self, admin_session):
        r = admin_session.get(f"{API}/reports/monthly", params={"year": 2026, "month": 13})
        assert r.status_code == 400

    def test_monthly_report_requires_auth(self):
        r = requests.get(f"{API}/reports/monthly", params={"year": 2026, "month": 1})
        assert r.status_code == 401


# ---------- RECEIPTS + PAYMENT TOKEN + MULTI-TENANT ----------
class TestReceiptsAndMultiTenant:
    def test_payment_generates_receipt_token_and_public_access(self, new_user):
        s = new_user["session"]
        # create client for this new user
        client_body = {
            "name": "TEST_ReceiptClient",
            "phone": "11999998888",
            "loan_amount": 1000.0,
            "loan_date": "2026-01-01",
            "interest_rate": 10.0,
            "collection_method": "parcelado",
            "collection_frequency": "mensal",
            "installments_count": 2,
            "first_payment_date": "2026-02-01",
        }
        rc = s.post(f"{API}/clients", json=client_body)
        assert rc.status_code == 200, rc.text
        client = rc.json()
        client_id = client["id"]

        # register payment on installment 1
        pay = s.post(f"{API}/clients/{client_id}/payments", json={
            "installment_number": 1, "paid_amount": 550.0,
            "paid_at": "2026-02-05", "payment_method": "pix", "note": "test"
        })
        assert pay.status_code == 200, pay.text

        # get client fresh to inspect receipt_token
        got = s.get(f"{API}/clients/{client_id}").json()
        inst1 = next(i for i in got["installments"] if i["number"] == 1)
        token = inst1.get("receipt_token")
        assert token, f"receipt_token missing: {inst1}"

        # PUBLIC access with no cookies
        pub = requests.get(f"{API}/receipts/{token}")
        assert pub.status_code == 200, pub.text
        rdata = pub.json()
        assert rdata["client_name"] == "TEST_ReceiptClient"
        assert rdata["paid_amount"] == 550.0
        assert rdata["payment_method"] == "pix"
        assert rdata["installment_number"] == 1
        assert rdata["installments_count"] == 2
        assert rdata["loan_amount"] == 1000.0
        assert rdata["business_name"]  # non-empty

        # multi-tenant: admin session should NOT see this client
        admin_s = requests.Session()
        admin_s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        admin_list = admin_s.get(f"{API}/clients").json()
        assert not any(c["id"] == client_id for c in admin_list)
        # direct GET should 404
        r404 = admin_s.get(f"{API}/clients/{client_id}")
        assert r404.status_code == 404

        # cleanup
        s.delete(f"{API}/clients/{client_id}")

    def test_receipt_token_not_found(self):
        r = requests.get(f"{API}/receipts/nonexistent-token-abc")
        assert r.status_code == 404


# ---------- CLEANUP: remove TEST_ users ----------
def test_zzz_cleanup_test_users():
    # Best-effort cleanup via Mongo (this test always passes; cleanup is not critical)
    try:
        import motor.motor_asyncio  # noqa
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient

        async def clean():
            cli = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = cli[os.environ.get("DB_NAME", "test_database")]
            await db.users.delete_many({"email": {"$regex": "^TEST_"}})
            cli.close()

        # only run if we have env
        if os.environ.get("MONGO_URL"):
            asyncio.get_event_loop().run_until_complete(clean())
    except Exception:
        pass

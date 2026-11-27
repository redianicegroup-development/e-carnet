from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.billing import services
from apps.billing.models import Invoice
from apps.care.tests import make_clinic_doctor
from apps.establishments.models import Establishment, EstablishmentAdministrator
from apps.patients.models import PatientProfile

from .account_state import delete_old_login_events
from .models import AccountActionRequest, AccountProfile, LoginEvent

User = get_user_model()
PASSWORD = "Test-password-2026!"
USERS = "/api/v1/identity/admin/users/"
OVERVIEW = "/api/v1/identity/admin/overview/"
LOGIN_EVENTS = "/api/v1/identity/admin/login-events/"
LOGIN = "/api/v1/identity/login/"


def make_user(email, first="Prénom", last="Nom", **extra):
    return User.objects.create_user(username=email, email=email, password=PASSWORD, first_name=first, last_name=last, **extra)


class AdminConsoleBase(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username="root@example.test", email="root@example.test", password=PASSWORD, first_name="Équipe", last_name="Console")
        self.client = APIClient()
        self.client.force_authenticate(self.admin)


class AdminUsersListTests(AdminConsoleBase):
    def test_only_a_superadmin_can_use_the_user_console(self):
        member = make_user("membre@example.test")
        staff = make_user("staff@example.test", is_staff=True)
        for user in (None, member, staff):
            client = APIClient()
            if user:
                client.force_authenticate(user)
            for url in (USERS, OVERVIEW, LOGIN_EVENTS):
                self.assertIn(client.get(url).status_code, (401, 403), url)
            self.assertIn(client.post(f"{USERS}{member.pk}/status/", {"action": "deactivate"}, format="json").status_code, (401, 403))
        member.refresh_from_db()
        self.assertTrue(member.is_active)

    def test_list_shows_roles_structures_state_and_summary_counts(self):
        patient_user = make_user("awa@example.test", "Awa", "Koné")
        PatientProfile.objects.create(user=patient_user, first_name="Awa", last_name="Koné")
        doctor, profile, establishment = make_clinic_doctor(self.admin, "liste")
        lab = Establishment.objects.create(created_by=self.admin, name="Labo Test", establishment_type="Laboratoire", city="Abidjan", address="A", phone="0", email="labo@test", responsible_name="R", status="active", is_laboratory=True)
        lab_admin = make_user("labo@example.test", "Lab", "Admin")
        EstablishmentAdministrator.objects.create(establishment=lab, user=lab_admin, assigned_by=self.admin)
        site_admin = make_user("admin-site@example.test", "Site", "Admin")
        EstablishmentAdministrator.objects.create(establishment=establishment, user=site_admin, assigned_by=self.admin)
        patient_user.last_login = timezone.now() - timedelta(days=2)
        patient_user.save(update_fields=("last_login",))
        anchor = User.objects.create_user(username="deleted-abc", email="")  # ancre anonyme : jamais listée

        data = self.client.get(USERS).data["data"]
        self.assertEqual(data["summary"]["total"], 5)  # admin + patient + médecin + 2 administrateurs
        self.assertEqual(data["summary"]["active"], 1)
        self.assertEqual(data["summary"]["disabled"], 0)
        rows = {row["email"]: row for row in data["items"]}
        self.assertNotIn(anchor.pk, {row["id"] for row in data["items"]})
        self.assertEqual([role["code"] for role in rows["awa@example.test"]["roles"]], ["patient"])
        self.assertEqual(rows["awa@example.test"]["state"], "active")
        doctor_row = next(row for row in data["items"] if row["id"] == doctor.pk)
        self.assertEqual((doctor_row["roles"][0]["code"], doctor_row["roles"][0]["detail"]), ("professional", "Clinique liste"))
        self.assertEqual([role["code"] for role in rows["labo@example.test"]["roles"]], ["laboratory"])
        self.assertEqual(rows["labo@example.test"]["roles"][0]["detail"], "Labo Test")
        self.assertEqual([role["code"] for role in rows["admin-site@example.test"]["roles"]], ["establishment"])
        self.assertTrue(rows["root@example.test"]["protected"])
        for row in data["items"]:
            for forbidden in ("password", "avatar_data", "recovery_answer_hash"):
                self.assertNotIn(forbidden, row)

    def test_search_and_filters(self):
        awa = make_user("awa@example.test", "Awa", "Koné")
        PatientProfile.objects.create(user=awa, first_name="Awa", last_name="Koné")
        yao = make_user("yao@example.test", "Yao", "Traoré")
        yao.is_active = False
        yao.save(update_fields=("is_active",))
        make_user("sans-role@example.test", "Sans", "Rôle")

        def emails(**params):
            return sorted(item["email"] for item in self.client.get(USERS, params).data["data"]["items"])

        self.assertEqual(emails(q="kon"), ["awa@example.test"])
        self.assertEqual(emails(q="YAO@"), ["yao@example.test"])
        self.assertEqual(emails(role="patient"), ["awa@example.test"])
        self.assertEqual(emails(role="staff"), ["root@example.test"])
        self.assertEqual(emails(status="disabled"), ["yao@example.test"])
        self.assertNotIn("yao@example.test", emails(status="inactive"))
        self.assertIn("sans-role@example.test", emails(status="inactive"))
        self.assertEqual(emails(role="inconnu", q="awa"), ["awa@example.test"])  # filtre invalide ignoré

    def test_pagination(self):
        for index in range(7):
            make_user(f"page{index}@example.test", f"P{index}", "X")
        first = self.client.get(USERS, {"limit": 3}).data["data"]
        self.assertEqual((len(first["items"]), first["has_more"], first["total"]), (3, True, 8))
        last = self.client.get(USERS, {"limit": 3, "offset": 6}).data["data"]
        self.assertEqual((len(last["items"]), last["has_more"]), (2, False))
        self.assertEqual(len(self.client.get(USERS, {"limit": "abc", "offset": "-4"}).data["data"]["items"]), 8)


class AdminUserStatusTests(AdminConsoleBase):
    def setUp(self):
        super().setUp()
        self.member = make_user("membre@example.test", "Membre", "Test")

    def url(self, user=None, tail="status/"):
        return f"{USERS}{(user or self.member).pk}/{tail}"

    def test_deactivation_closes_sessions_blocks_login_and_is_audited(self):
        session_client = APIClient()
        self.assertEqual(session_client.post(LOGIN, {"email": "membre@example.test", "password": PASSWORD}, format="json").status_code, 200)
        self.assertEqual(session_client.get("/api/v1/identity/me/").status_code, 200)

        response = self.client.post(self.url(), {"action": "deactivate"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["state"], "disabled")
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_active)
        self.assertIsNotNone(AccountProfile.objects.get(user=self.member).staff_deactivated_at)
        self.assertEqual(session_client.get("/api/v1/identity/me/").status_code, 403, "toutes les sessions sont fermées")
        blocked = APIClient().post(LOGIN, {"email": "membre@example.test", "password": PASSWORD}, format="json")
        self.assertEqual((blocked.status_code, blocked.data["code"]), (403, "account_deactivated"))
        self.assertTrue(AuditEvent.objects.filter(event_type="admin.account.deactivated", actor=self.admin).exists())

        again = self.client.post(self.url(), {"action": "reactivate"}, format="json")
        self.assertEqual(again.data["data"]["state"], "active")
        self.assertEqual(APIClient().post(LOGIN, {"email": "membre@example.test", "password": PASSWORD}, format="json").status_code, 200)
        self.assertTrue(AuditEvent.objects.filter(event_type="admin.account.reactivated", actor=self.admin).exists())

    def test_audit_never_records_the_identity_of_the_account(self):
        self.client.post(self.url(), {"action": "deactivate"}, format="json")
        event = AuditEvent.objects.get(event_type="admin.account.deactivated")
        self.assertEqual(event.metadata, {"action": "deactivate"})
        self.assertNotIn("membre", str(event.metadata))

    def test_guardrails_self_staff_unknown_action_and_unknown_account(self):
        self.assertEqual(self.client.post(self.url(self.admin), {"action": "deactivate"}, format="json").status_code, 409)
        other_admin = User.objects.create_superuser(username="autre@example.test", email="autre@example.test", password=PASSWORD)
        self.assertEqual(self.client.post(self.url(other_admin), {"action": "deactivate"}, format="json").status_code, 403)
        staff = make_user("staff@example.test", is_staff=True)
        self.assertEqual(self.client.post(self.url(staff), {"action": "deactivate"}, format="json").status_code, 403)
        self.assertEqual(self.client.post(self.url(), {"action": "bannir"}, format="json").status_code, 400)
        self.assertEqual(self.client.post(f"{USERS}999999/status/", {"action": "deactivate"}, format="json").status_code, 404)
        anchor = User.objects.create_user(username="deleted-xyz", email="")
        self.assertEqual(self.client.post(self.url(anchor), {"action": "reactivate"}, format="json").status_code, 404)
        for user in (self.admin, other_admin, staff, self.member):
            user.refresh_from_db()
            self.assertTrue(user.is_active)

    def test_a_staff_deactivation_is_never_lifted_by_the_end_of_a_suspension(self):
        now = timezone.now()
        AccountActionRequest.objects.create(user=self.member, request_type="suspension", suspension_days=7, reason="privacy", status="resolved", suspended_until=now - timedelta(minutes=5))
        self.client.post(self.url(), {"action": "deactivate"}, format="json")
        blocked = APIClient().post(LOGIN, {"email": "membre@example.test", "password": PASSWORD}, format="json")
        self.assertEqual((blocked.status_code, blocked.data["code"]), (403, "account_deactivated"))
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_active)

    def test_reactivation_by_the_team_also_lifts_a_running_suspension(self):
        now = timezone.now()
        item = AccountActionRequest.objects.create(user=self.member, request_type="suspension", suspension_days=30, reason="privacy", status="resolved", suspended_until=now + timedelta(days=30))
        self.member.is_active = False
        self.member.save(update_fields=("is_active",))
        listed = next(row for row in self.client.get(USERS).data["data"]["items"] if row["email"] == "membre@example.test")
        self.assertEqual(listed["state"], "suspended")
        self.client.post(self.url(), {"action": "reactivate"}, format="json")
        item.refresh_from_db()
        self.member.refresh_from_db()
        self.assertTrue(self.member.is_active)
        self.assertIsNotNone(item.lifted_at)

    def test_revoke_sessions_logs_the_person_out_but_keeps_the_account_open(self):
        session_client = APIClient()
        session_client.post(LOGIN, {"email": "membre@example.test", "password": PASSWORD}, format="json")
        response = self.client.post(self.url(tail="sessions/revoke/"), {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data["data"]["closed"], 1)
        self.assertEqual(session_client.get("/api/v1/identity/me/").status_code, 403)
        self.member.refresh_from_db()
        self.assertTrue(self.member.is_active)
        self.assertTrue(AuditEvent.objects.filter(event_type="admin.account.sessions_revoked").exists())
        self.assertEqual(self.client.post(self.url(self.admin, "sessions/revoke/"), {}, format="json").status_code, 409)


class LoginJournalTests(AdminConsoleBase):
    def test_journal_records_success_failure_and_blocked_without_ip_or_device(self):
        member = make_user("membre@example.test", "Membre", "Test")
        APIClient().post(LOGIN, {"email": "membre@example.test", "password": PASSWORD}, format="json")
        APIClient().post(LOGIN, {"email": "membre@example.test", "password": "mauvais-mot-de-passe"}, format="json")
        APIClient().post(LOGIN, {"email": "inconnu@example.test", "password": "n-importe-quoi"}, format="json")
        member.is_active = False
        member.save(update_fields=("is_active",))
        APIClient().post(LOGIN, {"email": "membre@example.test", "password": PASSWORD}, format="json")

        data = self.client.get(LOGIN_EVENTS).data["data"]
        self.assertEqual(data["summary_24h"], {"success": 1, "failure": 2, "blocked": 1})
        outcomes = [item["outcome"] for item in data["items"]]
        self.assertEqual(sorted(outcomes), ["blocked", "failure", "failure", "success"])
        unknown = [item for item in data["items"] if item["user"] is None]
        self.assertEqual(len(unknown), 1, "une adresse inconnue n'est jamais conservée")
        self.assertEqual(set(data["items"][0]), {"id", "outcome", "method", "created_at", "user"})
        only_failures = self.client.get(LOGIN_EVENTS, {"outcome": "failure"}).data["data"]["items"]
        self.assertEqual({item["outcome"] for item in only_failures}, {"failure"})

    def test_old_events_are_deleted_after_ninety_days(self):
        fresh = LoginEvent.objects.create(outcome="success")
        old = LoginEvent.objects.create(outcome="success")
        LoginEvent.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=91))
        self.assertEqual(delete_old_login_events(), 1)
        self.assertEqual(list(LoginEvent.objects.values_list("pk", flat=True)), [fresh.pk])


class AdminOverviewTests(AdminConsoleBase):
    def test_overview_counts_users_billing_alerts_and_charts_without_health_data(self):
        member = make_user("membre@example.test")
        PatientProfile.objects.create(user=member, first_name="M", last_name="T")
        member.last_login = timezone.now() - timedelta(days=1)
        member.save(update_fields=("last_login",))
        closed = make_user("ferme@example.test")
        closed.is_active = False
        closed.save(update_fields=("is_active",))
        site = Establishment.objects.create(created_by=self.admin, name="Clinique A", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="a@test", responsible_name="R", status="active")
        Establishment.objects.create(created_by=self.admin, name="Clinique B", establishment_type="Clinique", city="Abidjan", address="A", phone="0", email="b@test", responsible_name="R", status="suspended")
        site_admin = make_user("admin-a@example.test")
        EstablishmentAdministrator.objects.create(establishment=site, user=site_admin, assigned_by=self.admin)
        site_admin_client = APIClient()
        site_admin_client.force_authenticate(site_admin)
        self.assertEqual(site_admin_client.post("/api/v1/billing/establishment/subscribe/", {"offer": "essentiel"}, format="json").status_code, 201)
        invoice = Invoice.objects.get(establishment=site)
        services.confirm_payment(invoice.id, method="wave", provider="manual", provider_reference="TX-OVERVIEW", amount_fcfa=invoice.amount_fcfa, confirmed_by=self.admin)
        for _ in range(11):
            LoginEvent.objects.create(outcome="failure")
        AuditEvent.objects.create(event_type="care.consultation.signed", actor_role="professional", metadata={})

        data = self.client.get(OVERVIEW).data["data"]
        users = data["users"]
        self.assertEqual((users["total"], users["disabled"], users["active_30d"], users["patients"], users["establishment_admins"]), (4, 1, 1, 1, 1))
        self.assertEqual(users["active_30d"] + users["inactive"] + users["disabled"], users["total"])
        self.assertEqual(data["establishments"], {"total": 2, "active": 1, "suspended": 1, "laboratories": 0})
        self.assertEqual(data["billing"]["transactions_total"], 1)
        self.assertEqual(data["billing"]["revenue_total_fcfa"], 20000)
        self.assertEqual(data["billing"]["subscriptions_active"], 1)
        alert_ids = {alert["id"] for alert in data["alerts"]}
        self.assertTrue({"suspended", "failed-logins", "disabled"} <= alert_ids)
        self.assertEqual(len(data["registrations_daily"]), 30)
        self.assertEqual(sum(day["count"] for day in data["registrations_daily"]), 4)  # les 4 comptes réels créés aujourd'hui
        self.assertEqual(data["recent_activity"][0]["event_type"], "care.consultation.signed")
        self.assertEqual(set(data["recent_activity"][0]), {"event_type", "actor_role", "created_at"}, "le contenu des événements n'est jamais montré")

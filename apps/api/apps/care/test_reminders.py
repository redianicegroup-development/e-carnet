from datetime import date
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.patients.models import PatientProfile
from .models import MedicationIntake, MedicationReminder, MedicationReminderDispatch, PatientNotification

User = get_user_model()
NOW = "2026-10-28T08:00:00+00:00"  # Africa/Abidjan = UTC+0 : 08:00 local


class SendDueRemindersTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="rappel-patient", password="local-test-password")
        self.profile = PatientProfile.objects.create(user=self.user)

    def reminder(self, **kwargs):
        defaults = {"patient": self.profile, "name": "Doliprane", "dosage": "1 g", "times": ["08:00"], "starts_on": date(2026, 10, 1)}
        return MedicationReminder.objects.create(**{**defaults, **kwargs})

    def run_command(self, now=NOW):
        call_command("send_due_reminders", now=now, stdout=StringIO())

    def test_due_reminder_creates_one_in_app_notification_and_never_an_intake(self):
        self.reminder()
        self.run_command()
        notification = PatientNotification.objects.get()
        self.assertEqual(notification.kind, "medication.reminder")
        self.assertIn("Doliprane", notification.body)  # le détail reste dans l'application (authentifiée)
        self.assertEqual(MedicationIntake.objects.count(), 0)  # l'observance n'est pas polluée

    def test_rerun_is_idempotent(self):
        self.reminder()
        self.run_command(); self.run_command(); self.run_command("2026-10-28T08:03:00+00:00")
        self.assertEqual(PatientNotification.objects.count(), 1)
        self.assertEqual(MedicationReminderDispatch.objects.count(), 1)

    def test_catch_up_window(self):
        self.reminder()
        self.run_command("2026-10-28T08:07:00+00:00")   # exécution en retard de 7 min : rattrapée
        self.assertEqual(PatientNotification.objects.count(), 1)
        other = self.reminder(name="Autre", times=["07:30"])
        self.run_command()                                # 30 min de retard : trop tard, on n'envoie pas
        self.assertFalse(PatientNotification.objects.filter(metadata__reminder_id=str(other.pk)).exists())

    def test_not_due_yet_or_outside_dates_or_inactive_or_out_of_stock(self):
        self.reminder(times=["09:00"])
        self.reminder(name="Futur", starts_on=date(2026, 11, 1))
        self.reminder(name="Fini", ends_on=date(2026, 10, 27))
        self.reminder(name="Inactif", active=False)
        self.reminder(name="Épuisé", stock_remaining=0)
        self.run_command()
        self.assertEqual(PatientNotification.objects.count(), 0)

    def test_timezone_is_configurable_and_global_time_zone_untouched(self):
        self.reminder()
        with override_settings(ECARNET_REMINDER_TIMEZONE="Europe/Paris"):
            self.run_command()                            # 08:00 UTC = 09:00 Paris : pas dû
            self.assertEqual(PatientNotification.objects.count(), 0)
            self.run_command("2026-10-28T07:00:00+00:00") # 08:00 Paris (hiver, UTC+1) : dû
            self.assertEqual(PatientNotification.objects.count(), 1)
        from django.conf import settings
        self.assertEqual(settings.TIME_ZONE, "UTC")

    def test_slot_crossing_midnight(self):
        self.reminder(times=["23:58"])
        self.run_command("2026-10-29T00:03:00+00:00")     # le créneau de la veille est rattrapé
        self.assertEqual(PatientNotification.objects.count(), 1)

    def test_already_confirmed_slot_is_not_notified(self):
        reminder = self.reminder()
        from django.utils.dateparse import parse_datetime
        MedicationIntake.objects.create(reminder=reminder, scheduled_for=parse_datetime(NOW), status="taken")
        self.run_command()
        self.assertEqual(PatientNotification.objects.count(), 0)

    def test_invalid_time_strings_and_patients_without_account_are_ignored(self):
        self.reminder(times=["ab:cd", "99:99", "08:00"])
        orphan = PatientProfile.objects.create()
        MedicationReminder.objects.create(patient=orphan, name="Sans compte", times=["08:00"], starts_on=date(2026, 10, 1))
        self.run_command()
        self.assertEqual(PatientNotification.objects.count(), 1)

    def test_dry_run_writes_nothing(self):
        self.reminder()
        call_command("send_due_reminders", now=NOW, dry_run=True, stdout=StringIO())
        self.assertEqual(PatientNotification.objects.count(), 0)
        self.assertEqual(MedicationReminderDispatch.objects.count(), 0)

    def test_weekdays_limit_the_days_a_reminder_is_sent(self):
        wednesday = date(2026, 10, 28).weekday()
        self.reminder(name="Autre jour", days_of_week=[(wednesday + 1) % 7])
        self.run_command()
        self.assertEqual(PatientNotification.objects.count(), 0)
        self.reminder(name="Bon jour", days_of_week=[wednesday, (wednesday + 3) % 7])
        self.run_command()
        self.assertEqual(PatientNotification.objects.filter(kind="medication.reminder").count(), 1)

    def test_empty_weekdays_means_every_day(self):
        self.reminder(days_of_week=[])
        self.run_command()
        self.assertEqual(PatientNotification.objects.filter(kind="medication.reminder").count(), 1)

    def test_renewal_notice_is_sent_once_before_the_end_date_without_medicine_name(self):
        self.reminder(name="Amoxicilline", times=["09:00"], ends_on=date(2026, 10, 30))
        self.reminder(name="Loin", times=["09:00"], ends_on=date(2026, 11, 20))
        self.reminder(name="Inactif", times=["09:00"], ends_on=date(2026, 10, 30), active=False)
        self.run_command(); self.run_command(); self.run_command("2026-10-29T08:00:00+00:00")
        notices = PatientNotification.objects.filter(kind="medication.renewal")
        self.assertEqual(notices.count(), 1)
        self.assertNotIn("Amoxicilline", notices.get().title + notices.get().body)

    @override_settings(ECARNET_REMINDER_RENEWAL_DAYS=0)
    def test_renewal_notice_can_be_disabled(self):
        self.reminder(times=["09:00"], ends_on=date(2026, 10, 30))
        self.run_command()
        self.assertFalse(PatientNotification.objects.filter(kind="medication.renewal").exists())

    def test_api_accepts_weekdays_and_refuses_invalid_ones(self):
        from rest_framework.test import APIClient
        client = APIClient(); client.force_authenticate(self.user)
        url = "/api/v1/patient/care/medication-reminders/"
        base = {"name": "Vitamine", "times": ["08:00"], "starts_on": "2026-10-01"}
        created = client.post(url, {**base, "days_of_week": [2, 0]}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["data"]["days_of_week"] if "data" in created.data else created.data["days_of_week"], [0, 2])
        self.assertEqual(client.post(url, {**base, "days_of_week": [7]}, format="json").status_code, 400)
        self.assertEqual(client.post(url, {**base, "days_of_week": ["lundi"]}, format="json").status_code, 400)


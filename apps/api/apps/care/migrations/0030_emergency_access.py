import uuid

import django.db.models.deletion
import django.db.models.expressions
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """ACS-13 — accès d’urgence « bris de glace » : deux tables nouvelles, aucune donnée existante touchée (expand seul, sans risque de retour arrière)."""

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("care", "0029_consultation_seal_assets"),
        ("establishments", "0016_establishmentnotification"),
        ("patients", "0013_patientaccesssummarypreference"),
        ("professionals", "0004_professionalprofile_credentials"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmergencyAccessRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("professional_name", models.CharField(max_length=180)),
                ("facility_label", models.CharField(max_length=180)),
                ("reason_category", models.CharField(choices=[("unconscious", "Patient inconscient"), ("vital_danger", "Danger vital immédiat"), ("cannot_consent", "Patient dans l’incapacité de consentir, urgence médicale")], max_length=24)),
                ("reason_note", models.CharField(max_length=280)),
                ("requested_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("expires_at", models.DateTimeField()),
                ("review_due_at", models.DateTimeField()),
                ("establishment", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="emergency_access_requests", to="establishments.establishment")),
                ("patient", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="emergency_access_requests", to="patients.patientprofile")),
                ("professional", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="emergency_access_requests", to="professionals.professionalprofile")),
            ],
            options={"ordering": ("-requested_at",)},
        ),
        migrations.CreateModel(
            name="EmergencyAccessReview",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("outcome", models.CharField(choices=[("justified", "Justifié"), ("unjustified", "Non justifié : abus à signaler")], max_length=16)),
                ("note", models.CharField(blank=True, default="", max_length=500)),
                ("reviewed_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("emergency_access", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="review", to="care.emergencyaccessrequest")),
                ("reviewed_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="emergency_access_reviews", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-reviewed_at",)},
        ),
        migrations.AddIndex(model_name="emergencyaccessrequest", index=models.Index(fields=["establishment", "requested_at"], name="emg_acc_est_req_idx")),
        migrations.AddIndex(model_name="emergencyaccessrequest", index=models.Index(fields=["patient", "requested_at"], name="emg_acc_pt_req_idx")),
        migrations.AddIndex(model_name="emergencyaccessrequest", index=models.Index(fields=["professional", "patient", "requested_at"], name="emg_acc_pro_pt_req_idx")),
        migrations.AddConstraint(model_name="emergencyaccessrequest", constraint=models.CheckConstraint(condition=models.Q(("reason_category__in", ("unconscious", "vital_danger", "cannot_consent"))), name="emg_acc_reason_category_ck")),
        migrations.AddConstraint(model_name="emergencyaccessrequest", constraint=models.CheckConstraint(condition=models.Q(("reason_note__gt", "")), name="emg_acc_reason_note_required_ck")),
        migrations.AddConstraint(model_name="emergencyaccessrequest", constraint=models.CheckConstraint(condition=models.Q(("expires_at__gt", django.db.models.expressions.F("requested_at"))), name="emg_acc_expiry_after_start_ck")),
        migrations.AddConstraint(model_name="emergencyaccessreview", constraint=models.CheckConstraint(condition=models.Q(("outcome__in", ("justified", "unjustified"))), name="emg_rev_outcome_ck")),
        migrations.AddConstraint(model_name="emergencyaccessreview", constraint=models.CheckConstraint(condition=models.Q(("outcome", "justified"), ("note__gt", ""), _connector="OR"), name="emg_rev_unjustified_note_ck")),
    ]

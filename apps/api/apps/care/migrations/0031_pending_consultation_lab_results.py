"""PRO-21 : consultation en attente de résultats + dépôt de résultat par un laboratoire."""
import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("care", "0030_emergency_access"),
        ("establishments", "0017_establishment_laboratory"),
        ("patients", "0001_initial"),
        ("professionals", "0004_professionalprofile_credentials"),
    ]

    operations = [
        migrations.CreateModel(
            name="PendingConsultation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("draft", models.JSONField(blank=True, default=dict)),
                ("status", models.CharField(choices=[("waiting_results", "En attente de résultats"), ("to_resume", "À reprendre"), ("completed", "Signée"), ("cancelled", "Annulée")], default="waiting_results", max_length=16)),
                ("qr_version", models.PositiveSmallIntegerField(default=1)),
                ("qr_expires_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("consultation", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="pending_origin", to="care.consultation")),
                ("establishment", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="pending_consultations", to="establishments.establishment")),
                ("patient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pending_consultations", to="patients.patientprofile")),
                ("professional", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="pending_consultations", to="professionals.professionalprofile")),
                ("source_encounter", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="pending_consultations", to="care.careencounter")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.CreateModel(
            name="PendingExam",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("position", models.PositiveSmallIntegerField(default=0)),
                ("kind", models.CharField(choices=[("analysis", "Analyse biologique"), ("imaging", "Imagerie"), ("other", "Autre examen")], max_length=16)),
                ("label", models.CharField(max_length=160)),
                ("status", models.CharField(choices=[("requested", "Demandé"), ("result_received", "Résultat reçu"), ("abandoned", "Abandonné")], default="requested", max_length=16)),
                ("result_received_at", models.DateTimeField(blank=True, null=True)),
                ("abandon_reason", models.CharField(blank=True, default="", max_length=240)),
                ("abandoned_at", models.DateTimeField(blank=True, null=True)),
                ("lab_establishment", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="lab_pending_exams", to="establishments.establishment")),
                ("pending", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="exams", to="care.pendingconsultation")),
                ("proof_document", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="pending_exam_proofs", to="care.medicaldocument")),
            ],
            options={"ordering": ("position",)},
        ),
        migrations.AddIndex(model_name="pendingconsultation", index=models.Index(fields=["patient", "status"], name="care_pend_patient_st_idx")),
        migrations.AddIndex(model_name="pendingconsultation", index=models.Index(fields=["professional", "status"], name="care_pend_prof_st_idx")),
        migrations.AddConstraint(
            model_name="pendingconsultation",
            constraint=models.UniqueConstraint(condition=models.Q(("status__in", ("waiting_results", "to_resume"))), fields=("source_encounter",), name="care_pending_one_open_per_encounter"),
        ),
        migrations.AddField(model_name="medicaldocument", name="pending_exam", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="result_documents", to="care.pendingexam")),
        migrations.AddField(model_name="medicaldocument", name="lab_depositor", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="lab_deposited_documents", to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name="medicaldocument", name="superseded_by", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="supersedes", to="care.medicaldocument")),
        migrations.RemoveConstraint(model_name="medicaldocument", name="care_md_estab_validator_ck"),
        migrations.AddConstraint(
            model_name="medicaldocument",
            constraint=models.CheckConstraint(
                condition=models.Q(("establishment__isnull", True), models.Q(("professional__isnull", False), ("validated_at__isnull", False)), models.Q(("lab_depositor__isnull", False), ("validated_at__isnull", False)), _connector="OR"),
                name="care_md_estab_validator_ck",
            ),
        ),
    ]

from dataclasses import dataclass

from .models import CareEncounter, Consultation, HealthMeasurement, MedicalDocument, Vaccination


@dataclass(frozen=True)
class EstablishmentCareRecords:
    """Collections cliniques déjà bornées au patient et à l’établissement."""

    preconsultations: object
    consultations: object
    measurements: object
    documents: object
    vaccinations: object


def establishment_care_records(patient, establishment):
    """Retourne uniquement les soins produits ou validés par cet établissement.

    Les déclarations du patient, les imports de documents non validés et les
    soins d’un autre établissement ne font jamais partie de ces collections.
    Les querysets restent séparés car chaque type a son propre serializer et
    son propre schéma.
    """
    return EstablishmentCareRecords(
        preconsultations=(
            CareEncounter.objects.filter(
                patient=patient,
                establishment=establishment,
                status="closed",
            )
            .select_related("establishment", "patient")
            .order_by("-closed_at", "-created_at")
        ),
        consultations=(
            Consultation.objects.filter(patient=patient, establishment=establishment)
            .select_related("professional", "establishment", "access_grant", "patient")
            .prefetch_related("prescription_lines", "exam_requests")
            .order_by("-validated_at")
        ),
        measurements=(
            HealthMeasurement.objects.filter(
                patient=patient,
                establishment=establishment,
                professional__isnull=False,
                validated_at__isnull=False,
            )
            .select_related("professional", "establishment", "patient")
            .order_by("-measured_at", "-created_at")
        ),
        documents=(
            MedicalDocument.objects.filter(
                patient=patient,
                establishment=establishment,
                professional__isnull=False,
                validated_at__isnull=False,
                verified=True,
            )
            .select_related("professional", "establishment", "patient", "exam_request")
            .order_by("-created_at")
        ),
        vaccinations=(
            Vaccination.objects.filter(
                patient=patient,
                establishment=establishment,
                status="confirmed",
                confirmed_by__isnull=False,
                confirmed_at__isnull=False,
            )
            .select_related("establishment", "confirmed_by", "confirmed_by__user", "document")
            .order_by("-administered_on", "-created_at")
        ),
    )

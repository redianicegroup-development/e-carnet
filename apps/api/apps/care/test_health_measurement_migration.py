from importlib import import_module
from decimal import Decimal
from types import SimpleNamespace

from django.test import SimpleTestCase


_migration = import_module("apps.care.migrations.0016_unified_health_measurements")
_convert_vitals = _migration._convert_vitals
_format_pressure = _migration._format_pressure


class HistoricalVitalsMigrationTests(SimpleTestCase):
    def test_plain_patient_values_keep_the_actual_numbers_and_known_legacy_units(self):
        original = {"systolic": 110, "diastolic": 70, "glycemia_g_l": 0.9, "weight_kg": 61.0}
        self.assertEqual(
            _convert_vitals(original),
            {"blood_pressure": "110/70", "glycemia": "0.9 g/L", "weight_kg": 61.0},
        )
        self.assertEqual(original["systolic"], 110)
        self.assertEqual(original["glycemia_g_l"], 0.9)

    def test_signed_values_retain_source_and_do_not_merge_different_provenance_as_preconsultation(self):
        signed = {
            "systolic": {"value": 110, "source": "preconsultation"},
            "diastolic": {"value": 70, "source": "preconsultation"},
            "glycemia_g_l": {"value": 0.9, "source": "professional"},
        }
        self.assertEqual(
            _convert_vitals(signed, nested=True),
            {
                "blood_pressure": {"value": "110/70", "source": "preconsultation"},
                "glycemia": {"value": "0.9 g/L", "source": "professional"},
            },
        )

    def test_mixed_sources_mark_combined_blood_pressure_as_professionally_reviewed(self):
        signed = {
            "systolic": {"value": 110, "source": "preconsultation"},
            "diastolic": {"value": 70, "source": "professional"},
        }
        self.assertEqual(
            _convert_vitals(signed, nested=True),
            {"blood_pressure": {"value": "110/70", "source": "professional"}},
        )

    def test_a_legacy_single_component_is_retained_with_its_label_not_filled_with_an_assumption(self):
        self.assertEqual(_convert_vitals({"systolic": 110}), {"blood_pressure": "Systolique : 110"})

    def test_a_single_nested_component_keeps_its_existing_source(self):
        self.assertEqual(
            _convert_vitals({"systolic": {"value": 110, "source": "preconsultation"}}, nested=True),
            {"blood_pressure": {"value": "Systolique : 110", "source": "preconsultation"}},
        )

    def test_measurement_migration_preserves_only_units_actually_stored(self):
        systolic = SimpleNamespace(value=Decimal("120.00"), unit="mmHg")
        diastolic = SimpleNamespace(value=Decimal("80.00"), unit="mmHg")
        self.assertEqual(_format_pressure(systolic, diastolic), "120/80 mmHg")
        systolic.unit = ""
        diastolic.unit = ""
        self.assertEqual(_format_pressure(systolic, diastolic), "120/80")
        diastolic.unit = "kPa"
        self.assertEqual(_format_pressure(systolic, diastolic), "Systolique : 120; Diastolique : 80 kPa")

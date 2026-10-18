from collections import defaultdict
from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


def _display(value):
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, Decimal):
        return format(value.normalize(), "f")
    return str(value)


def _measurement_value(row):
    value = _display(row.value)
    unit = (row.unit or "").strip()
    return f"{value} {unit}" if unit else value


def _format_pressure(upper, lower):
    if upper and lower:
        upper_unit = (upper.unit or "").strip()
        lower_unit = (lower.unit or "").strip()
        if upper_unit == lower_unit:
            suffix = f" {upper_unit}" if upper_unit else ""
            return f"{_display(upper.value)}/{_display(lower.value)}{suffix}"
        return f"Systolique : {_measurement_value(upper)}; Diastolique : {_measurement_value(lower)}"
    if upper:
        return f"Systolique : {_measurement_value(upper)}"
    return f"Diastolique : {_measurement_value(lower)}"


def _convert_vitals(data, nested=False):
    if not isinstance(data, dict):
        return data
    result = dict(data)

    def unpack(value):
        if nested and isinstance(value, dict) and "value" in value:
            return value.get("value"), value.get("source")
        return value, None

    def pack(value, *sources):
        present_sources = [source for source in sources if source]
        if not nested or not present_sources:
            return value
        source = present_sources[0] if all(item == present_sources[0] for item in present_sources) else "professional"
        return {"value": value, "source": source}

    systolic = result.pop("systolic", None)
    diastolic = result.pop("diastolic", None)
    systolic_value, systolic_source = unpack(systolic)
    diastolic_value, diastolic_source = unpack(diastolic)
    if (systolic_value is not None or diastolic_value is not None) and "blood_pressure" not in result:
        if systolic_value is not None and diastolic_value is not None:
            value = f"{_display(systolic_value)}/{_display(diastolic_value)}"
        elif systolic_value is not None:
            value = f"Systolique : {_display(systolic_value)}"
        else:
            value = f"Diastolique : {_display(diastolic_value)}"
        result["blood_pressure"] = pack(value, systolic_source, diastolic_source)

    glycemia = result.pop("glycemia_g_l", None)
    glycemia_value, glycemia_source = unpack(glycemia)
    if glycemia_value is not None and "glycemia" not in result:
        result["glycemia"] = pack(f"{_display(glycemia_value)} g/L", glycemia_source)
    return result


def migrate_health_data(apps, schema_editor):
    CareEncounter = apps.get_model("care", "CareEncounter")
    Consultation = apps.get_model("care", "Consultation")
    HealthMeasurement = apps.get_model("care", "HealthMeasurement")
    alias = schema_editor.connection.alias

    for model, nested in ((CareEncounter, False), (Consultation, True)):
        for record in model.objects.using(alias).all().iterator():
            converted = _convert_vitals(record.vitals or {}, nested=nested)
            if converted != (record.vitals or {}):
                model.objects.using(alias).filter(pk=record.pk).update(vitals=converted)

    systolic_rows = list(HealthMeasurement.objects.using(alias).filter(kind="blood_pressure_systolic").order_by("patient_id", "measured_at", "source", "created_at"))
    diastolic_rows = list(HealthMeasurement.objects.using(alias).filter(kind="blood_pressure_diastolic").order_by("patient_id", "measured_at", "source", "created_at"))
    groups = defaultdict(lambda: {"systolic": [], "diastolic": []})
    for row in systolic_rows:
        groups[(row.patient_id, row.measured_at, row.source)]["systolic"].append(row)
    for row in diastolic_rows:
        groups[(row.patient_id, row.measured_at, row.source)]["diastolic"].append(row)

    old_ids = [row.pk for row in systolic_rows + diastolic_rows]
    for (patient_id, measured_at, source), values in groups.items():
        systolic = values["systolic"]
        diastolic = values["diastolic"]
        for index in range(max(len(systolic), len(diastolic))):
            upper = systolic[index] if index < len(systolic) else None
            lower = diastolic[index] if index < len(diastolic) else None
            raw_value = _format_pressure(upper, lower)
            notes = list(dict.fromkeys(note for note in ((upper.note if upper else ""), (lower.note if lower else "")) if note))
            created_at = min(row.created_at for row in (upper, lower) if row is not None)
            item = HealthMeasurement.objects.using(alias).create(
                patient_id=patient_id,
                kind="blood_pressure",
                value=None,
                raw_value=raw_value,
                unit="",
                source=source,
                measured_at=measured_at,
                note=" | ".join(notes)[:300],
            )
            HealthMeasurement.objects.using(alias).filter(pk=item.pk).update(created_at=created_at)
    if old_ids:
        HealthMeasurement.objects.using(alias).filter(pk__in=old_ids).delete()

    for item in HealthMeasurement.objects.using(alias).filter(kind="glycemia"):
        if item.value is None:
            continue
        HealthMeasurement.objects.using(alias).filter(pk=item.pk).update(raw_value=_measurement_value(item), value=None, unit="")


class Migration(migrations.Migration):
    dependencies = [("care", "0015_medicaldocument_exam_request_and_vaccination_kind")]

    operations = [
        migrations.AddField(
            model_name="healthmeasurement",
            name="raw_value",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AlterField(
            model_name="healthmeasurement",
            name="kind",
            field=models.CharField(choices=[("blood_pressure", "Tension"), ("glycemia", "Glycémie"), ("weight", "Poids"), ("height", "Taille"), ("temperature", "Température"), ("heart_rate", "Pouls"), ("spo2", "Saturation SpO₂"), ("blood_pressure_systolic", "Tension systolique (historique)"), ("blood_pressure_diastolic", "Tension diastolique (historique)")], max_length=32),
        ),
        migrations.AlterField(
            model_name="followupplanitem",
            name="measurement_kind",
            field=models.CharField(choices=[("blood_pressure", "Tension"), ("glycemia", "Glycémie"), ("weight", "Poids"), ("height", "Taille"), ("temperature", "Température"), ("heart_rate", "Pouls"), ("spo2", "Saturation SpO₂"), ("blood_pressure_systolic", "Tension systolique (historique)"), ("blood_pressure_diastolic", "Tension diastolique (historique)")], max_length=32),
        ),
        migrations.AlterField(
            model_name="healthmeasurement",
            name="value",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True),
        ),
        migrations.AlterField(
            model_name="healthmeasurement",
            name="unit",
            field=models.CharField(blank=True, max_length=16),
        ),
        migrations.RunPython(migrate_health_data, migrations.RunPython.noop),
    ]

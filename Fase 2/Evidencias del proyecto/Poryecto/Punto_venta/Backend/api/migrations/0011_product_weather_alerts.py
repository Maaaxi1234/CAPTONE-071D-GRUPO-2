from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0010_orderitem_discount_pct_orderitem_price_base_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="requiere_alerta_calor",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="product",
            name="sensibilidad_calor",
            field=models.CharField(blank=True, choices=[("BAJA", "Baja"), ("MEDIA", "Media"), ("ALTA", "Alta")], max_length=10, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="sensibilidad_frio",
            field=models.CharField(blank=True, choices=[("BAJA", "Baja"), ("MEDIA", "Media"), ("ALTA", "Alta")], max_length=10, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="temp_max_segura",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="temp_min_segura",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="alert",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("RIEGO", "Riego atrasado"),
                    ("VIDA_UTIL", "Vida útil excedida"),
                    ("SOBRESTOCK", "Sobrestock / sin rotación"),
                    ("RIESGO_ALTO", "Riesgo climático alto"),
                    ("CALOR", "Temperatura alta"),
                    ("FRIO", "Temperatura baja"),
                ],
                max_length=20,
            ),
        ),
    ]

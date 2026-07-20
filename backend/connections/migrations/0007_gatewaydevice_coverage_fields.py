from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("connections", "0006_connectionrequest_session_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="gatewaydevice",
            name="hotspot_band",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="gatewaydevice",
            name="coverage_optimized",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="gatewaydevice",
            name="coverage_notes",
            field=models.TextField(blank=True),
        ),
    ]

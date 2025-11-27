"""
Serializers para Informes/KPIs.
Se definen aquí para mantener el módulo independiente de api.serializers.
"""

from rest_framework import serializers


class KPIValueSerializer(serializers.Serializer):
    label = serializers.CharField()
    value = serializers.FloatField()
    porcentaje = serializers.FloatField(required=False)
    monto = serializers.FloatField(required=False)


class KPITotalesSerializer(serializers.Serializer):
    total_ventas = serializers.FloatField()
    tickets = serializers.IntegerField()
    total_items = serializers.IntegerField()
    ticket_promedio = serializers.FloatField()


class SeriesPointSerializer(serializers.Serializer):
    x = serializers.CharField()  # fecha o 'YYYY-MM'
    y = serializers.FloatField()


__all__ = ["KPIValueSerializer", "KPITotalesSerializer", "SeriesPointSerializer"]

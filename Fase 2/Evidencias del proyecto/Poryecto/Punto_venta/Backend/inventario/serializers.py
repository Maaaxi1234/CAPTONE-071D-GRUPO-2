"""
Serializers para Inventario (categorías, productos, alertas, cuidados).
"""
import uuid
from rest_framework import serializers
from api.models import Category, Product, Alert, PlantCare
from api.alerts import evaluar_alertas_producto


def generate_product_id():
    """ID corto aleatorio (12 hex)."""
    for _ in range(5):
        pid = uuid.uuid4().hex[:12]
        if not Product.objects.filter(pk=pid).exists():
            return pid
    return uuid.uuid4().hex


_product_fields = [
    "id",
    "sku",
    "name",
    "price",
    "discount_pct",
    "stock",
    "image",
    "category",
    "category_id",
    "frecuencia_riego_dias",
    "vida_util_dias",
    "sensibilidad_climatica",
    "sensibilidad_calor",
    "sensibilidad_frio",
    "temp_max_segura",
    "temp_min_segura",
    "requiere_alerta_calor",
    "fecha_ingreso",
    "ultima_fecha_riego",
]
if hasattr(Product, "barcode"):
    _product_fields.insert(_product_fields.index("image") + 1, "barcode")


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]


class ProductSerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=False)
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category", queryset=Category.objects.all(), write_only=True, required=True, allow_null=False
    )
    image = serializers.ImageField(required=False, allow_null=True)
    price_discounted = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = _product_fields + ["price_discounted"]
        read_only_fields = ["price_discounted"]

    def get_price_discounted(self, obj):
        return obj.price_with_discount()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        img = data.get("image")
        if img:
            request = self.context.get("request")
            if request and not img.startswith("http"):
                data["image"] = request.build_absolute_uri(img)
        return data

    def validate_sku(self, v):
        if v is None or str(v).strip() == "":
            raise serializers.ValidationError("SKU es obligatorio.")
        return v

    def validate_price(self, v):
        if v is None:
            raise serializers.ValidationError("El precio es obligatorio.")
        if v < 0:
            raise serializers.ValidationError("El precio no puede ser negativo.")
        return v

    def create(self, validated_data):
        if not validated_data.get("id"):
            validated_data["id"] = generate_product_id()
        instance = super().create(validated_data)
        evaluar_alertas_producto(instance)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        evaluar_alertas_producto(instance)
        return instance


class AlertSerializer(serializers.ModelSerializer):
    producto = ProductSerializer(read_only=True)
    producto_id = serializers.PrimaryKeyRelatedField(source="producto", queryset=Product.objects.all(), write_only=True)

    class Meta:
        model = Alert
        fields = [
            "id",
            "producto",
            "producto_id",
            "tipo",
            "mensaje",
            "nivel",
            "fecha_creacion",
            "resuelta",
            "fecha_resolucion",
        ]
        read_only_fields = ["fecha_creacion", "fecha_resolucion"]


class PlantCareSerializer(serializers.ModelSerializer):
    producto = ProductSerializer(read_only=True)
    producto_id = serializers.PrimaryKeyRelatedField(source="producto", queryset=Product.objects.all(), write_only=True)

    class Meta:
        model = PlantCare
        fields = [
            "id",
            "producto",
            "producto_id",
            "tipo_accion",
            "fecha_accion",
            "usuario",
            "observaciones",
        ]
        read_only_fields = ["fecha_accion"]


__all__ = ["CategorySerializer", "ProductSerializer", "AlertSerializer", "PlantCareSerializer"]

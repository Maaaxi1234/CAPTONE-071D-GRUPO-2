from rest_framework import serializers
from .models import Category, Product, Order, OrderItem
import uuid

# ------ helper ------
def generate_product_id():
    """ID corto aleatorio (12 hex)."""
    for _ in range(5):
        pid = uuid.uuid4().hex[:12]
        if not Product.objects.filter(pk=pid).exists():
            return pid
    return uuid.uuid4().hex

# ------ Categorías ------
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]

# ------ Productos ------
_product_fields = ["id", "sku", "name", "price", "stock", "image", "category", "category_id"]
if hasattr(Product, "barcode"):
    _product_fields.insert(_product_fields.index("image") + 1, "barcode")

class ProductSerializer(serializers.ModelSerializer):
    # permitir escribir id opcional
    id = serializers.CharField(required=False)

    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=Category.objects.all(),
        write_only=True,
        required=True,
        allow_null=False,
    )

    # escribe el archivo; al leer transformamos a URL absoluta abajo
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Product
        fields = _product_fields  # debe incluir "image"
        
    def to_representation(self, instance):
        data = super().to_representation(instance)
        img = data.get("image")
        if img:
            request = self.context.get("request")
            if request and not img.startswith("http"):
                data["image"] = request.build_absolute_uri(img)
        return data

    # Validaciones
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

    def validate_price(self, v):
        if v is None:
            raise serializers.ValidationError("El precio es obligatorio.")
        if v < 0:
            raise serializers.ValidationError("El precio no puede ser negativo.")
        return v

    def create(self, validated_data):
        if not validated_data.get("id"):
            validated_data["id"] = generate_product_id()
        return super().create(validated_data)

# ------ Órdenes ------
class OrderItemInputSerializer(serializers.Serializer):
    # Si Product.pk es string, usamos CharField
    product_id = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1)

class OrderCreateSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=["efectivo","debito","credito","transferencia"])
    items = OrderItemInputSerializer(many=True)

    def validate(self, data):
        if not data.get("items"):
            raise serializers.ValidationError({"items": ["Debe incluir al menos un producto."]})
        return data

    def create(self, validated):
        from django.db import transaction
        items = validated["items"]
        pm = validated["payment_method"]

        with transaction.atomic():
            order = Order.objects.create(
                payment_method=pm,
                status="paid",
            )
            total = 0

            for it in items:
                try:
                    product = Product.objects.select_for_update().get(pk=it["product_id"])
                except Product.DoesNotExist:
                    raise serializers.ValidationError({"items": [f"Producto '{it['product_id']}' no existe."]})

                qty = int(it["quantity"])
                if product.stock < qty:
                    raise serializers.ValidationError({"items": [f"Stock insuficiente para {product.name}. Disponible: {product.stock}."]})

                product.stock -= qty
                product.save(update_fields=["stock"])

                OrderItem.objects.create(
                    order=order,
                    product=product,                # FK (puede borrarse luego)
                    product_name=product.name,      # snapshot
                    product_sku=product.sku,        # snapshot
                    quantity=qty,
                    price=product.price,
                )
                total += qty * product.price

            order.total = total
            order.save(update_fields=["total"])

        return order

class OrderSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id","code","created_at","status",
            "payment_method","total","items"
        ]

    def get_items(self, obj):
        out = []
        for i in obj.items.all():
            # si product fue borrado, usa snapshot
            pname = i.product.name if i.product else (i.product_name or "")
            psku  = i.product.sku  if i.product else (i.product_sku or "")
            out.append({
                "product": pname,
                "sku": psku,
                "quantity": i.quantity,
                "price": i.price,
                "line_total": i.quantity * i.price
            })
        return out
class KPIValueSerializer(serializers.Serializer):
    label = serializers.CharField()
    value = serializers.FloatField()

class KPITotalesSerializer(serializers.Serializer):
    total_ventas = serializers.FloatField()
    tickets = serializers.IntegerField()
    total_items = serializers.IntegerField()
    ticket_promedio = serializers.FloatField()

class SeriesPointSerializer(serializers.Serializer):
    x = serializers.CharField()   # fecha o 'YYYY-MM'
    y = serializers.FloatField()
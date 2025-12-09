"""
Serializers para POS (órdenes), usando modelos en api.models.
"""

from rest_framework import serializers
from api.models import Order, OrderItem, Product


# Serializer simple para entrada de ítem (id producto + cantidad).
class OrderItemInputSerializer(serializers.Serializer):
    product_id = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1)


# Serializer para crear órdenes desde payload: valida y crea la orden con items.
class OrderCreateSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=["efectivo", "debito", "credito", "transferencia"])
    items = OrderItemInputSerializer(many=True)

    # Verifica que haya al menos un item en la orden.
    def validate(self, data):
        if not data.get("items"):
            raise serializers.ValidationError({"items": ["Debe incluir al menos un producto."]})
        return data

    # Crea la orden, ajusta stock y genera OrderItem (dentro de transacción).
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
                    raise serializers.ValidationError(
                        {"items": [f"Stock insuficiente para {product.name}. Disponible: {product.stock}."]}
                    )

                product.stock -= qty
                product.save(update_fields=["stock"])

                unit_price = product.price_with_discount()
                price_base = product.price
                discount = max(0, product.discount_pct or 0)

                OrderItem.objects.create(
                    order=order,
                    product=product,
                    product_name=product.name,
                    product_sku=product.sku,
                    quantity=qty,
                    price=unit_price,
                    price_base=price_base,
                    discount_pct=discount,
                )
                total += qty * unit_price

            order.total = total
            order.save(update_fields=["total"])

        return order


# Serializer para representar una orden con sus items (snapshot).
class OrderSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "code",
            "created_at",
            "status",
            "payment_method",
            "total",
            "items",
        ]

    # Construye lista simple de items para la respuesta JSON.
    def get_items(self, obj):
        out = []
        for i in obj.items.all():
            pname = i.product.name if i.product else (i.product_name or "")
            psku = i.product.sku if i.product else (i.product_sku or "")
            out.append(
                {
                    "product": pname,
                    "sku": psku,
                    "quantity": i.quantity,
                    "price": i.price,
                    "price_base": i.price_base,
                    "discount_pct": i.discount_pct,
                    "line_total": i.quantity * i.price,
                }
            )
        return out


__all__ = ["OrderSerializer", "OrderCreateSerializer", "OrderItemInputSerializer"]

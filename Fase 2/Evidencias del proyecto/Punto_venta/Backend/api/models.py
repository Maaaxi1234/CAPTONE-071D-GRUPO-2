from django.db import models
from django.utils import timezone
import os, uuid
from django.core.validators import MinValueValidator
from django.db.models import Q, CheckConstraint

class Category(models.Model):
    name = models.CharField(max_length=80, unique=True)

    def __str__(self):
        return self.name

def product_image_path(instance, filename):
    ext = filename.split(".")[-1]
    new_name = f"{uuid.uuid4().hex}.{ext}"
    return os.path.join("products", new_name)

class Product(models.Model):
    id = models.CharField(primary_key=True, max_length=20)  # e.g. "P001"
    sku = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='products')
    price = models.PositiveIntegerField(help_text="Precio en CLP, sin decimales",validators=[MinValueValidator(1)])
    stock = models.PositiveIntegerField(default=0)
    image = models.ImageField(upload_to=product_image_path, blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.sku})"
    
    class Meta:
        constraints = [
            CheckConstraint(check=Q(price__gt=0), name="product_price_gt_0"),
        ]

class Order(models.Model):
    PAYMENT_CHOICES = [
        ('efectivo', 'Efectivo'),
        ('debito', 'Débito'),
        ('credito', 'Crédito'),
        ('transferencia', 'Transferencia'),
    ]

    STATUS_CHOICES = [
        ('paid', 'Pagada'),          # finalizada
        ('cancelled', 'Cancelada'),
    ]

    code = models.CharField(max_length=40, unique=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES)
    total = models.PositiveIntegerField(default=0)

    # 👇 nuevo: estado final de la orden
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='paid')

    def save(self, *args, **kwargs):
        creating = self._state.adding
        super().save(*args, **kwargs)
        if creating and not self.code:
            today = timezone.localdate()
            prefix = f"PDLF-{today.strftime('%Y%m%d')}"
            seq = str(self.id).zfill(4)
            self.code = f"{prefix}-{seq}"
            super().save(update_fields=['code'])

    def __str__(self):
        return self.code or f"Order {self.pk}"
    
class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')

    # Permite borrar productos sin romper historial
    product = models.ForeignKey('Product', on_delete=models.SET_NULL, null=True, blank=True)

    # snapshots para conservar info aunque borres el producto
    product_name = models.CharField(max_length=120, blank=True)
    product_sku  = models.CharField(max_length=40, blank=True)

    quantity = models.PositiveIntegerField()
    price = models.PositiveIntegerField(help_text="Precio unitario al momento de la compra")

    def line_total(self):
        return self.quantity * self.price

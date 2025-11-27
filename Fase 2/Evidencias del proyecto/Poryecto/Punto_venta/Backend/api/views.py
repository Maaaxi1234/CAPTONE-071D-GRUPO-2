"""
Vistas de compatibilidad: `api` ahora reexporta las vistas de los módulos
`inventario`, `pos` e `informes` para mantener importes existentes.
Incluye `MeView`, que sigue viviendo en `api`.
"""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# ---- Vistas propias de api ----
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        groups = list(u.groups.values_list("name", flat=True))
        role = groups[0] if groups else "user"
        return Response({"id": u.id, "username": u.username, "email": u.email, "groups": groups, "role": role})


# ---- Inventario ----
from inventario.views import (
    CategoryListCreateView,
    CategoryDetailView,
    ProductListCreateView,
    ProductDetailView,
    ProductWaterView,
    ProductExtendLifeView,
    AlertListView,
    PlantCareListView,
)

# ---- POS ----
from pos.views import (
    OrderCreateView,
    OrderListView,
    OrderDetailView,
)

# ---- Informes ----
from informes.views import (
    KPIOverview,
    KPITopProductos,
    KPIMesMayorVenta,
    VentasPorMes,
    VentasPorCategoria,
    MediosDePago,
    PromedioVentaDiaria,
    ExportExcelView,
    ExportPDFView,
    ReportQueryView,
    ReportExportView,
)

__all__ = [
    # propios
    "MeView",
    # inventario
    "CategoryListCreateView",
    "CategoryDetailView",
    "ProductListCreateView",
    "ProductDetailView",
    "ProductWaterView",
    "ProductExtendLifeView",
    "AlertListView",
    "PlantCareListView",
    # pos
    "OrderCreateView",
    "OrderListView",
    "OrderDetailView",
    # informes
    "KPIOverview",
    "KPITopProductos",
    "KPIMesMayorVenta",
    "VentasPorMes",
    "VentasPorCategoria",
    "MediosDePago",
    "PromedioVentaDiaria",
    "ExportExcelView",
    "ExportPDFView",
    "ReportQueryView",
    "ReportExportView",
]

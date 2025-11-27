from django.urls import path
from .views import (
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

urlpatterns = [
    path("kpi/overview/", KPIOverview.as_view()),
    path("kpi/top-productos/", KPITopProductos.as_view()),
    path("kpi/mes-mayor-venta/", KPIMesMayorVenta.as_view()),
    path("kpi/ventas-por-mes/", VentasPorMes.as_view()),
    path("kpi/ventas-por-categoria/", VentasPorCategoria.as_view()),
    path("kpi/medios-pago/", MediosDePago.as_view()),
    path("kpi/promedio-diario/", PromedioVentaDiaria.as_view()),
    path("kpi/export-excel/", ExportExcelView.as_view()),
    path("kpi/export-pdf/", ExportPDFView.as_view()),
    path("reportes/query/", ReportQueryView.as_view(), name="report-query"),
    path("reportes/export/", ReportExportView.as_view(), name="report-export"),
]

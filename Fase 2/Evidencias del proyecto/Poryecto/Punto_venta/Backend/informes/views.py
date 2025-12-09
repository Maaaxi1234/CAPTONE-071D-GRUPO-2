"""
Vistas de informes/KPIs. Reubicadas desde api.views, usando modelos en api.models.
"""

from datetime import datetime, date
from io import BytesIO

import xlsxwriter
from django.db.models import (
    Sum,
    Count,
    F,
    FloatField,
    IntegerField,
    Value,
    Avg,
    Max,
    ExpressionWrapper,
)
from django.db.models.functions import Coalesce, TruncMonth, TruncDate
from django.http import HttpResponse
from django.utils.timezone import make_aware
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, LETTER, LEGAL, landscape, portrait
from reportlab.lib.units import inch
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from api.models import Order, OrderItem
from .serializers import KPIValueSerializer, KPITotalesSerializer, SeriesPointSerializer
from api.perms import group_perm

PAID = {"status": "paid"}


# Construye queryset de órdenes dentro de rango opcional start/end.
def _rango_qs(request):
    qs = Order.objects.filter(**PAID)
    start = request.GET.get("start")
    end = request.GET.get("end")
    if start:
        qs = qs.filter(created_at__gte=make_aware(datetime.fromisoformat(start + " 00:00:00")))
    if end:
        qs = qs.filter(created_at__lte=make_aware(datetime.fromisoformat(end + " 23:59:59")))
    return qs


# Vista resumen KPIs: totales, tickets, items, ticket promedio.
class KPIOverview(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = _rango_qs(request)
        tot = orders.aggregate(
            total_ventas=Coalesce(Sum("total", output_field=FloatField()), Value(0.0), output_field=FloatField()),
            tickets=Coalesce(Count("id", output_field=IntegerField()), Value(0), output_field=IntegerField()),
        )
        items = OrderItem.objects.filter(order__in=orders).aggregate(
            total_items=Coalesce(Sum("quantity", output_field=IntegerField()), Value(0), output_field=IntegerField())
        )
        tickets = int(tot["tickets"])
        ticket_prom = float(tot["total_ventas"]) / tickets if tickets else 0.0
        data = {
            "total_ventas": float(tot["total_ventas"]),
            "tickets": tickets,
            "total_items": int(items["total_items"]),
            "ticket_promedio": round(ticket_prom, 0),
        }
        return Response(KPITotalesSerializer(data).data)


# Top productos por cantidad vendida.
class KPITopProductos(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = int(request.GET.get("limit", 5))
        orders = _rango_qs(request)
        rows = (
            OrderItem.objects.filter(order__in=orders)
            .values("product_name")
            .annotate(value=Coalesce(Sum("quantity", output_field=IntegerField()), Value(0), output_field=IntegerField()))
            .order_by("-value")[:limit]
        )
        data = [{"label": r["product_name"] or "Producto s/nombre", "value": float(r["value"])} for r in rows]
        return Response(KPIValueSerializer(data, many=True).data)


# Mes con mayor venta (simple).
class KPIMesMayorVenta(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = _rango_qs(request)
        rows_qs = (
            orders.annotate(m=TruncMonth("created_at"))
            .values("m")
            .annotate(value=Coalesce(Sum("total", output_field=FloatField()), Value(0.0), output_field=FloatField()))
            .order_by("-value")[:1]
        )
        rows = list(rows_qs)
        data = []
        if rows:
            data = [{"label": rows[0]["m"].strftime("%Y-%m"), "value": float(rows[0]["value"])}]
        return Response(KPIValueSerializer(data, many=True).data)


# Ventas agregadas por mes para serie temporal.
class VentasPorMes(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = _rango_qs(request)
        serie = (
            orders.annotate(m=TruncMonth("created_at"))
            .values("m")
            .annotate(y=Coalesce(Sum("total", output_field=FloatField()), Value(0.0), output_field=FloatField()))
            .order_by("m")
        )
        data = [{"x": r["m"].strftime("%Y-%m"), "y": float(r["y"])} for r in serie]
        return Response(SeriesPointSerializer(data, many=True).data)


# Ventas por categoría (monto).
class VentasPorCategoria(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = _rango_qs(request)
        rows = (
            OrderItem.objects.filter(order__in=orders)
            .values("product__category__name")
            .annotate(
                value=Coalesce(
                    Sum(F("quantity") * F("price"), output_field=FloatField()), Value(0.0), output_field=FloatField()
                )
            )
            .order_by("-value")
        )
        data = [{"label": r["product__category__name"] or "(Sin categoría)", "value": float(r["value"])} for r in rows]
        return Response(KPIValueSerializer(data, many=True).data)


# Breakdown por medios de pago (conteo y monto).
class MediosDePago(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = _rango_qs(request)
        rows = (
            orders.values("payment_method").annotate(
                value=Coalesce(Count("id", output_field=IntegerField()), Value(0), output_field=IntegerField()),
                total=Coalesce(Sum("total", output_field=FloatField()), Value(0.0), output_field=FloatField()),
            )
        )
        buckets = {
            "Tarjeta": {"value": 0, "monto": 0.0},
            "Efectivo": {"value": 0, "monto": 0.0},
            "Transferencia": {"value": 0, "monto": 0.0},
        }
        for r in rows:
            pm = (r["payment_method"] or "").lower()
            if pm in ("debito", "credito", "tarjeta"):
                label = "Tarjeta"
            elif pm == "transferencia":
                label = "Transferencia"
            else:
                label = "Efectivo"
            buckets[label]["value"] += int(r["value"])
            buckets[label]["monto"] += float(r["total"])
        total_tickets = sum(bucket["value"] for bucket in buckets.values()) or 1
        data = []
        for label in ["Efectivo", "Tarjeta", "Transferencia"]:
            bucket = buckets[label]
            data.append(
                {
                    "label": label,
                    "value": bucket["value"],
                    "porcentaje": round(bucket["value"] * 100 / total_tickets, 1),
                    "monto": bucket["monto"],
                }
            )
        return Response(KPIValueSerializer(data, many=True).data)


# Promedio de venta diaria calculado sobre días con datos.
class PromedioVentaDiaria(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = _rango_qs(request)
        diario = (
            orders.annotate(d=TruncDate("created_at"))
            .values("d")
            .annotate(total=Coalesce(Sum("total", output_field=FloatField()), Value(0.0), output_field=FloatField()))
        )
        prom = sum(float(r["total"]) for r in diario) / len(diario) if diario else 0.0
        data = [{"label": "promedio_diario", "value": round(prom, 0)}]
        return Response(KPIValueSerializer(data, many=True).data)


# ---------- Helpers reportes ----------
# Helpers para generar filas de reportes (productos, medios, etc.).
def _rows_report(report, start, end):
    class DummyReq:
        GET = {}

    dr = DummyReq()
    if start:
        dr.GET["start"] = start
    if end:
        dr.GET["end"] = end
    orders_qs = _rango_qs(dr)

    if report == "productos":
        rows_qs = (
            OrderItem.objects.filter(order__in=orders_qs)
            .values("product_name")
            .annotate(
                cant=Coalesce(Sum("quantity", output_field=IntegerField()), Value(0), output_field=IntegerField()),
                monto=Coalesce(Sum(F("quantity") * F("price"), output_field=FloatField()), Value(0.0), output_field=FloatField()),
            )
            .order_by("-cant", "-monto")
        )
        headers = ["Producto", "Cantidad", "Monto CLP"]
        rows = [[r["product_name"] or "Producto s/nombre", int(r["cant"]), float(r["monto"])] for r in rows_qs]
        return "Productos vendidos", headers, rows

    if report == "medios":
        rows_qs = (
            orders_qs.values("payment_method")
            .annotate(
                tickets=Coalesce(Count("id", output_field=IntegerField()), Value(0), output_field=IntegerField()),
                monto=Coalesce(Sum("total", output_field=FloatField()), Value(0.0), output_field=FloatField()),
            )
            .order_by("-tickets", "-monto")
        )
        headers = ["Medio de pago", "Tickets", "Monto CLP"]
        rows = [[r["payment_method"], int(r["tickets"]), float(r["monto"])] for r in rows_qs]
        return "Resumen por medios de pago", headers, rows

    if report == "categorias":
        rows_qs = (
            OrderItem.objects.filter(order__in=orders_qs)
            .values("product__category__name")
            .annotate(
                monto=Coalesce(
                    Sum(F("quantity") * F("price"), output_field=FloatField()), Value(0.0), output_field=FloatField()
                )
            )
            .order_by("-monto")
        )
        headers = ["Categoría", "Monto Total Vendido CLP"]
        rows = [[r["product__category__name"] or "(Sin categoría)", float(r["monto"])] for r in rows_qs]
        return "Ingresos por categoría", headers, rows

    items = (
        OrderItem.objects.filter(order__in=orders_qs)
        .select_related("order", "product", "product__category")
        .order_by("-order__created_at", "id")
    )
    headers = [
        "Fecha",
        "Código",
        "Método",
        "Producto",
        "SKU",
        "Categoría",
        "Cantidad",
        "Precio",
        "Total línea",
        "Total orden",
    ]
    rows = []
    for it in items:
        o = it.order
        rows.append(
            [
                o.created_at.strftime("%Y-%m-%d %H:%M"),
                o.code or f"Order {o.id}",
                o.payment_method,
                it.product_name or (it.product.name if it.product else ""),
                it.product_sku or (it.product.sku if it.product else ""),
                (it.product.category.name if it.product and it.product.category_id else ""),
                it.quantity,
                it.price,
                it.quantity * it.price,
                o.total,
            ]
        )
    return "Detalle de ventas (por ítem)", headers, rows


# Exporta a Excel (reportes).
class ExportExcelView(APIView):
    permission_classes = [group_perm("admin")]

    def get(self, request):
        report = request.GET.get("report", "ventas")
        start = request.GET.get("start")
        end = request.GET.get("end")
        titulo, headers, rows = _rows_report(report, start, end)

        output = BytesIO()
        wb = xlsxwriter.Workbook(output, {"in_memory": True})
        ws = wb.add_worksheet(report[:31])
        bold = wb.add_format({"bold": True})
        money = wb.add_format({"num_format": "$ #,##0"})

        ws.write(0, 0, titulo, bold)
        ws.write(1, 0, f"Rango: {start or '...'} a {end or '...'}")
        for j, h in enumerate(headers):
            ws.write(3, j, h, bold)

        for i, row in enumerate(rows, start=4):
            for j, val in enumerate(row):
                hdr = headers[j].lower()
                if isinstance(val, (int, float)) and any(k in hdr for k in ["monto", "total", "precio", "clp"]):
                    ws.write_number(i, j, float(val), money)
                elif isinstance(val, (int, float)):
                    ws.write_number(i, j, float(val))
                else:
                    ws.write(i, j, val)

        ws.autofilter(3, 0, 3 + len(rows), len(headers) - 1)
        ws.freeze_panes(4, 0)
        wb.close()
        output.seek(0)

        resp = HttpResponse(output.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp["Content-Disposition"] = f'attachment; filename="reporte_{report}_{(start or "ini")}_{(end or "fin")}.xlsx"'
        return resp


PLANTITAS_PRIMARY = colors.HexColor("#2E7D32")
ZEBRA_A, ZEBRA_B = colors.whitesmoke, colors.HexColor("#F5F7F2")


def _fmt_money(n):
    try:
        return f"$ {int(round(float(n))):,}".replace(",", ".")
    except Exception:
        return str(n)


def _detect_numeric_cols(headers, rows):
    money_cols, int_cols = set(), set()
    for j, h in enumerate(headers):
        hl = h.lower()
        if any(k in hl for k in ["monto", "total", "precio", "clp"]):
            money_cols.add(j)
        elif all((j < len(r) and isinstance(r[j], (int, float))) for r in rows):
            int_cols.add(j)
    return money_cols, int_cols


def _on_page(canvas, doc):
    canvas.saveState()
    ts = datetime.now().strftime("Generado el %d-%m-%Y %H:%M")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, 12, ts)
    canvas.restoreState()


# Export PDF: prepara tabla y estilos, construye PDF.
class ExportPDFView(APIView):
    permission_classes = [group_perm("admin")]

    def get(self, request):
        report = request.GET.get("report", "ventas")
        start = request.GET.get("start")
        end = request.GET.get("end")

        size_param = (request.GET.get("size") or "oficio").lower()
        orient_param = (request.GET.get("orientation") or "landscape").lower()

        titulo, headers, rows = _rows_report(report, start, end)

        OFICIO = (8.5 * inch, 13 * inch)
        if size_param == "oficio":
            base_size = OFICIO
        elif size_param == "legal":
            base_size = LEGAL
        elif size_param == "letter":
            base_size = LETTER
        else:
            base_size = A4

        PAGE = landscape(base_size) if orient_param == "landscape" else portrait(base_size)

        left, right, top, bottom = 24, 24, 20, 24
        frame = Frame(left, bottom, PAGE[0] - left - right, PAGE[1] - top - bottom, id="normal")

        buf = BytesIO()
        doc = BaseDocTemplate(buf, pagesize=PAGE, leftMargin=left, rightMargin=right, topMargin=top, bottomMargin=bottom)
        doc.addPageTemplates(PageTemplate(id="p", frames=[frame], onPage=_on_page))

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("TitlePlantitas", parent=styles["Title"], alignment=1, fontSize=22)
        sub_style = ParagraphStyle("Subtle", parent=styles["Normal"], textColor=colors.HexColor("#555555"), fontSize=10)

        elements = [
            Paragraph(titulo, title_style),
            Paragraph(f"Rango: {start or '¿?'} a {end or '¿?'}", sub_style),
            Spacer(0, 6),
        ]

        money_cols, int_cols = _detect_numeric_cols(headers, rows)
        usable_width = PAGE[0] - left - right
        if headers:
            weights = []
            for j in range(len(headers)):
                if j in money_cols:
                    weights.append(1.2)
                elif j in int_cols:
                    weights.append(1.0)
                else:
                    weights.append(2.2)
            total_weight = sum(weights) or 1
            col_widths = [usable_width * (w / total_weight) for w in weights]
        else:
            col_widths = []
        data = [headers[:]]
        for r in rows:
            row = []
            for j, v in enumerate(r):
                row.append(
                    _fmt_money(v)
                    if j in money_cols
                    else (f"{int(v):,}".replace(",", ".") if (j in int_cols and isinstance(v, (int, float))) else (v or ""))
                )
            data.append(row)

        t = Table(data, repeatRows=1, colWidths=col_widths or None)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), PLANTITAS_PRIMARY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [ZEBRA_A, ZEBRA_B]),
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.grey),
                    ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        for j in money_cols.union(int_cols):
            t.setStyle(TableStyle([("ALIGN", (j, 1), (j, -1), "RIGHT")]))

        doc.build([*elements, t])
        pdf = buf.getvalue()
        buf.close()

        resp = HttpResponse(pdf, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="reporte_{report}_{(start or "ini")}_{(end or "fin")}.pdf"'
        return resp


# Parseo simple de fechas YYYY-MM-DD seguro.
def _parse_date_yyyy_mm_dd(s):
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d")
    except Exception:
        try:
            return datetime.fromisoformat(s[:10])
        except Exception:
            return None


# Consulta dinámica para el constructor de reportes.
class ReportQueryView(APIView):
    """
    Devuelve datos para el constructor de informes.
    - Si dimension == "producto": retorna filas con claves 'producto', 'categoria', 'cantidad', etc.
    - Otras dimensiones: formato genérico { label, ...métricas }.
    """

    def post(self, request):
        try:
            spec = request.data or {}
            dim_in = spec.get("dimension", "medio_pago")
            metrics = spec.get("metrics", ["cantidad"])
            filters = spec.get("filters", {}) or {}
            sort = spec.get("sort", {"by": "cantidad", "dir": "desc"}) or {}
            limit = int(spec.get("limit", 100) or 100)

            qs = OrderItem.objects.select_related("order", "product", "product__category").filter(order__status="paid")

            start_dt = _parse_date_yyyy_mm_dd(filters.get("start"))
            end_dt = _parse_date_yyyy_mm_dd(filters.get("end"))

            if start_dt:
                qs = qs.filter(order__created_at__gte=make_aware(datetime.combine(start_dt.date(), datetime.min.time())))
            if end_dt:
                qs = qs.filter(order__created_at__lte=make_aware(datetime.combine(end_dt.date(), datetime.max.time())))

            if filters.get("categoria"):
                qs = qs.filter(product__category__name=filters["categoria"])
            if filters.get("producto"):
                qs = qs.filter(product_name=filters["producto"])
            if filters.get("medio_pago"):
                qs = qs.filter(order__payment_method=filters["medio_pago"])

            if dim_in == "producto":
                days = 30
                if start_dt and end_dt and end_dt.date() >= start_dt.date():
                    days = (end_dt.date() - start_dt.date()).days + 1
                days = max(days, 1)

                data = (
                    qs.values("product_name", "product__category__name")
                    .annotate(
                        cantidad=Coalesce(Sum("quantity", output_field=IntegerField()), Value(0), output_field=IntegerField()),
                        monto=Coalesce(
                            Sum(F("quantity") * F("price"), output_field=FloatField()), Value(0.0), output_field=FloatField()
                        ),
                        precio_promedio=Coalesce(Avg("price", output_field=FloatField()), Value(0.0), output_field=FloatField()),
                        precio_unitario=Coalesce(
                            Max("product__price", output_field=FloatField()), Avg("price", output_field=FloatField())
                        ),
                        stock_actual=Coalesce(Max("product__stock", output_field=IntegerField()), Value(0), output_field=IntegerField()),
                        ultima_venta=Max("order__created_at"),
                    )
                    .annotate(
                        rotacion_diaria=ExpressionWrapper(
                            F("cantidad") / Value(float(days)),
                            output_field=FloatField(),
                        ),
                        margen_pct=Value(None, output_field=FloatField()),
                    )
                )

                order_by = sort.get("by", "monto")
                order_dir = "-" if sort.get("dir", "desc") == "desc" else ""
                data = data.order_by(f"{order_dir}{order_by}")[:limit]

                rows = []
                for r in data:
                    rows.append(
                        {
                            "producto": r["product_name"] or "¿?",
                            "categoria": r["product__category__name"] or "¿?",
                            "cantidad": int(r["cantidad"] or 0),
                            "precio_unitario": float(r["precio_unitario"] or 0),
                            "monto": float(r["monto"] or 0),
                            "precio_promedio": float(r["precio_promedio"] or 0),
                            "stock_actual": int(r["stock_actual"] or 0),
                            "ultima_venta": r["ultima_venta"],
                            "rotacion_diaria": float(r["rotacion_diaria"] or 0),
                            "margen_pct": None,
                        }
                    )
                return Response(rows, status=200)

            if dim_in == "medio_pago":
                dim = "order__payment_method"
            elif dim_in == "categoria":
                dim = "product__category__name"
            elif dim_in == "fecha_dia":
                qs = qs.annotate(d=TruncDate("order__created_at"))
                dim = "d"
            elif dim_in == "fecha_mes":
                qs = qs.annotate(m=TruncMonth("order__created_at"))
                dim = "m"
            else:
                dim = "order__payment_method"

            agg = {}
            if "monto" in metrics:
                agg["monto"] = Coalesce(
                    Sum(F("quantity") * F("price"), output_field=FloatField()), Value(0.0), output_field=FloatField()
                )
            if "cantidad" in metrics:
                agg["cantidad"] = Coalesce(Sum("quantity", output_field=IntegerField()), Value(0), output_field=IntegerField())
            if "tickets" in metrics:
                agg["tickets"] = Coalesce(Count("order", distinct=True, output_field=IntegerField()), Value(0), output_field=IntegerField())
            if "ticket_promedio" in metrics:
                agg["ticket_promedio"] = Coalesce(Avg("order__total", output_field=FloatField()), Value(0.0), output_field=FloatField())

            data = qs.values(dim).annotate(**agg).order_by(
                f"{'-' if sort.get('dir','desc')=='desc' else ''}{sort.get('by','cantidad')}"
            )[:limit]

            rows = []
            for r in data:
                label = r[dim]
                if dim in ("d", "m") and label:
                    label = label.strftime("%Y-%m-%d" if dim == "d" else "%Y-%m")
                item = {"label": label}
                for k in agg.keys():
                    v = r[k]
                    item[k] = float(v) if isinstance(v, (int, float)) else v
                rows.append(item)

            return Response(rows, status=200)

        except Exception as e:
            return Response({"detail": f"ReportQuery error: {type(e).__name__}: {e}"}, status=400)


# Exporta resultados de ReportQueryView a Excel/PDF.
class ReportExportView(APIView):
    """
    Exporta los mismos datos que ReportQueryView a Excel/PDF.
    """

    def post(self, request):
        try:
            fmt = (request.query_params.get("format") or "excel").lower()
            spec = request.data or {}

            size_param = (spec.get("size") or request.query_params.get("size") or "a4").lower()
            orient = (spec.get("orientation") or request.query_params.get("orientation") or "portrait").lower()

            rqv = ReportQueryView()
            resp = rqv.post(request)
            if getattr(resp, "status_code", 200) != status.HTTP_200_OK:
                return resp
            rows = resp.data if isinstance(resp.data, list) else []

            columns = spec.get("columns")
            if not columns:
                if rows:
                    default_cols = [
                        "producto",
                        "categoria",
                        "cantidad",
                        "precio_unitario",
                        "monto",
                        "precio_promedio",
                        "stock_actual",
                        "ultima_venta",
                        "rotacion_diaria",
                        "margen_pct",
                    ]
                    cols_in_rows = [c for c in default_cols if c in rows[0]]
                    columns = cols_in_rows or list(rows[0].keys())
                else:
                    columns = []

            def _safe(v):
                if v is None:
                    return ""
                if isinstance(v, (datetime, date)):
                    try:
                        return v.strftime("%Y-%m-%d %H:%M") if isinstance(v, datetime) else v.strftime("%Y-%m-%d")
                    except Exception:
                        return str(v)
                return v

            if fmt == "excel":
                output = BytesIO()
                wb = xlsxwriter.Workbook(output, {"in_memory": True})
                ws = wb.add_worksheet("Reporte")

                fmt_bold = wb.add_format({"bold": True})
                fmt_money = wb.add_format({"num_format": "$ #,##0"})
                fmt_int = wb.add_format({"num_format": "#,##0"})

                filtros = spec.get("filters", {})
                start = filtros.get("start") or "-"
                end = filtros.get("end") or "-"
                ws.write(0, 0, "Informe de Productos", fmt_bold)
                ws.write(1, 0, f"Período: {start} a {end}")

                for j, col in enumerate(columns):
                    ws.write(3, j, col.replace("_", " ").capitalize(), fmt_bold)

                for i, r in enumerate(rows, start=4):
                    for j, col in enumerate(columns):
                        val = _safe(r.get(col, ""))
                        header = col.lower()
                        if isinstance(val, (int, float)) and any(k in header for k in ["monto", "total", "precio"]):
                            ws.write_number(i, j, float(val), fmt_money)
                        elif isinstance(val, (int, float)):
                            ws.write_number(i, j, float(val), fmt_int)
                        else:
                            ws.write(i, j, val)

                ws.autofilter(3, 0, 3 + len(rows), max(0, len(columns) - 1))
                ws.freeze_panes(4, 0)
                wb.close()
                output.seek(0)

                resp = HttpResponse(
                    output.read(),
                    content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
                resp["Content-Disposition"] = 'attachment; filename="reporte_productos.xlsx"'
                return resp

            OFICIO = (8.5 * inch, 13 * inch)
            if size_param == "oficio":
                base = OFICIO
            elif size_param == "legal":
                base = LEGAL
            elif size_param == "letter":
                base = LETTER
            else:
                base = A4
            PAGE = landscape(base) if orient == "landscape" else portrait(base)

            buf = BytesIO()
            doc = BaseDocTemplate(buf, pagesize=PAGE, leftMargin=28, rightMargin=28, topMargin=24, bottomMargin=24)
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle("title", parent=styles["Heading1"], alignment=1)
            normal = styles["Normal"]

            filtros = spec.get("filters", {})
            start = filtros.get("start") or "-"
            end = filtros.get("end") or "-"

            elements = [
                Paragraph("Informe de Productos", title_style),
                Spacer(0, 6),
                Paragraph(f"Período: {start} a {end}", normal),
                Spacer(0, 10),
            ]

            data = [[c.replace("_", " ").capitalize() for c in columns]]
            for r in rows:
                data.append([_safe(r.get(c, "")) for c in columns])

            tbl = Table(data, repeatRows=1)
            tbl.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2E7D32")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                        ("GRID", (0, 0), (-1, -1), 0.35, colors.grey),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.HexColor("#F5F7F2")]),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            for j, col in enumerate(columns):
                if any(k in col.lower() for k in ["monto", "total", "precio", "cantidad", "stock", "rotacion", "%"]):
                    tbl.setStyle(TableStyle([("ALIGN", (j, 1), (j, -1), "RIGHT")]))

            elements.append(tbl)
            doc.build(elements)
            pdf = buf.getvalue()
            buf.close()

            resp = HttpResponse(pdf, content_type="application/pdf")
            resp["Content-Disposition"] = 'attachment; filename="reporte_productos.pdf"'
            return resp

        except Exception as e:
            return Response({"detail": f"Export error: {type(e).__name__}: {e}"}, status=500)


__all__ = [
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

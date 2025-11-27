from django.urls import path
from .views import OrderCreateView, OrderListView, OrderDetailView

urlpatterns = [
    path("orders/", OrderCreateView.as_view()),
    path("orders/list/", OrderListView.as_view()),
    path("orders/<int:pk>/", OrderDetailView.as_view()),
]

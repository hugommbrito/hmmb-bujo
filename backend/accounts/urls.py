from django.urls import path

from accounts.views import TokenObtainPairView, TokenRefreshView, signup

urlpatterns = [
    path("signup/", signup, name="accounts-signup"),
    path("token/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
]

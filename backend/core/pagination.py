from rest_framework.pagination import PageNumberPagination


class CorePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "pageSize"  # camelCase na borda (§6.3)
    max_page_size = 200

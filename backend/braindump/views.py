"""Views finas do Brain Dump (§6.2): parseiam/validam → chamam o serviço → serializam."""

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from braindump.models import BrainDumpItem
from braindump.serializers import (
    BrainDumpCountSerializer,
    BrainDumpItemCreateSerializer,
    BrainDumpItemProcessSerializer,
    BrainDumpItemSerializer,
)
from braindump.services import (
    count_brain_dump_items,
    create_brain_dump_item,
    discard_brain_dump_item,
    list_brain_dump_items,
    process_brain_dump_item,
)
from bujo.serializers import TaskSerializer
from core.calendar import today_for


class BrainDumpItemListCreateView(APIView):
    @extend_schema(responses=BrainDumpItemSerializer(many=True))
    def get(self, request):
        items = list_brain_dump_items(user=request.user)
        return Response(BrainDumpItemSerializer(items, many=True).data)

    @extend_schema(request=BrainDumpItemCreateSerializer, responses=BrainDumpItemSerializer)
    def post(self, request):
        body = BrainDumpItemCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        item = create_brain_dump_item(user=request.user, **body.validated_data)
        return Response(BrainDumpItemSerializer(item).data, status=status.HTTP_201_CREATED)


class BrainDumpItemDetailView(APIView):
    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        try:
            discard_brain_dump_item(user=request.user, item_id=pk)
        except BrainDumpItem.DoesNotExist:
            raise NotFound() from None
        return Response(status=status.HTTP_204_NO_CONTENT)


class BrainDumpItemProcessView(APIView):
    @extend_schema(request=BrainDumpItemProcessSerializer, responses=TaskSerializer)
    def post(self, request, pk):
        body = BrainDumpItemProcessSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        validated = body.validated_data
        destination = validated["destination"]

        month_first = validated.get("month_first")
        current_month_first = today_for(request.user).replace(day=1)
        if destination == "month":
            month_first = current_month_first
        elif (
            destination == "future"
            and month_first is not None
            and month_first <= current_month_first
        ):
            raise serializers.ValidationError(
                {"month_first": "Use 'month' para o mês corrente."}
            )

        try:
            task = process_brain_dump_item(
                user=request.user,
                item_id=pk,
                destination=destination,
                month_first=month_first,
                scheduled_date=validated.get("scheduled_date"),
            )
        except BrainDumpItem.DoesNotExist:
            raise NotFound() from None
        return Response(TaskSerializer(task).data)


class BrainDumpCountView(APIView):
    @extend_schema(responses=BrainDumpCountSerializer)
    def get(self, request):
        count = count_brain_dump_items(user=request.user)
        return Response(BrainDumpCountSerializer({"count": count}).data)
